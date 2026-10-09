import { tournamentHeaders, tournamentRows, roundComplete, type TournamentState } from '@ultimoturno/domain';
function escapeHtml(value: unknown) { return String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function tournamentCsv(t: TournamentState) {
  const rows = [tournamentHeaders,...tournamentRows(t)];
  return '\ufeff'+rows.map((row,index) => row.map((cell,col) => {
    let s = String(cell); if (index > 0 && col === 1 && /^[=+@\-\t\r\n]/.test(s)) s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }).join(',')).join('\r\n');
}
export function tournamentPrintHtml(t: TournamentState, origin = window.location.origin) {
  const title = escapeHtml(t.name);
  const finals = t.swiss.length===t.swissCount && roundComplete(t.swiss.at(-1)!);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title} · UltimoTurno</title><style>
body{font-family:Inter,Segoe UI,Arial,sans-serif;margin:24px;color:#111}header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #f52546;padding-bottom:14px}header img{width:58px;height:58px;border-radius:8px}h1{font-size:22px}p{font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #333;padding:4px 6px;text-align:center}td:nth-child(2){text-align:left}th{height:48px;background:#f5f5f5}tr{break-inside:avoid}thead{display:table-header-group}@page{size:A4 landscape;margin:12mm}@media print{button{display:none}body{margin:0}}
</style></head><body><header><img src="${origin}/brand/ultimo-turno-logo.jpeg" alt="UltimoTurno"><div><strong>ULTIMOTURNO · TORNEOS</strong><h1>${title}</h1></div></header><p>${finals?'Posiciones finales':'Posiciones provisionales'} Swiss · ${t.players.length} jugadores · ${t.swiss.length}/${t.swissCount} rondas</p><button onclick="window.print()">Imprimir / Guardar PDF</button><table><thead><tr>${tournamentHeaders.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${tournamentRows(t).map(r=>`<tr>${r.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table><p>Flight 1 · Récord: victorias/derrotas/empates (puntos). Las posiciones Swiss son independientes del top cut.</p></body></html>`;
}
