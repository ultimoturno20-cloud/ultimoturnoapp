/** Contract only: no network, persistence, prices or inventory writes. */
export type MaultFinish = "normal" | "holo" | "reverse" | "pokeball" | "masterball";
export type MaultIntakeCopy = {
  copyId: string; cardId: string; collectionId: string; game: string;
  name: string; setCode: string; number: string; language: string; sourceLanguage: string;
  condition: string; finish: MaultFinish | null; sourceFinish: string;
  sourceFoilType: string; tcgplayerProductId: number | null;
  location: { id: string; name: string; position: number | null } | null;
  needsReview: boolean; issues: string[];
};
export type MaultIntakeReceipt = {
  businessId: string; copyId: string; fingerprint: string;
  state: "baseline" | "imported"; inventoryItemId?: string;
};
export type MaultCatalogMatch = {
  catalogId: string; sourceCardId: string; game: string; setCode: string;
  number: string; language: string; condition: string; finish: MaultFinish;
};
export type MaultIntakeContext = {
  /** Always derived by the server from its authenticated target, never a webhook. */
  businessId: string;
  allowedCollectionIds: readonly string[];
  phase: "baseline" | "incremental" | "confirmed_history";
  baselineComplete: boolean;
  conditionPolicy: "require_confirmation" | "accept_recorded";
  conditionConfirmed: boolean;
  receipt?: MaultIntakeReceipt;
  match: MaultCatalogMatch | "not_found" | "ambiguous";
};
export type MaultIntakeDecision = {
  copyId: string;
  state: "excluded" | "baseline" | "already_imported" | "review" | "ready";
  reasons: string[]; quantityDelta: 0 | 1; fingerprint: string;
  catalogId?: string;
};

const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const key = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const languages: Record<string, string> = { en: "EN", es: "ES", pt: "PT", it: "IT", de: "DE", fr: "FR", ja: "JA", ko: "KO", "zh-cn": "CHS", "zh-tw": "CHT", id: "ID", th: "TH" };
const finishes: Record<string, MaultFinish> = { holo: "holo", "reverse holo": "reverse", "reverse holo (poke ball)": "pokeball", "reverse holo (master ball)": "masterball" };

export function normalizeMaultCopy(input: unknown): MaultIntakeCopy {
  const raw = record(input);
  const copyId = str(raw.id);
  if (raw.object !== "scanned_card" || !copyId || copyId.length > 200) throw new Error("Copia Mault sin identificador valido.");
  const issues: string[] = [];
  const cardId = str(raw.card_id), name = str(raw.name), setCode = str(raw.set), number = str(raw.collector_number);
  if (!cardId || !name || !setCode || !number) issues.push("incomplete_identity");
  const sourceLanguage = str(raw.lang);
  const languageKey = sourceLanguage.toLowerCase();
  const language = Object.hasOwn(languages, languageKey) ? languages[languageKey] : "";
  if (!language) issues.push("unsupported_language");
  const condition = str(raw.condition).toUpperCase();
  if (!["NM", "LP", "MP", "HP", "DMG"].includes(condition)) issues.push("unsupported_condition");
  const sourceFinish = str(raw.finish), sourceFoilType = str(raw.foil_type);
  let finish: MaultFinish | null = null;
  if (sourceFinish === "nonfoil" && !sourceFoilType) finish = "normal";
  else if (sourceFinish === "foil" && Object.hasOwn(finishes, key(sourceFoilType))) finish = finishes[key(sourceFoilType)];
  if (!finish) issues.push("unsupported_or_conflicting_finish");
  const needsReview = raw.needs_review !== false;
  if (needsReview) issues.push("source_needs_review");
  const location = record(raw.location);
  return {
    copyId, cardId, name, setCode, number, game: str(raw.game),
    collectionId: str(record(raw.collection).id), language, sourceLanguage, condition, finish,
    sourceFinish, sourceFoilType, needsReview, issues,
    tcgplayerProductId: Number.isSafeInteger(raw.tcgplayer_product_id) && Number(raw.tcgplayer_product_id) > 0 ? Number(raw.tcgplayer_product_id) : null,
    location: str(location.id) ? { id: str(location.id), name: str(location.name), position: Number.isSafeInteger(location.position) && Number(location.position) >= 0 ? Number(location.position) : null } : null,
  };
}

/** Stable identity signature; deliberately excludes prices, collection and location. */
export function maultCopyFingerprint(copy: MaultIntakeCopy): string {
  return JSON.stringify([copy.cardId, copy.game, copy.setCode, copy.number, copy.language,
    copy.condition, copy.finish, copy.sourceFinish, copy.sourceFoilType, copy.sourceLanguage]);
}

export function maultReceiptKey(businessId: string, copyId: string): string {
  if (!businessId || !copyId) throw new Error("Falta negocio o copia Mault.");
  // Credential rotation, reconnecting and moving collections must not create new keys.
  return JSON.stringify([businessId, "mault", copyId]);
}

const numberKey = (value: string) => value.toUpperCase().split("/").map(part => part.replace(/^0+(?=\d)/, "")).join("/");

export function decideMaultIntake(copy: MaultIntakeCopy, context: MaultIntakeContext): MaultIntakeDecision {
  const fingerprint = maultCopyFingerprint(copy);
  const result = (state: MaultIntakeDecision["state"], reasons: string[] = []): MaultIntakeDecision => ({ copyId: copy.copyId, state, reasons, quantityDelta: 0, fingerprint });
  if (!context.businessId) throw new Error("Falta negocio autenticado.");
  const receipt = context.receipt;
  if (receipt && (receipt.businessId !== context.businessId || receipt.copyId !== copy.copyId)) throw new Error("Recibo Mault fuera del alcance autenticado.");
  if (receipt) {
    if (receipt.fingerprint !== fingerprint) return result("review", ["identity_changed_after_receipt"]);
    if (receipt.state === "imported") return result("already_imported");
    if (context.phase !== "confirmed_history") return result("baseline");
  }
  if (copy.game !== "pokemon") return result("excluded", ["unsupported_game"]);
  if (!copy.collectionId || !context.allowedCollectionIds.includes(copy.collectionId)) return result("excluded", ["collection_not_enabled"]);
  if (context.phase === "baseline") return result("baseline");
  if (context.phase === "incremental" && !context.baselineComplete) return result("review", ["initial_baseline_required"]);
  const reasons = [...copy.issues];
  if (context.conditionPolicy !== "accept_recorded" && context.conditionConfirmed !== true) reasons.push("condition_confirmation_required");
  const match = context.match;
  if (typeof match === "string") reasons.push(match === "ambiguous" ? "ambiguous_catalog_match" : "catalog_not_found");
  else if (!match.catalogId || match.sourceCardId !== copy.cardId || match.game !== copy.game
    || key(match.setCode) !== key(copy.setCode) || numberKey(match.number) !== numberKey(copy.number)
    || match.language !== copy.language || match.condition !== copy.condition || match.finish !== copy.finish) reasons.push("catalog_variant_mismatch");
  if (reasons.length) return result("review", [...new Set(reasons)]);
  if (typeof match === "string") throw new Error("Falta coincidencia de catalogo.");
  return { ...result("ready"), catalogId: match.catalogId, quantityDelta: 1 };
}
