import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import {
  configureClaimGenerator,
  finishClaim,
  generateClaimGrid,
  getClaimWorkspace,
  prepareClaim,
  resetClaim,
  saveClaimGrid,
  updateClaimCard
} from "./api";

const COLORS = {
  bg: "#09090b",
  panel: "#151518",
  panelAlt: "#1c1c20",
  border: "#303038",
  text: "#fafafa",
  muted: "#a1a1aa",
  faint: "#71717a",
  red: "#ef233c",
  redDark: "#5c1320",
  teal: "#2dd4bf",
  yellow: "#facc15",
  green: "#22c55e"
};

export default function ClaimsFeature({ config, currentUser, canConfigure, onStatus, onQueueAction }) {
  const [workspace, setWorkspace] = useState(null);
  const [mode, setMode] = useState("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [fileName, setFileName] = useState("");
  const [generatorUrl, setGeneratorUrl] = useState("");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [gridBatch, setGridBatch] = useState(null);
  const prepareActionRef = useRef("");
  const finishActionRef = useRef("");
  const gridActionRef = useRef("");
  const resetActionRef = useRef("");

  useEffect(() => {
    loadWorkspace();
  }, [config.apiUrl, config.sessionToken]);

  async function run(label, task) {
    setLoading(true);
    setError("");
    if (onStatus) onStatus(label);
    try {
      const result = await task();
      if (onStatus) onStatus("Claims listo");
      return result;
    } catch (err) {
      const message = errorText(err);
      setError(message);
      if (onStatus) onStatus(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkspace() {
    try {
      const data = await run("Cargando Claims...", () => getClaimWorkspace(config));
      setWorkspace(data);
      if (onStatus) onStatus(data.configured ? "Claims listo" : "Falta configurar Claims");
    } catch (err) {
      // The inline retry state keeps the user in context.
    }
  }

  async function configureGenerator() {
    if (!String(generatorUrl || "").trim()) {
      Alert.alert("Falta la planilla", "Pega la URL del Generador de Claims V2.");
      return;
    }
    try {
      const data = await run("Conectando generador...", () => configureClaimGenerator(config, withActor({ spreadsheetUrl: generatorUrl }, "claim-config", currentUser)));
      setWorkspace(data);
      setGeneratorUrl("");
      feedbackSuccess();
    } catch (err) {
      Alert.alert("No pude conectar el generador", errorText(err));
    }
  }

  async function pickCsv() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
        base64: true
      });
      if (result.canceled || !result.assets || !result.assets.length) return;
      const asset = result.assets[0];
      const text = await readPickedTextFile(asset);
      const parsed = parseMonPriceCsv(text);
      setItems(parsed);
      setFileName(asset.name || "CSV MonPrice");
      setMode("import");
      setError("");
      feedbackLight();
    } catch (err) {
      Alert.alert("No pude leer el CSV", errorText(err));
    }
  }

  function patchImportItem(index, patch) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function prepareItems() {
    const active = items.filter((item) => !item.skip && (Number(item.quantity) || 0) > 0);
    if (!active.length) {
      Alert.alert("Nada para preparar", "Deja al menos una carta activa.");
      return;
    }
    const hasActiveClaim = !!(workspace && workspace.cards && workspace.cards.length);
    const importMode = hasActiveClaim ? await chooseExistingClaimMode() : "new";
    if (!importMode) return;
    if (!prepareActionRef.current) prepareActionRef.current = makeActionId("claim-prepare");
    try {
      const payload = withActor({
        items: active,
        appendExisting: importMode === "append",
        replaceExisting: importMode === "replace",
        localActionId: prepareActionRef.current
      }, "claim-prepare", currentUser);
      const result = await run("Preparando claim...", () => prepareClaim(config, payload));
      prepareActionRef.current = "";
      setWorkspace(result.workspace);
      const details = {};
      (result.details || []).forEach((detail) => { details[detail.localKey] = detail; });
      const failed = active
        .filter((item) => details[item.localKey] && details[item.localKey].status === "review")
        .map((item) => ({ ...item, importError: details[item.localKey].error || "Revisar match" }));
      setItems(failed);
      setReviewIndex(0);
      feedbackSuccess();
      if (failed.length) {
        setMode("import");
        Alert.alert(
          "Claim preparado parcialmente",
          `${result.prepared || 0} cartas listas. Quedaron ${failed.length} filas para corregir; podes pegar el link exacto y agregarlas al mismo claim.`
        );
      } else {
        setFileName("");
        setMode("review");
      }
    } catch (err) {
      if (!isRetryableError(err)) prepareActionRef.current = "";
      Alert.alert("No pude preparar el claim", errorText(err));
    }
  }

  async function saveCard(cardId, patch) {
    const payload = withActor({ cardId, patch }, "claim-card", currentUser);
    let result;
    try {
      result = await run("Guardando carta...", () => updateClaimCard(config, payload));
    } catch (err) {
      if (!onQueueAction || !isRetryableError(err)) throw err;
      onQueueAction(payload, `Editar carta de claim: ${cardId}`);
      const optimistic = { ...patch, id: cardId };
      setWorkspace((current) => {
        const nextCards = (current.cards || []).map((card) => card.id === cardId ? { ...card, ...patch } : card);
        return { ...current, cards: nextCards, summary: summarizeClaimCards(nextCards, current.summary) };
      });
      setError("");
      if (onStatus) onStatus("Cambio de claim guardado en cola offline");
      feedbackLight();
      return optimistic;
    }
    if (result.workspace) setWorkspace(result.workspace);
    else if (result.card) {
      setWorkspace((current) => ({
        ...current,
        cards: (current.cards || []).map((card) => card.id === result.card.id ? result.card : card),
        summary: result.summary || current.summary
      }));
    }
    feedbackLight();
    return result.card;
  }

  async function openGrid() {
    try {
      const result = await run("Preparando adelanto...", () => generateClaimGrid(config));
      if (result.workspace) setWorkspace(result.workspace);
      if (result.complete || !result.batch) {
        Alert.alert("Adelantos completos", "Todas las cartas con imagen ya pertenecen a un grid.");
        return;
      }
      setGridBatch(result.batch);
      setMode("grid");
    } catch (err) {
      Alert.alert("No pude preparar el grid", errorText(err));
    }
  }

  async function persistGrid(base64) {
    if (!gridBatch) return null;
    if (!gridActionRef.current) gridActionRef.current = makeActionId("claim-grid");
    const payload = withActor({
      sessionId: gridBatch.sessionId,
      fileName: gridBatch.fileName,
      cardIds: gridBatch.cards.map((card) => card.id),
      base64,
      localActionId: gridActionRef.current
    }, "claim-grid", currentUser);
    try {
      const result = await saveClaimGrid(config, payload);
      gridActionRef.current = "";
      if (result.workspace) setWorkspace(result.workspace);
      return result;
    } catch (err) {
      if (!isRetryableError(err)) gridActionRef.current = "";
      throw err;
    }
  }

  async function finishActiveClaim() {
    const summary = workspace && workspace.summary || {};
    if (!summary.cardsWithBuyer) {
      Alert.alert("Faltan compradores", "Carga al menos un comprador antes de terminar el claim.");
      return;
    }
    if (summary.missingPrices) {
      Alert.alert("Faltan precios", `Hay ${summary.missingPrices} cartas vendidas sin precio final.`);
      return;
    }
    const confirmed = await confirmAction(
      "Terminar claim",
      `Se van a crear ${summary.buyers || 0} ordenes con ${summary.cardsWithBuyer || 0} cartas. Esta accion archiva y limpia el generador.`
    );
    if (!confirmed) return;
    if (!finishActionRef.current) finishActionRef.current = makeActionId("claim-finish");
    try {
      const payload = withActor({ sessionId: workspace.session && workspace.session.id, localActionId: finishActionRef.current }, "claim-finish", currentUser);
      const result = await run("Terminando claim...", () => finishClaim(config, payload));
      finishActionRef.current = "";
      feedbackSuccess();
      Alert.alert("Claim terminado", `${result.claimName}\n${result.orders || 0} ordenes creadas y ${result.soldRows || 0} cartas enviadas al HUB.`);
      setMode("home");
      setItems([]);
      setGridBatch(null);
      await loadWorkspace();
    } catch (err) {
      if (!isRetryableError(err)) finishActionRef.current = "";
      Alert.alert("No pude terminar el claim", errorText(err));
    }
  }

  async function resetActiveClaim() {
    const confirmed = await confirmAction("Resetear claim", "Se limpiaran Carga, Claim y Frees. El historial terminado no se borra.");
    if (!confirmed) return;
    if (!resetActionRef.current) resetActionRef.current = makeActionId("claim-reset");
    try {
      const result = await run("Reseteando claim...", () => resetClaim(config, withActor({ sessionId: workspace.session && workspace.session.id, localActionId: resetActionRef.current }, "claim-reset", currentUser)));
      resetActionRef.current = "";
      setWorkspace(result.workspace || result);
      setItems([]);
      setFileName("");
      setMode("home");
      feedbackSuccess();
    } catch (err) {
      if (!isRetryableError(err)) resetActionRef.current = "";
      Alert.alert("No pude resetear", errorText(err));
    }
  }

  if (!workspace && loading) return <ClaimsLoading label="Abriendo taller de claims..." />;

  if (workspace && !workspace.configured) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ToolHeader icon="layers-outline" title="Claims" sub="Conecta el Generador de Claims V2 una sola vez" />
        <View style={styles.setupPanel}>
          <Ionicons name="link-outline" size={30} color={COLORS.red} />
          <Text style={styles.setupTitle}>Falta enlazar el generador</Text>
          <Text style={styles.bodyText}>El HUB necesita la URL de la planilla que contiene Config, Carga, Claim, Frees e Info.</Text>
          {canConfigure ? (
            <>
              <TextInput
                value={generatorUrl}
                onChangeText={setGeneratorUrl}
                placeholder="URL del Generador de Claims V2"
                placeholderTextColor={COLORS.faint}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <ActionButton icon="link" label="Conectar generador" primary loading={loading} onPress={configureGenerator} />
            </>
          ) : <Text style={styles.warningText}>Seb debe configurar esta conexion desde su usuario.</Text>}
        </View>
        <InlineError message={error} onRetry={loadWorkspace} />
      </ScrollView>
    );
  }

  if (mode === "import") {
    return (
      <ClaimImportScreen
        items={items}
        fileName={fileName}
        loading={loading}
        onBack={() => setMode("home")}
        onPickCsv={pickCsv}
        onPatch={patchImportItem}
        onPrepare={prepareItems}
        error={error}
      />
    );
  }

  if (mode === "review" && workspace && workspace.cards && workspace.cards.length) {
    return (
      <ClaimReviewScreen
        workspace={workspace}
        index={Math.min(reviewIndex, workspace.cards.length - 1)}
        loading={loading}
        onIndex={setReviewIndex}
        onBack={() => setMode("home")}
        onSave={saveCard}
      />
    );
  }

  if (mode === "grid" && gridBatch) {
    return (
      <ClaimGridScreen
        batch={gridBatch}
        loading={loading}
        onBack={() => setMode("home")}
        onSave={async (base64) => run("Guardando adelanto...", () => persistGrid(base64))}
        onNext={openGrid}
      />
    );
  }

  return (
    <ClaimsHome
      workspace={workspace || { cards: [], grids: [], summary: {} }}
      loading={loading}
      error={error}
      onReload={loadWorkspace}
      onImport={pickCsv}
      onReview={() => { setReviewIndex(0); setMode("review"); }}
      onGrid={openGrid}
      onFinish={finishActiveClaim}
      onReset={resetActiveClaim}
    />
  );
}

function ClaimsHome({ workspace, loading, error, onReload, onImport, onReview, onGrid, onFinish, onReset }) {
  const cards = workspace.cards || [];
  const grids = workspace.grids || [];
  const summary = workspace.summary || {};
  const active = !!cards.length;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ToolHeader
        icon="layers-outline"
        title="Claims"
        sub={active ? `${workspace.session && workspace.session.name} - ${summary.cards || 0} cartas` : "Importa, revisa y publica desde el celular"}
        action={<IconButton icon="refresh" onPress={onReload} loading={loading} />}
      />

      {active ? (
        <>
          <View style={styles.claimStatusBand}>
            <View style={styles.claimStatusCopy}>
              <Text style={styles.eyebrow}>CLAIM ACTIVO</Text>
              <Text style={styles.claimName}>{workspace.session && workspace.session.name}</Text>
              <Text style={styles.bodyText}>{summary.cardsWithBuyer || 0} vendidas a {summary.buyers || 0} compradores</Text>
            </View>
            <View style={styles.liveDot} />
          </View>
          <View style={styles.metricsRow}>
            <Metric label="ARS" value={formatArs(summary.totalArs)} />
            <Metric label="USD" value={formatUsd(summary.totalUsd)} />
            <Metric label="Sin imagen" value={String(summary.missingImages || 0)} warn={summary.missingImages > 0} />
          </View>
          <View style={styles.primaryActions}>
            <ActionButton icon="albums-outline" label="Revisar claim" primary onPress={onReview} />
            <ActionButton icon="images-outline" label="Crear adelantos" onPress={onGrid} disabled={!summary.remainingGridCards} />
          </View>
          <View style={styles.secondaryActions}>
            <ActionButton compact icon="add" label="CSV" onPress={onImport} />
            <ActionButton compact icon="checkmark-done" label="Cerrar" onPress={onFinish} />
            <IconButton icon="trash-outline" danger onPress={onReset} />
          </View>
          {summary.missingPrices ? <Notice icon="alert-circle-outline" text={`${summary.missingPrices} cartas con comprador todavia no tienen precio final.`} /> : null}
          {summary.missingImages ? <Notice icon="image-outline" text={`${summary.missingImages} cartas no entraran al grid hasta tener imagen.`} /> : null}
        </>
      ) : (
        <View style={styles.emptyTool}>
          <View style={styles.emptyIcon}><Ionicons name="documents-outline" size={34} color={COLORS.red} /></View>
          <Text style={styles.emptyTitle}>Prepara el proximo claim</Text>
          <Text style={styles.bodyText}>Carga el CSV exportado por MonPrice. La app lo cruza con PriceCharting y crea la mesa de revision.</Text>
          <ActionButton icon="document-attach-outline" label="Elegir CSV MonPrice" primary onPress={onImport} />
        </View>
      )}

      {grids.length ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Adelantos guardados</Text>
          {grids.map((grid) => (
            <Pressable key={`${grid.fileId}-${grid.batch}`} style={({ pressed }) => [styles.gridLogRow, pressed && styles.pressed]} onPress={() => openExternal(grid.downloadUrl || grid.url)}>
              <View style={styles.gridLogIcon}><Ionicons name="image-outline" size={20} color={COLORS.teal} /></View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{grid.batch}</Text>
                <Text style={styles.rowSub}>{grid.cards} cartas - {grid.createdAt}</Text>
              </View>
              <Ionicons name="download-outline" size={21} color={COLORS.text} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <InlineError message={error} onRetry={onReload} />
    </ScrollView>
  );
}

function ClaimImportScreen({ items, fileName, loading, onBack, onPickCsv, onPatch, onPrepare, error }) {
  const activeCount = items.filter((item) => !item.skip && Number(item.quantity) > 0).length;
  const totalCards = items.reduce((sum, item) => item.skip ? sum : sum + (Number(item.quantity) || 0), 0);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SubHeader title="Preparar CSV" sub={fileName || "MonPrice"} onBack={onBack} />
      <View style={styles.importSummary}>
        <View><Text style={styles.eyebrow}>REVISION PREVIA</Text><Text style={styles.importCount}>{totalCards} cartas</Text></View>
        <ActionButton compact icon="document-attach-outline" label="Cambiar CSV" onPress={onPickCsv} />
      </View>
      <Text style={styles.helpText}>Corrige cantidades y pega el link exacto de PriceCharting solo cuando el match necesite ayuda.</Text>
      {items.map((item, index) => (
        <View key={item.localKey} style={[styles.importRow, item.skip && styles.disabledRow]}>
          <View style={styles.importRowTop}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{item.name || "Sin nombre"}</Text>
              <Text style={styles.rowSub}>{[item.expansion, item.number].filter(Boolean).join(" - ")}</Text>
            </View>
            <Pressable style={styles.toggleIcon} onPress={() => onPatch(index, { skip: !item.skip })}>
              <Ionicons name={item.skip ? "eye-off-outline" : "checkmark-circle"} size={23} color={item.skip ? COLORS.faint : COLORS.green} />
            </Pressable>
          </View>
          {item.importError ? <Text style={styles.errorText}>{item.importError}</Text> : null}
          <View style={styles.importControls}>
            <Pressable style={styles.qtyButton} onPress={() => onPatch(index, { quantity: Math.max(0, Number(item.quantity || 0) - 1) })}><Ionicons name="remove" size={20} color={COLORS.text} /></Pressable>
            <Text style={styles.qtyValue}>{item.quantity || 0}</Text>
            <Pressable style={styles.qtyButton} onPress={() => onPatch(index, { quantity: Number(item.quantity || 0) + 1 })}><Ionicons name="add" size={20} color={COLORS.text} /></Pressable>
            <TextInput
              value={item.pcUrl || ""}
              onChangeText={(pcUrl) => onPatch(index, { pcUrl, importError: "" })}
              placeholder="Link PriceCharting opcional"
              placeholderTextColor={COLORS.faint}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.importLinkInput]}
            />
          </View>
        </View>
      ))}
      <ActionButton icon="sparkles-outline" label={`Preparar ${totalCards} cartas`} primary loading={loading} disabled={!activeCount} onPress={onPrepare} />
      <InlineError message={error} />
    </ScrollView>
  );
}

function ClaimReviewScreen({ workspace, index, loading, onIndex, onBack, onSave }) {
  const cards = workspace.cards || [];
  const card = cards[index];
  const [draft, setDraft] = useState(() => cardToDraft(card));
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setDraft(cardToDraft(card));
    setImageFailed(false);
  }, [card && card.id]);

  const generatedName = useMemo(() => buildFinalName(draft, card), [draft, card]);

  async function saveAndMove(delta) {
    try {
      await onSave(card.id, {
        finalArs: parseMoney(draft.finalArs),
        finalUsd: parseMoney(draft.finalUsd),
        finalName: String(draft.finalName || "").trim(),
        buyer: String(draft.buyer || "").trim(),
        tags: String(draft.tags || "").trim()
      });
      if (delta) onIndex(Math.max(0, Math.min(cards.length - 1, index + delta)));
    } catch (err) {
      Alert.alert("No pude guardar la carta", errorText(err));
    }
  }

  async function copyName() {
    await Clipboard.setStringAsync(generatedName);
    feedbackLight();
  }

  if (!card) return null;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SubHeader title={workspace.session && workspace.session.name || "Revisar claim"} sub={`${index + 1} de ${cards.length}`} onBack={onBack} />
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((index + 1) / cards.length) * 100}%` }]} /></View>

      <View style={styles.cardStage}>
        {card.imageUrl && !imageFailed ? (
          <Image source={{ uri: card.imageUrl }} style={styles.reviewImage} resizeMode="contain" onError={() => setImageFailed(true)} />
        ) : (
          <View style={styles.imageFallback}><Ionicons name="image-outline" size={38} color={COLORS.faint} /><Text style={styles.rowSub}>Imagen pendiente</Text></View>
        )}
        <View style={styles.reviewIdentity}>
          <Text style={styles.reviewName}>{card.name}</Text>
          <Text style={styles.reviewExpansion}>{card.expansion || "Sin expansion"}</Text>
          {card.status !== "OK" ? <Text style={styles.warningText}>{card.status}</Text> : null}
        </View>
      </View>

      <View style={styles.priceStrip}>
        <PriceDatum label="PRICECHARTING" value={formatUsd(card.pcUsd)} />
        <PriceDatum label="PC EN ARS" value={formatArs(card.pcArs)} />
        <PriceDatum label="SUGERIDO" value={formatArs(card.suggestedArs)} accent />
      </View>

      <View style={styles.formSection}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Nombre final</Text>
          <Pressable style={styles.copyButton} onPress={copyName}><Ionicons name="copy-outline" size={18} color={COLORS.teal} /><Text style={styles.copyText}>Copiar</Text></Pressable>
        </View>
        <TextInput value={draft.finalName} onChangeText={(finalName) => setDraft((current) => ({ ...current, finalName }))} placeholder={generatedName} placeholderTextColor={COLORS.faint} style={styles.input} />
        <Text style={styles.namePreview} numberOfLines={3}>{generatedName}</Text>

        <View style={styles.twoColumns}>
          <LabeledInput label="Precio final ARS" value={draft.finalArs} onChangeText={(finalArs) => setDraft((current) => ({ ...current, finalArs }))} placeholder="Ej. 15000" keyboardType="numeric" />
          <LabeledInput label="Precio final USD" value={draft.finalUsd} onChangeText={(finalUsd) => setDraft((current) => ({ ...current, finalUsd }))} placeholder="Ej. 10" keyboardType="decimal-pad" />
        </View>
        <Pressable style={styles.suggestionButton} onPress={() => setDraft((current) => ({ ...current, finalArs: String(card.suggestedArs || "") }))}>
          <Ionicons name="flash-outline" size={17} color={COLORS.yellow} />
          <Text style={styles.suggestionText}>Usar sugerido {formatArs(card.suggestedArs)}</Text>
        </Pressable>
        <LabeledInput label="Comprador" value={draft.buyer} onChangeText={(buyer) => setDraft((current) => ({ ...current, buyer }))} placeholder="Ej. juan 4567" />
        <LabeledInput label="Tags" value={draft.tags} onChangeText={(tags) => setDraft((current) => ({ ...current, tags }))} placeholder="Personas a etiquetar" />
      </View>

      <View style={styles.reviewLinks}>
        <ActionButton compact icon="open-outline" label="PriceCharting" disabled={!card.pcUrl} onPress={() => openExternal(card.pcUrl)} />
        <ActionButton compact icon="save-outline" label="Guardar" loading={loading} onPress={() => saveAndMove(0)} />
      </View>
      <View style={styles.reviewNav}>
        <Pressable style={[styles.navArrow, index === 0 && styles.disabledButton]} disabled={index === 0 || loading} onPress={() => saveAndMove(-1)}><Ionicons name="chevron-back" size={24} color={COLORS.text} /><Text style={styles.navArrowText}>Anterior</Text></Pressable>
        <Pressable style={[styles.navArrow, styles.navArrowPrimary, index === cards.length - 1 && styles.disabledButton]} disabled={index === cards.length - 1 || loading} onPress={() => saveAndMove(1)}><Text style={styles.navArrowText}>Siguiente</Text><Ionicons name="chevron-forward" size={24} color={COLORS.text} /></Pressable>
      </View>
    </ScrollView>
  );
}

function ClaimGridScreen({ batch, loading, onBack, onSave, onNext }) {
  const { width } = useWindowDimensions();
  const captureView = useRef(null);
  const [loaded, setLoaded] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const previewWidth = Math.max(280, Math.min(width - 32, 420));
  const columns = Number(batch.columns) || 5;
  const rows = Math.ceil(batch.cards.length / columns);
  const gap = 4;
  const headerHeight = 48;
  const cellWidth = (previewWidth - gap * (columns - 1)) / columns;
  const cellHeight = cellWidth * 1.397;
  const gridHeight = headerHeight + rows * cellHeight + Math.max(0, rows - 1) * gap;
  const allLoaded = Object.keys(loaded).length >= batch.cards.length;

  useEffect(() => {
    setLoaded({});
    setSaved(null);
  }, [batch.fileName]);

  async function saveAndShare() {
    if (!allLoaded || saving || loading) return;
    setSaving(true);
    try {
      const targetWidth = 1200;
      const targetHeight = Math.round(gridHeight / previewWidth * targetWidth);
      let result = saved;
      if (!result) {
        const base64 = await captureRef(captureView, { format: "png", result: "base64", width: targetWidth, height: targetHeight });
        result = await onSave(base64);
        setSaved(result);
      }
      feedbackSuccess();
      if (Platform.OS === "web") {
        const base64 = await captureRef(captureView, { format: "png", result: "base64", width: targetWidth, height: targetHeight });
        const dataUrl = `data:image/png;base64,${base64}`;
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = batch.fileName;
        link.click();
      } else {
        const uri = await captureRef(captureView, { format: "png", result: "tmpfile", width: targetWidth, height: targetHeight, fileName: batch.fileName.replace(/\.png$/i, "") });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Guardar o compartir adelanto" });
        }
      }
    } catch (err) {
      Alert.alert("No pude guardar el adelanto", errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SubHeader title="Adelanto" sub={`${batch.cards.length} cartas - ${columns} columnas`} onBack={onBack} />
      <Text style={styles.helpText}>La copia se guarda en Drive y se abre el menu del telefono para descargarla o compartirla.</Text>
      <View style={styles.gridPreviewFrame}>
        <View
          ref={captureView}
          collapsable={false}
          style={[styles.captureGrid, { width: previewWidth, height: gridHeight }]}
        >
          <View style={[styles.captureHeader, { height: headerHeight }]}>
            <View><Text style={styles.captureBrand}>ULTIMOTURNO</Text><Text style={styles.captureClaim}>{batch.claimName}</Text></View>
            <Text style={styles.captureCount}>{batch.cards.length}</Text>
          </View>
          <View style={[styles.captureCards, { gap }]}> 
            {batch.cards.map((card) => (
              <View key={card.id} style={{ width: cellWidth, height: cellHeight, backgroundColor: "#18181b" }}>
                <Image
                  source={{ uri: card.imageUrl }}
                  style={styles.gridCardImage}
                  resizeMode="cover"
                  onLoad={() => setLoaded((current) => ({ ...current, [card.id]: true }))}
                  onError={() => setLoaded((current) => ({ ...current, [card.id]: true }))}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
      {!allLoaded ? <View style={styles.loadingInline}><ActivityIndicator color={COLORS.red} /><Text style={styles.rowSub}>Cargando imagenes del grid...</Text></View> : null}
      <ActionButton icon="share-social-outline" label={saved ? "Compartir otra vez" : "Guardar y compartir PNG"} primary loading={saving || loading} disabled={!allLoaded} onPress={saveAndShare} />
      {saved ? (
        <View style={styles.gridSuccess}>
          <Ionicons name="checkmark-circle" size={25} color={COLORS.green} />
          <View style={styles.flex}><Text style={styles.rowTitle}>Adelanto guardado</Text><Text style={styles.rowSub}>{saved.remaining || 0} cartas quedan para otros grids</Text></View>
          {saved.remaining ? <IconButton icon="arrow-forward" onPress={onNext} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function ToolHeader({ icon, title, sub, action }) {
  return <View style={styles.toolHeader}><View style={styles.toolIcon}><Ionicons name={icon} size={25} color={COLORS.red} /></View><View style={styles.flex}><Text style={styles.toolTitle}>{title}</Text><Text style={styles.rowSub}>{sub}</Text></View>{action}</View>;
}

function SubHeader({ title, sub, onBack }) {
  return <View style={styles.subHeader}><IconButton icon="arrow-back" onPress={onBack} /><View style={styles.flex}><Text style={styles.toolTitle}>{title}</Text><Text style={styles.rowSub}>{sub}</Text></View></View>;
}

function ActionButton({ icon, label, onPress, primary, compact, loading, disabled }) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.actionButton, primary && styles.actionButtonPrimary, compact && styles.actionButtonCompact, (disabled || loading) && styles.disabledButton, pressed && styles.pressed]}>
      {loading ? <ActivityIndicator color={primary ? "#fff" : COLORS.red} /> : <Ionicons name={icon} size={20} color={primary ? "#fff" : COLORS.text} />}
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ icon, onPress, loading, danger }) {
  return <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [styles.iconButton, danger && styles.iconButtonDanger, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={COLORS.red} /> : <Ionicons name={icon} size={21} color={danger ? "#fb7185" : COLORS.text} />}</Pressable>;
}

function Metric({ label, value, warn }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, warn && styles.metricWarn]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>;
}

function PriceDatum({ label, value, accent }) {
  return <View style={styles.priceDatum}><Text style={styles.priceLabel}>{label}</Text><Text style={[styles.priceValue, accent && styles.priceAccent]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>;
}

function LabeledInput({ label, ...inputProps }) {
  return <View style={styles.labeledInput}><Text style={styles.label}>{label}</Text><TextInput {...inputProps} placeholderTextColor={COLORS.faint} style={styles.input} /></View>;
}

function Notice({ icon, text }) {
  return <View style={styles.notice}><Ionicons name={icon} size={19} color={COLORS.yellow} /><Text style={styles.noticeText}>{text}</Text></View>;
}

function InlineError({ message, onRetry }) {
  if (!message) return null;
  return <View style={styles.inlineError}><Ionicons name="cloud-offline-outline" size={20} color="#fb7185" /><Text style={styles.inlineErrorText}>{message}</Text>{onRetry ? <IconButton icon="refresh" onPress={onRetry} /> : null}</View>;
}

function ClaimsLoading({ label }) {
  return <View style={styles.center}><ActivityIndicator color={COLORS.red} /><Text style={styles.bodyText}>{label}</Text></View>;
}

function cardToDraft(card) {
  return {
    finalArs: card && card.finalArs !== "" && card.finalArs !== null && card.finalArs !== undefined ? String(card.finalArs) : "",
    finalUsd: card && card.finalUsd !== "" && card.finalUsd !== null && card.finalUsd !== undefined ? String(card.finalUsd) : "",
    finalName: card && card.customFinalName ? String(card.finalName || "") : "",
    buyer: String(card && card.buyer || ""),
    tags: String(card && card.tags || "")
  };
}

function buildFinalName(draft, card) {
  if (String(draft.finalName || "").trim()) return String(draft.finalName).trim();
  const base = [card.name, card.expansion].filter(Boolean).join(" - ");
  const prices = [];
  const ars = parseMoney(draft.finalArs);
  const usd = parseMoney(draft.finalUsd);
  if (ars) prices.push(`$${formatNumber(ars, 0)}`);
  if (usd) prices.push(`$${formatNumber(usd, 2)}usd`);
  return prices.length ? `${base} - ${prices.join(" + ")}` : base;
}

function parseMoney(value) {
  let text = String(value === null || value === undefined ? "" : value).trim().replace(/\s/g, "");
  if (!text) return "";
  text = text.replace(/[^0-9,.-]/g, "");
  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) text = text.replace(/\./g, "").replace(",", ".");
    else text = text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : "";
}

function formatArs(value) {
  return `$${formatNumber(Number(value) || 0, 0)}`;
}

function formatUsd(value) {
  return `USD ${formatNumber(Number(value) || 0, 2)}`;
}

function formatNumber(value, decimals) {
  return Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: decimals, minimumFractionDigits: decimals && Number(value) % 1 ? 2 : 0 });
}

function withActor(payload, prefix, user) {
  return {
    ...(payload || {}),
    localActionId: payload && payload.localActionId || makeActionId(prefix),
    actor: user && user.name || "App",
    actorId: user && user.id || "",
    actorRole: user && user.role || ""
  };
}

function makeActionId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function chooseExistingClaimMode() {
  return new Promise((resolve) => {
    Alert.alert(
      "Ya hay un claim activo",
      "Podes sumar estas cartas al claim actual o reemplazarlo por completo.",
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
        { text: "Reemplazar", style: "destructive", onPress: () => resolve("replace") },
        { text: "Agregar", onPress: () => resolve("append") }
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}

function confirmAction(title, message) {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirmar", style: "destructive", onPress: () => resolve(true) }
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

async function readPickedTextFile(asset) {
  if (asset && asset.file && typeof asset.file.text === "function") return asset.file.text();
  if (asset && asset.base64) return base64ToUtf8(asset.base64);
  if (!asset || !asset.uri) throw new Error("El archivo no tiene URI.");
  const response = await fetch(asset.uri);
  if (!response.ok && response.status) throw new Error("No pude abrir el archivo seleccionado.");
  return response.text();
}

function parseMonPriceCsv(text) {
  const rows = parseDelimitedText(text).filter((row) => row.some((cell) => String(cell || "").trim()));
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes("name") && headers.includes("number") && headers.includes("set") && headers.includes("count");
  });
  if (headerIndex < 0) throw new Error("No encontre los headers Name, Number, Set y Count de MonPrice.");
  const headers = rows[headerIndex].map(normalizeHeader);
  const indexes = {};
  headers.forEach((header, index) => { indexes[header] = index; });
  const parsed = rows.slice(headerIndex + 1).map((row, index) => {
    const name = csvValue(row, indexes, "name");
    const expansion = csvValue(row, indexes, "set");
    const number = csvValue(row, indexes, "number");
    if (!name && !expansion && !number) return null;
    return {
      localKey: `${index}-${csvValue(row, indexes, "id") || "sin-id"}-${name}-${expansion}-${number}`,
      scanner: "MonPrice",
      scannerId: csvValue(row, indexes, "id"),
      name,
      expansion,
      number,
      language: csvValue(row, indexes, "language"),
      quantity: parseLooseNumber(csvValue(row, indexes, "count")) || 1,
      pcUrl: "",
      pcId: "",
      skip: false,
      importError: ""
    };
  }).filter(Boolean);
  if (!parsed.length) throw new Error("El CSV no contiene cartas.");
  return parsed;
}

function parseDelimitedText(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "\"") {
      if (quoted && next === "\"") { cell += "\""; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => String(value || "").trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function csvValue(row, indexes, key) {
  return indexes[key] === undefined ? "" : String(row[indexes[key]] || "").trim();
}

function parseLooseNumber(value) {
  const normalized = String(value || "").trim().replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function base64ToUtf8(base64) {
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }
  throw new Error("Este dispositivo no pudo decodificar el CSV.");
}

function openExternal(url) {
  const clean = String(url || "").trim();
  if (!clean) return;
  Linking.openURL(clean).catch((err) => Alert.alert("No pude abrir el link", errorText(err)));
}

function feedbackLight() {
  Haptics.selectionAsync().catch(() => {});
}

function feedbackSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

function errorText(err) {
  return err && err.message ? err.message : String(err || "Error");
}

function isRetryableError(err) {
  const text = errorText(err).toLowerCase();
  return ["network request failed", "failed to fetch", "timeout", "aborted", "ocupada", "procesandose", "429", "503"]
    .some((fragment) => text.includes(fragment));
}

function summarizeClaimCards(cards, previous) {
  const buyers = new Set();
  let cardsWithBuyer = 0;
  let totalArs = 0;
  let totalUsd = 0;
  let missingPrices = 0;
  (cards || []).forEach((card) => {
    if (!String(card.buyer || "").trim()) return;
    cardsWithBuyer += 1;
    buyers.add(String(card.buyer).trim().toLowerCase());
    totalArs += Number(card.finalArs) || 0;
    totalUsd += Number(card.finalUsd) || 0;
    if (!Number(card.finalArs) && !Number(card.finalUsd)) missingPrices += 1;
  });
  return {
    ...(previous || {}),
    cards: (cards || []).length,
    cardsWithBuyer,
    buyers: buyers.size,
    totalArs,
    totalUsd,
    missingPrices
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 112, gap: 14 },
  flex: { flex: 1, minWidth: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: COLORS.bg },
  toolHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 4 },
  toolIcon: { width: 48, height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border },
  toolTitle: { color: COLORS.text, fontSize: 24, fontWeight: "800" },
  subHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: { color: COLORS.red, fontSize: 11, fontWeight: "900" },
  bodyText: { color: COLORS.muted, fontSize: 15, lineHeight: 21 },
  rowTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  rowSub: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  claimStatusBand: { minHeight: 104, flexDirection: "row", alignItems: "center", paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  claimStatusCopy: { flex: 1, gap: 4 },
  claimName: { color: COLORS.text, fontSize: 28, fontWeight: "900" },
  liveDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.green },
  metricsRow: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, minHeight: 72, padding: 12, justifyContent: "space-between", backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
  metricLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "800" },
  metricValue: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  metricWarn: { color: COLORS.yellow },
  primaryActions: { gap: 9 },
  secondaryActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  actionButton: { minHeight: 50, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
  actionButtonPrimary: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  actionButtonCompact: { minHeight: 44, flex: 1, paddingHorizontal: 10 },
  actionLabel: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  actionLabelPrimary: { color: "#fff" },
  iconButton: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border },
  iconButtonDanger: { borderColor: COLORS.redDark },
  pressed: { opacity: 0.72 },
  disabledButton: { opacity: 0.38 },
  notice: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 9 },
  noticeText: { flex: 1, color: COLORS.muted, fontSize: 13 },
  sectionBlock: { gap: 9, marginTop: 4 },
  gridLogRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.border },
  gridLogIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#102522", alignItems: "center", justifyContent: "center" },
  emptyTool: { minHeight: 330, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 28 },
  emptyIcon: { width: 72, height: 72, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  setupPanel: { gap: 14, paddingVertical: 24 },
  setupTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  input: { minHeight: 48, color: COLORS.text, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 13, fontSize: 15 },
  warningText: { color: COLORS.yellow, fontSize: 13, lineHeight: 18 },
  helpText: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  importSummary: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  importCount: { color: COLORS.text, fontSize: 28, fontWeight: "900" },
  importRow: { gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderColor: COLORS.border },
  importRowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  disabledRow: { opacity: 0.45 },
  toggleIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  importControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyButton: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt },
  qtyValue: { width: 26, color: COLORS.text, textAlign: "center", fontSize: 16, fontWeight: "800" },
  importLinkInput: { flex: 1, minWidth: 0, minHeight: 42, fontSize: 13 },
  errorText: { color: "#fb7185", fontSize: 12 },
  inlineError: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12, borderWidth: 1, borderColor: COLORS.redDark, backgroundColor: "#251216", borderRadius: 8 },
  inlineErrorText: { flex: 1, color: "#fda4af", fontSize: 13 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: COLORS.panelAlt, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: COLORS.red },
  cardStage: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 8 },
  reviewImage: { width: 142, aspectRatio: 0.716, borderRadius: 8, backgroundColor: COLORS.panel },
  imageFallback: { width: 142, aspectRatio: 0.716, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border },
  reviewIdentity: { flex: 1, minWidth: 0, gap: 6 },
  reviewName: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  reviewExpansion: { color: COLORS.muted, fontSize: 15, lineHeight: 21 },
  priceStrip: { flexDirection: "row", gap: 8 },
  priceDatum: { flex: 1, minWidth: 0, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  priceLabel: { color: COLORS.faint, fontSize: 9, fontWeight: "800" },
  priceValue: { color: COLORS.text, fontSize: 15, fontWeight: "900", marginTop: 4 },
  priceAccent: { color: COLORS.teal },
  formSection: { gap: 10 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: COLORS.muted, fontSize: 12, fontWeight: "800", marginBottom: 5 },
  copyButton: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10 },
  copyText: { color: COLORS.teal, fontSize: 13, fontWeight: "800" },
  namePreview: { color: COLORS.text, fontSize: 13, lineHeight: 18, paddingHorizontal: 2 },
  twoColumns: { flexDirection: "row", gap: 10 },
  labeledInput: { flex: 1, minWidth: 0 },
  suggestionButton: { minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#564814", borderRadius: 8, backgroundColor: "#211e0c" },
  suggestionText: { color: COLORS.yellow, fontSize: 13, fontWeight: "800" },
  reviewLinks: { flexDirection: "row", gap: 8 },
  reviewNav: { flexDirection: "row", gap: 10 },
  navArrow: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt },
  navArrowPrimary: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  navArrowText: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  gridPreviewFrame: { alignItems: "center", paddingVertical: 4 },
  captureGrid: { backgroundColor: "#050505", overflow: "hidden" },
  captureHeader: { paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111114", borderBottomWidth: 2, borderColor: COLORS.red },
  captureBrand: { color: "#fff", fontSize: 9, fontWeight: "900" },
  captureClaim: { color: "#fff", fontSize: 15, fontWeight: "900" },
  captureCount: { color: COLORS.red, fontSize: 20, fontWeight: "900" },
  captureCards: { flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" },
  gridCardImage: { width: "100%", height: "100%" },
  loadingInline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 8 },
  gridSuccess: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
});
