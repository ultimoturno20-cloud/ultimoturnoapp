const $ = selector => document.querySelector(selector);
const token = $('meta[name=companion-token]').content;
let state, activeId, selectedRow, lastQuery = '', working = false;
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const current = () => state.sessions.find(s => s.id === activeId);
function notice(message, error = false) { const box = $('#notice'); box.textContent = message; box.className = error ? 'error' : ''; box.style.display = 'block'; }
async function request(route, body) {
  const response = await fetch(route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Companion-Token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.'); return data;
}
async function run(action) {
  if (working) return;
  working = true; document.body.setAttribute('aria-busy', 'true');
  for (const b of document.querySelectorAll('button')) b.disabled = true;
  try { await action(); }
  catch (error) { notice(error.message, true); }
  finally {
    try { state = await request('/state'); if (!activeId) activeId = state.sessions[0]?.id; }
    catch (error) { notice('No se pudo leer la sesión local. ' + error.message, true); }
    working = false; document.body.removeAttribute('aria-busy');
    const focusedId = document.activeElement?.id;
    if (state) render();
    if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
  }
}
async function mutate(route, body = {}) { state = await request(route, { sessionId: activeId, ...body }); }
function confirmed(title, message) {
  $('#confirm-title').textContent = title; $('#confirm-message').textContent = message;
  const dialog = $('#confirm'); dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true }));
}
function ready(row) { return row.reviewed && row.name && row.expansion && row.number && /^\d+$/.test(row.quantity) && Number(row.quantity) > 0 && row.language && row.condition && row.finish; }
function render() {
  for (const b of document.querySelectorAll('button')) b.disabled = false;
  $('#connection').textContent = state.user ? 'Conectado · ' + state.user.displayName : 'Modo local';
  $('#login-form').hidden = !!state.user; $('#account').hidden = !state.user;
  $('#account-name').textContent = state.user ? `${state.user.displayName} · ${state.user.roles.includes('admin') ? 'Administrador' : 'Preparación local: esta cuenta no admite la conexión de capturas'}` : '';
  const nav = $('#sessions'); nav.replaceChildren();
  for (const session of state.sessions) {
    const b = el('button', session.name, session.id === activeId ? 'active' : '');
    b.append(el('small', `${session.rows.length} filas · ${session.appliedAt ? 'Aplicado' : 'En preparación'}`));
    b.onclick = () => { activeId = session.id; $('#filter').value = ''; render(); }; nav.append(b);
  }
  if (!state.sessions.length) nav.append(el('p', 'Todavía no hay lotes.', 'muted'));
  const session = current(); $('#empty').hidden = !!session; $('#batch').hidden = !session;
  if (!session) return;
  $('#batch-title').textContent = session.name;
  const rows = session.rows.filter(r => !r.ignored);
  const quantity = rows.reduce((sum, r) => sum + (/^\d+$/.test(r.quantity) ? Number(r.quantity) : 0), 0);
  $('#summary').textContent = `${rows.length} filas activas · ${quantity} unidades nuevas · ${rows.filter(ready).length} revisadas · ${session.location || 'Sin ubicación'}`;
  if (!$('#match')) {
    const tools = el('div', undefined, 'actions'); tools.id = 'batch-tools';
    const match = el('button', 'Vincular coincidencias exactas', 'secondary'); match.id = 'match';
    match.onclick = () => run(async () => { notice('Buscando coincidencias exactas. Puede tardar según el tamaño del lote.'); await mutate('/match'); notice('Búsqueda terminada. Las variantes dudosas quedan pendientes.'); });
    const review = el('button', 'Confirmar revisión de vinculadas', 'secondary'); review.id = 'review-matched';
    review.onclick = async () => { if (await confirmed('Confirmar filas vinculadas', 'Confirmás que revisaste las cantidades, ediciones y variantes de las filas vinculadas de todo el lote, incluidas las ocultas por filtros. Las incompletas siguen pendientes.')) run(async () => { await mutate('/review-matched'); notice('Filas completas vinculadas marcadas como revisadas.'); }); };
    tools.append(match, review); $('#summary').after(tools);
  }
  const connected = state.user?.roles.includes('admin');
  $('#match').disabled = !connected || !!session.appliedAt;
  $('#review-matched').disabled = !!session.appliedAt || !rows.some(r => r.candidate && r.transfer === 'local');
  $('#transfer').disabled = !connected || !!session.appliedAt || rows.some(r => !ready(r) || !r.candidate || r.transfer === 'uncertain') || !rows.length;
  $('#reconcile').disabled = !connected || !rows.some(r => r.transfer === 'uncertain');
  $('#apply').disabled = !connected || !!session.appliedAt || !rows.length || rows.some(r => r.transfer !== 'sent');
  $('#receipt').textContent = session.appliedAt ? `Lote confirmado el ${new Date(session.appliedAt).toLocaleString('es-AR')}. ${session.receipt.unitsApplied} unidades sumadas en esta confirmación; ${session.receipt.skippedEntries} capturas ya procesadas u omitidas. Comprobante conservado en esta PC.` : session.applyPending ? 'La última aplicación no tiene confirmación local. Podés volver a confirmar los mismos IDs: las capturas ya aplicadas no vuelven a sumar.' : rows.every(r => r.transfer === 'sent') && rows.length ? 'Capturas enviadas a Carga móvil. Falta confirmar Sumar al stock.' : 'Preparar y enviar capturas no suma existencias hasta confirmar Sumar al stock.';
  const container = $('#rows'); container.replaceChildren();
  const query = $('#filter').value.toLowerCase(); const status = $('#status-filter').value;
  for (const row of session.rows.filter(r => `${r.name} ${r.expansion} ${r.number}`.toLowerCase().includes(query) && (status === 'all' || (status === 'ready' ? ready(r) : !ready(r))))) {
    const card = el('article', undefined, 'row'); const head = el('div', undefined, 'row-head');
    head.append(el('h3', row.name || `Fila ${row.sourceRow}`), el('span', row.ignored ? 'Omitida' : row.transfer === 'uncertain' ? 'Transferencia incierta' : row.transfer === 'sent' ? 'Enviada' : ready(row) ? 'Revisada' : 'Pendiente', ready(row) ? 'good' : 'warning')); card.append(head);
    const fields = el('div', undefined, 'row-fields');
    for (const [field, label, options] of [ ['name', 'Nombre'], ['expansion', 'Edición'], ['number', 'Número'], ['quantity', 'Unidades nuevas'], ['language', 'Idioma', ['', 'EN', 'ES', 'JP', 'JA', 'ZH', 'KO', 'FR', 'DE', 'IT', 'PT']], ['condition', 'Condición', ['', 'NM', 'LP', 'MP', 'HP', 'DMG']], ['finish', 'Acabado'], ['priceArs', 'Precio ARS · altas nuevas'], ['gradingCompany', 'Certificadora · opcional'], ['grade', 'Grado · opcional'] ]) {
      const l = el('label', label); let input;
      if (options) { input = el('select'); for (const value of options) { const option = el('option', value || 'Elegir'); option.value = value; input.append(option); } }
      else { input = el('input'); input.type = 'text'; if (['quantity', 'priceArs'].includes(field)) input.inputMode = 'decimal'; }
      input.id = `row-${row.id}-${field}`; input.value = row[field] || ''; input.disabled = row.transfer !== 'local' || row.ignored;
      input.onchange = () => run(async () => { await mutate('/edit', { rowId: row.id, patch: { [field]: input.value } }); });
      l.append(input); fields.append(l);
    }
    card.append(fields);
    card.append(el('div', row.candidate ? `Vinculada: ${row.candidate.name} · ${row.candidate.expansion} #${row.candidate.number} · ${row.candidate.inventoryItemId ? 'Stock existente; conserva su precio' : 'Nueva identidad del catálogo'}` : 'Sin vínculo con el catálogo. Podés completar los datos sin conexión.', 'row-meta'));
    const actions = el('div', undefined, 'actions');
    const search = el('button', 'Vincular al catálogo', 'secondary'); search.disabled = !connected || row.transfer !== 'local' || row.ignored;
    search.onclick = () => { selectedRow = row.id; $('#search-query').value = [row.name, row.number].filter(Boolean).join(' '); $('#candidates').replaceChildren(); $('#picker').showModal(); $('#search-query').focus(); };
    actions.append(search);
    for (const [field, label] of [['reviewed', 'Revisé edición y variante'], ['ignored', 'Omitir fila']]) {
      const l = el('label', undefined, 'check'), check = el('input'); check.type = 'checkbox'; check.checked = row[field]; check.disabled = row.transfer !== 'local';
      check.onchange = () => run(async () => { await mutate('/edit', { rowId: row.id, patch: { [field]: check.checked } }); });
      l.append(check, document.createTextNode(label)); actions.append(l);
    }
    card.append(actions); container.append(card);
  }
  if (!container.childElementCount) container.append(el('p', 'No hay filas con esos filtros.', 'muted'));
}
$('#import-form').onsubmit = event => { event.preventDefault(); const form = event.currentTarget, data = new FormData(form); run(async () => { const file = data.get('file'); if (file.size > 10_000_000) throw new Error('Usá un archivo de hasta 10 MB.'); await mutate('/import', { name: data.get('name'), location: data.get('location'), text: await file.text(), filename: file.name, newPhysicalBatch: data.get('newPhysicalBatch') === 'on' }); activeId = state.sessions[0].id; form.reset(); notice('Lote guardado en esta PC. Revisá sus variantes.'); }); };
$('#demo').onclick = () => run(async () => { await mutate('/import', { name: 'Ejemplo local · no enviado', filename: 'ejemplo.csv', text: 'Name,Set,Number,Count,Language,Condition,Finish\nCarta de ejemplo,Colección de ejemplo,001,3,EN,NM,normal\nOtra carta,Colección de ejemplo,002,2,ES,LP,reverse holo' }); activeId = state.sessions[0].id; notice('Ejemplo local listo. Estas cartas ficticias no tienen vínculo y no pueden enviarse.'); });
$('#login-form').onsubmit = event => { event.preventDefault(); const form = event.currentTarget, data = new FormData(form); const credentials = { email: data.get('email'), password: data.get('password') }; form.elements.password.value = ''; run(async () => { await mutate('/login', credentials); notice('Cuenta conectada. Todavía no se escribió stock.'); }); };
$('#logout').onclick = () => run(async () => { await mutate('/logout'); notice('Cuenta desconectada.'); });
$('#filter').oninput = render; $('#status-filter').onchange = render;
$('#search-form').onsubmit = event => { event.preventDefault(); run(async () => { lastQuery = $('#search-query').value; $('#candidates').textContent = 'Buscando…'; const result = await request('/search', { sessionId: activeId, query: lastQuery }); const box = $('#candidates'); box.replaceChildren(); for (const candidate of result.candidates) { const button = el('button', undefined, 'candidate'); if (candidate.imageUrl?.startsWith('https://')) { const image = el('img'); image.src = candidate.imageUrl; image.alt = candidate.name; image.referrerPolicy = 'no-referrer'; button.append(image); } const text = el('span', `${candidate.name} · ${candidate.expansion} #${candidate.number}`); text.append(el('small', `${candidate.language} · ${candidate.condition} · ${candidate.finish} · ${candidate.inventoryItemId ? 'Stock existente' : 'Catálogo: confirmá idioma y acabado'}`)); button.append(text); button.onclick = () => run(async () => { await mutate('/choose', { rowId: selectedRow, query: lastQuery, candidateId: candidate.id }); $('#picker').close(); notice('Coincidencia elegida. Revisá variante y cantidad antes de marcar la fila.'); }); box.append(button); } if (!result.candidates.length) box.textContent = 'Sin resultados. Probá con nombre y número o edición.'; }); };
$('#transfer').onclick = async () => { const s = current(); if (await confirmed('Enviar capturas', `Se enviarán ${s.rows.filter(r => !r.ignored && r.transfer === 'local').length} filas a Carga móvil de ${state.user.displayName}. Todavía no se sumará stock.`)) run(async () => { await mutate('/transfer'); notice('Capturas enviadas. Ya podés confirmar el ingreso.'); }); };
$('#reconcile').onclick = () => run(async () => { await mutate('/reconcile'); notice('Transferencias comprobadas.'); });
$('#apply').onclick = async () => { const s = current(); if (await confirmed('Sumar unidades al stock', `Vas a confirmar ${s.rows.filter(r => !r.ignored).reduce((sum, r) => sum + Number(r.quantity), 0)} unidades nuevas del lote «${s.name}» en ${state.user.displayName}. Las capturas ya aplicadas se omiten.`)) run(async () => { await mutate('/apply'); notice('Confirmación recibida. Comprobante guardado.'); }); };
$('#backup').onclick = () => { const blob = new Blob([JSON.stringify(current(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = el('a'); a.href = url; a.download = `lote-${current().id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
run(async () => { state = await request('/state'); activeId = state.sessions[0]?.id; });
