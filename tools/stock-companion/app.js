import { languages, conditions, rowErrors, rowReady, rowPage, quantityValue } from '/batch.mjs';
const $ = selector => document.querySelector(selector);
const token = $('meta[name=companion-token]').content;
let state, activeId, selectedRow, lastQuery = '', working = false, currentPage = 1;
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
  const focusedId = document.activeElement?.id;
  const controls = [...document.querySelectorAll('button,input,select,textarea')].map(node => [node, node.disabled]);
  for (const [node] of controls) node.disabled = true;
  try { await action(); }
  catch (error) { notice(error.message, true); }
  finally {
    try { state = await request('/state'); if (!activeId) activeId = state.sessions[0]?.id; }
    catch (error) { notice('No se pudo leer la sesión local. ' + error.message, true); }
    working = false; document.body.removeAttribute('aria-busy');
    for (const [node, disabled] of controls) if (node.isConnected) node.disabled = disabled;
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
const ready = rowReady;
function selectField(label, id, values, emptyLabel) {
  const wrapper = el('label', label), select = el('select'); select.id = id;
  for (const value of values) { const option = el('option', value || emptyLabel); option.value = value; select.append(option); }
  wrapper.append(select); return wrapper;
}
function createBatchControls() {
  const form = el('form'); form.id = 'defaults-form'; form.className = 'batch-defaults';
  form.append(el('strong', 'Completar datos faltantes de todo el lote'));
  form.append(el('p', 'Aplicá un dato común a los campos vacíos. Se conservan los valores existentes y las filas ya enviadas.', 'muted'));
  const fields = el('div', undefined, 'fields');
  fields.append(selectField('Idioma del lote', 'default-language', ['', ...languages], 'No completar'), selectField('Condición del lote', 'default-condition', ['', ...conditions], 'No completar'));
  const finishLabel = el('label', 'Acabado del lote'), finish = el('input'); finish.id = 'default-finish'; finish.maxLength = 80; finish.placeholder = 'Ej.: normal · dejar vacío para no completar'; finishLabel.append(finish);
  const button = el('button', 'Completar vacíos', 'secondary'); button.id = 'fill-defaults';
  form.append(fields, finishLabel, button);
  form.onsubmit = async event => {
    event.preventDefault();
    const defaults = { language: $('#default-language').value, condition: $('#default-condition').value, finish: $('#default-finish').value.trim() };
    if (!Object.values(defaults).some(Boolean)) return notice('Elegí al menos un dato para completar.', true);
    const details = [defaults.language && `idioma ${defaults.language}`, defaults.condition && `condición ${defaults.condition}`, defaults.finish && `acabado ${defaults.finish}`].filter(Boolean).join(', ');
    if (await confirmed('Completar solo campos vacíos', `Se usará ${details} en las filas locales de todo el lote «${current().name}», incluidas las ocultas por filtros. No reemplaza valores existentes. Las filas modificadas vuelven a quedar pendientes de revisión.`)) {
      run(async () => { await mutate('/defaults', { defaults }); notice(`Datos completados en ${current().lastDefaults.changedRows} filas. Revisá las variantes antes de enviarlas.`); });
    }
  };
  $('#batch-tools').after(form);
  const size = selectField('Filas por página', 'page-size', [25, 50, 100], '');
  $('#status-filter').closest('.toolbar').append(size);
  $('#page-size').onchange = () => { currentPage = 1; render(); };
  for (const position of ['top', 'bottom']) {
    const pager = el('nav', undefined, 'pagination'); pager.setAttribute('aria-label', `Páginas de cartas · ${position === 'top' ? 'arriba' : 'abajo'}`);
    const previous = el('button', 'Anterior', 'secondary page-previous'), range = el('span', '', 'page-range'), next = el('button', 'Siguiente', 'secondary page-next');
    previous.type = next.type = 'button'; previous.setAttribute('aria-label', 'Página anterior'); next.setAttribute('aria-label', 'Página siguiente');
    previous.onclick = () => { currentPage--; render(); }; next.onclick = () => { currentPage++; render(); };
    pager.append(previous, range, next);
    if (position === 'top') $('#rows').before(pager); else $('#rows').after(pager);
  }
  const note = el('small', 'Los filtros y las páginas solo cambian lo que ves. Las acciones de revisión, envío e ingreso abarcan todo el lote.');
  $('#batch-tools').after(note);
}
function render() {
  for (const b of document.querySelectorAll('button')) b.disabled = false;
  $('#connection').textContent = state.user ? 'Conectado · ' + state.user.displayName : 'Modo local';
  $('#login-form').hidden = !!state.user; $('#account').hidden = !state.user;
  $('#account-name').textContent = state.user ? `${state.user.displayName} · ${state.user.roles.includes('admin') ? 'Administrador' : 'Preparación local: esta cuenta no admite la conexión de capturas'}` : '';
  const nav = $('#sessions'); nav.replaceChildren();
  for (const session of state.sessions) {
    const b = el('button', session.name, session.id === activeId ? 'active' : '');
    b.append(el('small', `${session.rows.length} filas · ${session.appliedAt ? 'Aplicado' : 'En preparación'}`));
    b.onclick = () => { activeId = session.id; currentPage = 1; $('#filter').value = ''; $('#defaults-form')?.reset(); render(); }; nav.append(b);
  }
  if (!state.sessions.length) nav.append(el('p', 'Todavía no hay lotes.', 'muted'));
  const session = current(); $('#empty').hidden = !!session; $('#batch').hidden = !session;
  if (!session) return;
  $('#batch-title').textContent = session.name;
  const rows = session.rows.filter(r => !r.ignored);
  const quantity = rows.reduce((sum, r) => sum + (quantityValue(r) ?? 0), 0);
  const invalidQuantities = rows.filter(r => quantityValue(r) === null).length;
  $('#summary').textContent = `${rows.length} filas activas · ${quantity} unidades nuevas${invalidQuantities ? ` · ${invalidQuantities} cantidades pendientes` : ''} · ${rows.filter(ready).length} revisadas · ${session.location || 'Sin ubicación'}`;
  if (!$('#match')) {
    const tools = el('div', undefined, 'actions'); tools.id = 'batch-tools';
    const match = el('button', 'Vincular coincidencias exactas', 'secondary'); match.id = 'match';
    match.onclick = () => run(async () => { notice('Buscando coincidencias exactas. Puede tardar según el tamaño del lote.'); await mutate('/match'); notice('Búsqueda terminada. Las variantes dudosas quedan pendientes.'); });
    const review = el('button', 'Confirmar revisión de vinculadas', 'secondary'); review.id = 'review-matched';
    review.onclick = async () => { if (await confirmed('Confirmar filas vinculadas', 'Confirmás que revisaste las cantidades, ediciones y variantes de las filas vinculadas de todo el lote, incluidas las ocultas por filtros. Las incompletas siguen pendientes.')) run(async () => { await mutate('/review-matched'); notice('Filas completas vinculadas marcadas como revisadas.'); }); };
    tools.append(match, review); $('#summary').after(tools);
    createBatchControls();
  }
  const connected = state.user?.roles.includes('admin');
  $('#match').disabled = !connected || !!session.appliedAt;
  $('#review-matched').disabled = !!session.appliedAt || !rows.some(r => r.candidate && r.transfer === 'local');
  $('#fill-defaults').disabled = !!session.appliedAt || !rows.some(r => r.transfer === 'local');
  $('#transfer').disabled = !connected || !!session.appliedAt || rows.some(r => rowErrors(r, true).length || r.transfer === 'uncertain') || !rows.length;
  $('#reconcile').disabled = !connected || !rows.some(r => r.transfer === 'uncertain');
  $('#apply').disabled = !connected || !!session.appliedAt || !rows.length || rows.some(r => r.transfer !== 'sent');
  $('#receipt').textContent = session.appliedAt ? `Lote confirmado el ${new Date(session.appliedAt).toLocaleString('es-AR')}. ${session.receipt.unitsApplied} unidades sumadas en esta confirmación; ${session.receipt.skippedEntries} capturas ya procesadas u omitidas. Comprobante conservado en esta PC.` : session.applyPending ? 'La última aplicación no tiene confirmación local. Podés volver a confirmar los mismos IDs: las capturas ya aplicadas no vuelven a sumar.' : rows.every(r => r.transfer === 'sent') && rows.length ? 'Capturas enviadas a Carga móvil. Falta confirmar Sumar al stock.' : 'Preparar y enviar capturas no suma existencias hasta confirmar Sumar al stock.';
  const container = $('#rows'); container.replaceChildren();
  const view = rowPage(session.rows, { query: $('#filter').value, status: $('#status-filter').value, page: currentPage, pageSize: Number($('#page-size').value) });
  currentPage = view.page;
  for (const label of document.querySelectorAll('.page-range')) label.textContent = `${view.from}–${view.to} de ${view.total} filas · página ${view.page}/${view.pageCount}`;
  for (const button of document.querySelectorAll('.page-previous')) button.disabled = view.page === 1;
  for (const button of document.querySelectorAll('.page-next')) button.disabled = view.page === view.pageCount;
  for (const row of view.rows) {
    const card = el('article', undefined, 'row'); const head = el('div', undefined, 'row-head');
    head.append(el('h3', row.name || `Fila ${row.sourceRow}`), el('span', row.ignored ? 'Omitida' : row.transfer === 'uncertain' ? 'Transferencia incierta' : row.transfer === 'sent' ? 'Enviada' : ready(row) ? 'Revisada' : 'Pendiente', ready(row) ? 'good' : 'warning')); card.append(head);
    const fields = el('div', undefined, 'row-fields');
    for (const [field, label, options] of [ ['name', 'Nombre'], ['expansion', 'Edición'], ['number', 'Número'], ['quantity', 'Unidades nuevas'], ['language', 'Idioma', ['', ...languages]], ['condition', 'Condición', ['', ...conditions]], ['finish', 'Acabado'], ['priceArs', 'Precio ARS · altas nuevas'], ['gradingCompany', 'Certificadora · opcional'], ['grade', 'Grado · opcional'] ]) {
      const l = el('label', label); let input;
      if (options) { input = el('select'); for (const value of options) { const option = el('option', value || 'Elegir'); option.value = value; input.append(option); } }
      else { input = el('input'); input.type = 'text'; if (['quantity', 'priceArs'].includes(field)) input.inputMode = 'decimal'; }
      input.id = `row-${row.id}-${field}`; input.setAttribute('aria-label', label); input.value = row[field] || ''; input.disabled = row.transfer !== 'local' || row.ignored;
      input.onchange = () => run(async () => { await mutate('/edit', { rowId: row.id, patch: { [field]: input.value } }); });
      l.append(input); fields.append(l);
    }
    card.append(fields);
    const errors = rowErrors(row, !!connected).filter(e => e !== 'revisión');
    if (!row.ignored && errors.length) card.append(el('p', 'Pendiente: ' + errors.join(', ') + '.', 'row-meta warning'));
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
$('#filter').oninput = () => { currentPage = 1; render(); }; $('#status-filter').onchange = () => { currentPage = 1; render(); };
$('#search-form').onsubmit = event => { event.preventDefault(); run(async () => { lastQuery = $('#search-query').value; $('#candidates').textContent = 'Buscando…'; const result = await request('/search', { sessionId: activeId, query: lastQuery }); const box = $('#candidates'); box.replaceChildren(); for (const candidate of result.candidates) { const button = el('button', undefined, 'candidate'); if (candidate.imageUrl?.startsWith('https://')) { const image = el('img'); image.src = candidate.imageUrl; image.alt = candidate.name; image.referrerPolicy = 'no-referrer'; button.append(image); } const text = el('span', `${candidate.name} · ${candidate.expansion} #${candidate.number}`); text.append(el('small', `${candidate.language} · ${candidate.condition} · ${candidate.finish} · ${candidate.inventoryItemId ? 'Stock existente' : 'Catálogo: confirmá idioma y acabado'}`)); button.append(text); button.onclick = () => run(async () => { await mutate('/choose', { rowId: selectedRow, query: lastQuery, candidateId: candidate.id }); $('#picker').close(); notice('Coincidencia elegida. Revisá variante y cantidad antes de marcar la fila.'); }); box.append(button); } if (!result.candidates.length) box.textContent = 'Sin resultados. Probá con nombre y número o edición.'; }); };
$('#transfer').onclick = async () => { const s = current(); if (await confirmed('Enviar capturas', `Se enviarán ${s.rows.filter(r => !r.ignored && r.transfer === 'local').length} filas a Carga móvil de ${state.user.displayName}. Todavía no se sumará stock.`)) run(async () => { await mutate('/transfer'); notice('Capturas enviadas. Ya podés confirmar el ingreso.'); }); };
$('#reconcile').onclick = () => run(async () => { await mutate('/reconcile'); notice('Transferencias comprobadas.'); });
$('#apply').onclick = async () => { const s = current(); if (await confirmed('Sumar unidades al stock', `Vas a confirmar ${s.rows.filter(r => !r.ignored).reduce((sum, r) => sum + Number(r.quantity), 0)} unidades nuevas del lote «${s.name}» en ${state.user.displayName}. Las capturas ya aplicadas se omiten.`)) run(async () => { await mutate('/apply'); notice('Confirmación recibida. Comprobante guardado.'); }); };
$('#backup').onclick = () => { const blob = new Blob([JSON.stringify(current(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = el('a'); a.href = url; a.download = `lote-${current().id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
run(async () => { state = await request('/state'); activeId = state.sessions[0]?.id; });
