import React, { useMemo, useState } from "react";
import { Copy, ListOrdered, Search, Ticket } from "lucide-react";
import { buildClaimBuyerRanking, claimBuyerListText, normalizeClaimBuyerKey, claimRaffleThresholdArs, type ClaimBuyerCard } from "@ultimoturno/domain";
import "./claim-buyers.css";

const ars = (value: number) => "$ " + value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const usd = (value: number) => "USD " + value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function ClaimBuyerRanking({ cards, exchangeRate, rateSource, rateFallback }: {
  cards: readonly ClaimBuyerCard[]; exchangeRate: number; rateSource: string; rateFallback: boolean;
}) {
  const [view, setView] = useState<"ranking" | "raffle">("ranking");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const result = useMemo(() => buildClaimBuyerRanking(cards, exchangeRate), [cards, exchangeRate]);
  const allRows = result.buyers.filter((buyer) => view === "ranking" || buyer.eligible);
  const query = normalizeClaimBuyerKey(search);
  const rows = allRows.filter((buyer) => buyer.key.includes(query));
  const missingRate = !result.rateAvailable && result.buyers.some((buyer) => buyer.totalUsd > 0);
  async function copyList() {
    setCopying(true); setFeedback(""); setCopyError(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(claimBuyerListText(result.buyers, view === "raffle"));
      setFeedback(view === "raffle" ? result.eligibleCount + " participantes copiados." : result.buyers.length + " compradores copiados.");
    } catch { setCopyError(true); setFeedback("No se pudo copiar la lista. Vuelve a intentar."); }
    finally { setCopying(false); }
  }
  return <div className="claim-buyers">
    <dl className="cb-summary">
      <div><dt>Compradores con cartas</dt><dd>{result.buyers.length}</dd></div>
      <div><dt>Participantes del sorteo</dt><dd>{result.eligibleCount}</dd></div>
      <div><dt>Minimo del sorteo</dt><dd>Mas de {ars(claimRaffleThresholdArs)}</dd></div>
    </dl>
    <div className="cb-rate"><span>USD a ARS: {result.rateAvailable ? ars(exchangeRate) : "Sin cotizacion"}</span><span>{rateSource}{rateFallback ? " · Fallback" : ""}</span></div>
    {result.issues.length ? <p className="cb-warning" role="status">Ranking provisional: {result.issues.length} asignaciones por revisar. Los importes sin precio no suman al total conocido.</p> : null}
    {missingRate ? <p className="cb-warning" role="status">Falta cotizacion para las compras en USD. Los totales mixtos quedan pendientes; el ingreso al sorteo considera solo los ARS conocidos.</p> : null}
    <div className="cb-toolbar">
      <div className="cb-modes" role="group" aria-label="Lista de compradores">
        <button type="button" aria-pressed={view === "ranking"} onClick={() => { setView("ranking"); setFeedback(""); }}><ListOrdered size={16} />Ranking</button>
        <button type="button" aria-pressed={view === "raffle"} onClick={() => { setView("raffle"); setFeedback(""); }}><Ticket size={16} />Sorteo ({result.eligibleCount})</button>
      </div>
      <label className="cb-search"><Search size={16} /><input aria-label="Buscar comprador en ranking" placeholder="Buscar comprador" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <button type="button" className="secondary-action" disabled={!allRows.length || copying} onClick={() => void copyList()}><Copy size={16} />{view === "raffle" ? "Copiar participantes" : "Copiar ranking"}</button>
    </div>
    {feedback ? <p role={copyError ? "alert" : "status"} className={"cb-feedback" + (copyError ? " cb-copy-error" : "")}>{feedback}</p> : null}
    <div className="cb-table-scroll">
      <table className="cb-table">
        <thead><tr><th scope="col">Puesto</th><th scope="col">Comprador</th><th scope="col">Cartas</th><th scope="col">ARS</th><th scope="col">USD</th><th scope="col">Total ARS</th><th scope="col">Sorteo</th></tr></thead>
        <tbody>{rows.map((buyer) => <tr key={buyer.key}>
          <td className="cb-rank"><span className="cb-cell-label">Pos.</span>{buyer.rank ?? "-"}</td>
          <th scope="row" className="cb-name">{buyer.buyer}<small>{buyer.tied ? "Empate" : ""}{buyer.tied && buyer.missingPriceUnits ? " · " : ""}{buyer.missingPriceUnits ? buyer.missingPriceUnits + " sin precio" : ""}</small></th>
          <td><span className="cb-cell-label">Cartas</span>{buyer.units}</td>
          <td><span className="cb-cell-label">ARS</span>{ars(buyer.totalArs)}</td>
          <td><span className="cb-cell-label">USD</span>{usd(buyer.totalUsd)}</td>
          <td className="cb-total"><span className="cb-cell-label">Total ARS</span>{buyer.equivalentArs === null ? "Pendiente" : ars(buyer.equivalentArs)}{buyer.missingPriceUnits ? <small>Parcial</small> : null}</td>
          <td><span className={"cb-status " + (buyer.eligible ? "cb-qualified" : "")}>{buyer.eligible ? "Participa" : buyer.missingPriceUnits || buyer.equivalentArs === null ? "Por revisar" : "No alcanza"}</span></td>
        </tr>)}</tbody>
      </table>
      {!rows.length ? <p className="cb-empty">{query ? "Sin compradores con esa busqueda." : view === "raffle" ? "Nadie supera los $ 10.000 por ahora." : "Todavia no hay cartas asignadas a compradores."}</p> : null}
    </div>
    <p className="cb-footnote">Compras asignadas del claim completo · Frees excluidos · {rows.length} de {allRows.length}{result.buyers.some((buyer) => buyer.tied) ? " · Empates sin desempate automatico" : ""}</p>
  </div>;
}
