import { rowErrors, rowPage, quantityValue } from '/batch.mjs';
const $ = query => document.querySelector(query);
const token = $('meta[name=companion-token]').content;
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
let state, working = false, page = 1, frameUrl, frameAt, pickedRow, searchQuery = '', showRemoved = false;
const session = () => state?.sessions.find(s => s.id === state.androidSessionId) || state?.sessions[0];
const headers = { 'Content-Type': 'application/json', 'X-Companion-Token': token };
async function api(route, body) {
  const response = await fetch(route, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.'); return result;
}
const mutate = async (route, body = {}) => { state = await api(route, { sessionId: session()?.id, ...body }); };
function notice(text, error = false) { $('#notice').textContent = text; $('#notice').className = error ? 'error' : ''; $('#notice').hidden = false; }
async function run(action) {
  if (working) return;
  working = true; document.body.setAttribute('aria-busy', 'true');
  const focusedId = document.activeElement?.id;
  const controls = [...document.querySelectorAll('input,select,button')].map(el => [el, el.disabled]); controls.forEach(([el]) => { el.disabled = true; });
  try { await action(); } catch (error) { notice(error.message, true); }
  finally {
    try { state = await api('/state'); } catch (error) { notice(error.message, true); }
    working = false; document.body.removeAttribute('aria-busy'); controls.forEach(([el, disabled]) => { if (el.isConnected) el.disabled = disabled; });
    if (state) render(true); if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
  }
}
function render(force = false) {
  const current = session(), status = state.android || {};
  $('#phone-state').textContent = status.connected ? 'Pixel conectado' : 'Desconectado';
  $('#phone-message').textContent = status.message || 'Conectá Monprice para empezar.';
  $('#connect-form').hidden = !!status.connected;
  $('#connect').textContent = current?.source === 'android' && !current.appliedAt ? 'Continuar Monprice' : 'Conectar Monprice';
  $('#phone-back').disabled = !status.connected; $('#stop').disabled = !status.connected;
  $('#account-button').textContent = state.user ? state.user.displayName : 'Conectar cuenta';
  $('#login-form').hidden = !!state.user; $('#logged-in').hidden = !state.user; $('#user-name').textContent = state.user ? `${state.user.displayName} · ${state.user.roles.includes('admin') ? 'Administrador' : 'Esta cuenta no admite envío de capturas'}` : '';
  const rows = current?.rows.filter(r => !r.ignored) || [];
  const removedCount = current?.rows.filter(r => r.ignored).length || 0;
  if (!removedCount) showRemoved = false;
  $('#removed').hidden = !removedCount;
  $('#removed').textContent = showRemoved ? 'Volver a las cartas' : `Ver eliminadas (${removedCount})`;
  $('#removed').setAttribute('aria-pressed', String(showRemoved));
  const quantity = rows.reduce((sum, r) => sum + (quantityValue(r) || 0), 0);
  $('#unit-total').textContent = `${quantity} unidades`;
  $('#batch-name').textContent = current ? `${current.name} · ${rows.length} cartas${current.androidSyncedAt ? ' · lista copiada de Monprice' : ''}` : 'La lista aparecerá cuando Monprice reconozca una carta.';
  $('#advanced').href = '/batches' + (current ? '?session=' + encodeURIComponent(current.id) : '');
  $('#finalize').disabled = !current || current.source !== 'android' || !status.connected || !!current.androidFinalized || !!current.appliedAt;
  $('#match').disabled = !current || !rows.length || !state.user?.roles.includes('admin') || !!current.appliedAt;
  $('#send').disabled = !current || !rows.length || !!current.appliedAt;
  $('#recover').hidden = !rows.some(r => r.transfer === 'uncertain');
  $('#review-message').textContent = current?.appliedAt ? 'Lote enviado. Para otro lote, iniciá una sesión de escaneo vacía en Monprice.' : current?.androidFinalized ? 'Captura comprobada. Revisá cantidades y vínculos antes de enviar.' : 'Vista previa del escáner: una fila por carta reconocida. Cantidades y acabados se completan al terminar; tus cantidades editadas se conservan.';
  $('#receipt').textContent = current?.appliedAt ? `${current.receipt.unitsApplied} unidades sumadas en la confirmación; ${current.receipt.skippedEntries} capturas ya procesadas u omitidas. Comprobante guardado.` : current?.applyPending ? 'La confirmación anterior quedó sin respuesta. Enviar vuelve a comprobar los mismos IDs.' : '';
  if (!force && document.activeElement?.closest('#queue')) return;
  const visible = (current?.rows || []).filter(row => showRemoved ? row.ignored : !row.ignored);
  const view = rowPage(visible, { query: $('#filter').value, page, pageSize: 25 }); page = view.page;
  $('#range').textContent = `${view.from}–${view.to} de ${view.total} cartas`; $('#previous').disabled = page === 1; $('#next').disabled = page === view.pageCount;
  const body = $('#queue'); body.replaceChildren(); $('#empty').hidden = !!view.rows.length;
  $('#empty').textContent = $('#filter').value ? 'No hay cartas que coincidan con la búsqueda.' : showRemoved ? 'No hay cartas eliminadas.' : 'Escaneá tu primera carta. También podés restaurar las cartas eliminadas.';
  for (const row of view.rows) {
    const tr = node('tr'); tr.dataset.rowId = row.id;
    const identity = node('td'); identity.append(node('strong', row.name), node('small', row.expansion), node('small', `#${row.number}`));
    if (row.scannerPreview) identity.append(node('small', 'Vista previa · cantidad y acabado por comprobar', 'status'));
    if (row.sourceCorrection) identity.append(node('small', row.identityCorrected ? 'Corrección manual conservada' : 'Corregida en Monprice', 'good'));
    const variant = node('td'); variant.append(node('span', `${row.language} · ${row.finish || 'Acabado pendiente'}`), node('small', row.gradingCompany ? `${row.gradingCompany} ${row.grade}` : row.condition));
    const quantityCell = node('td'), editor = node('div', undefined, 'quantity-edit'), minus = node('button', '−', 'secondary'), plus = node('button', '+', 'secondary'), input = node('input');
    input.id = `quantity-${row.id}`; input.value = row.quantity; input.inputMode = 'numeric'; input.setAttribute('aria-label', `Cantidad de ${row.name}`);
    const locked = row.transfer !== 'local' || !!current.appliedAt || row.ignored; input.disabled = minus.disabled = plus.disabled = locked;
    minus.setAttribute('aria-label', `Restar una unidad de ${row.name}`); plus.setAttribute('aria-label', `Sumar una unidad de ${row.name}`);
    const editQuantity = value => run(async () => { await mutate('/edit', { rowId: row.id, patch: { quantity: String(value) } }); });
    input.onchange = () => editQuantity(input.value); minus.onclick = () => editQuantity(Math.max(1, (quantityValue(row) || 1) - 1)); plus.onclick = () => editQuantity(Math.min(100000, (quantityValue(row) || 0) + 1));
    editor.append(minus, input, plus); quantityCell.append(editor);
    if (row.sourceQuantity !== undefined) quantityCell.append(node('small', `Monprice: ${row.sourceQuantity}${row.quantityEdited ? ' · editada' : ''}`));
    const review = node('td');
    const errors = rowErrors({ ...row, reviewed: true }, true); if (row.gradingPending) errors.push('graduación');
    review.append(node('span', row.ignored ? 'Eliminada de este lote' : row.transfer === 'sent' ? 'Enviada' : errors.length ? errors.join(', ') : 'Vinculada', errors.length ? 'status' : 'status good'));
    const choose = node('button', row.candidate ? 'Cambiar vínculo' : 'Vincular', 'secondary'); choose.disabled = locked || !state.user?.roles.includes('admin');
    choose.onclick = () => { pickedRow = row.id; $('#search-query').value = `${row.name} ${row.number.split('/')[0]}`; $('#candidates').replaceChildren(); $('#picker').showModal(); $('#search-query').focus(); };
    const actions = node('div', undefined, 'row-actions'), remove = node('button', row.ignored ? 'Restaurar' : 'Eliminar', row.ignored ? 'secondary' : 'secondary remove-card');
    remove.setAttribute('aria-label', `${row.ignored ? 'Restaurar' : 'Eliminar'} ${row.name} del lote`);
    remove.title = 'Solo afecta este lote de carga.';
    remove.disabled = row.transfer !== 'local' || !!current.appliedAt;
    remove.onclick = () => run(async () => { await mutate('/edit', { rowId: row.id, patch: { ignored: !row.ignored } }); notice(row.ignored ? 'Carta restaurada.' : 'Carta eliminada del lote. Podés restaurarla desde «Ver eliminadas».'); });
    actions.append(choose, remove); review.append(actions);
    if (row.candidate && !row.candidate.inventoryItemId) {
      const label = node('label', 'Precio de venta ARS', 'price-edit'), price = node('input'); price.id = `price-${row.id}`; price.value = row.priceArs; price.inputMode = 'decimal'; price.disabled = locked;
      price.onchange = () => run(async () => { await mutate('/edit', { rowId: row.id, patch: { priceArs: price.value } }); }); label.append(price); review.append(label);
    }
    tr.append(identity, variant, quantityCell, review); body.append(tr);
  }
}
async function imageFrame() {
  if (!state?.android?.connected || state.android.frameAt === frameAt) return;
  frameAt = state.android.frameAt;
  const response = await fetch('/android/frame', { headers: { 'X-Companion-Token': token } });
  if (!response.ok) { $('#phone-frame').hidden = true; $('#phone-placeholder').hidden = false; return; }
  const url = URL.createObjectURL(await response.blob());
  if (frameUrl) URL.revokeObjectURL(frameUrl); frameUrl = url;
  $('#phone-frame').src = url; $('#phone-frame').hidden = false; $('#phone-placeholder').hidden = true;
}
async function poll() {
  if (!working) try { state = await api('/state'); render(); await imageFrame(); } catch (error) { notice('No se pudo actualizar el programa. ' + error.message, true); }
  setTimeout(poll, 500);
}
$('#connect-form').onsubmit = event => { event.preventDefault(); const form = new FormData(event.currentTarget); run(async () => { notice('Conectando con el Pixel y leyendo Monprice…'); await mutate('/android/start', { name: form.get('name'), language: form.get('language'), condition: form.get('condition') }); page = 1; notice('Monprice conectado. Podés escanear desde esta pantalla.'); await imageFrame(); }); };
$('#stop').onclick = () => run(async () => { await mutate('/android/stop'); $('#phone-frame').hidden = true; $('#phone-placeholder').hidden = false; notice('Pixel desconectado. El lote sigue guardado.'); });
$('#phone-back').onclick = () => run(async () => { await mutate('/android/input', { back: true }); await imageFrame(); });
$('#phone-frame').onclick = event => { if (working) return; const bounds = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - bounds.left) / bounds.width, y = (event.clientY - bounds.top) / bounds.height; run(async () => { await mutate('/android/input', { x, y }); await imageFrame(); }); };
$('#finalize').onclick = () => run(async () => { notice('Comprobando la lista completa de Monprice…'); await mutate('/android/finalize'); if (state.user?.roles.includes('admin')) await mutate('/match'); notice('Captura terminada. Revisá las cantidades y los vínculos.'); });
$('#match').onclick = () => run(async () => { notice('Buscando coincidencias exactas…'); await mutate('/match'); notice('Coincidencias actualizadas. Las cartas pendientes se vinculan desde la lista.'); });
$('#recover').onclick = () => run(async () => { await mutate('/reconcile'); notice('Transferencia comprobada.'); });
$('#filter').oninput = () => { page = 1; render(true); }; $('#previous').onclick = () => { page--; render(true); }; $('#next').onclick = () => { page++; render(true); };
$('#removed').onclick = () => { showRemoved = !showRemoved; page = 1; render(true); };
$('#account-button').onclick = () => $('#login-dialog').showModal();
$('#login-form').onsubmit = event => { event.preventDefault(); const form = event.currentTarget, data = new FormData(form); const credentials = { email: data.get('email'), password: data.get('password') }; form.elements.password.value = ''; run(async () => { await mutate('/login', credentials); $('#login-dialog').close(); notice('Cuenta conectada.'); }); };
$('#logout').onclick = () => run(async () => { await mutate('/logout'); $('#login-dialog').close(); notice('Cuenta desconectada.'); });
$('#search-form').onsubmit = event => { event.preventDefault(); run(async () => {
  searchQuery = $('#search-query').value; const result = await api('/search', { sessionId: session().id, query: searchQuery }); const box = $('#candidates'); box.replaceChildren();
  for (const candidate of result.candidates) {
    const button = node('button', `${candidate.name} · ${candidate.expansion} #${candidate.number}`); button.append(node('small', `${candidate.language} · ${candidate.condition} · ${candidate.finish} ${candidate.gradingCompany || ''} ${candidate.grade || ''}`));
    button.onclick = () => run(async () => { await mutate('/choose', { rowId: pickedRow, query: searchQuery, candidateId: candidate.id }); $('#picker').close(); notice('Carta vinculada.'); }); box.append(button);
  }
  if (!result.candidates.length) box.textContent = 'No encontré coincidencias. Probá con nombre y edición.';
}); };
$('#send').onclick = () => {
  if (!state.user?.roles.includes('admin')) { $('#login-dialog').showModal(); return notice('Conectá una cuenta administradora para enviar el lote.', true); }
  run(async () => {
    if (session().source === 'android' && !session().androidFinalized) { notice('Comprobando la lista completa de Monprice…'); await mutate('/android/finalize'); }
    if (session().rows.some(r => !r.ignored && r.transfer === 'local' && !r.candidate)) await mutate('/match');
    const rows = session().rows.filter(r => !r.ignored);
    if (rows.some(r => rowErrors({ ...r, reviewed: true }, true).length || r.gradingPending)) return notice('Completá los vínculos y los datos pendientes que aparecen en la lista antes de enviar.', true);
    render(true);
    $('#confirm-message').textContent = `Se sumarán ${rows.reduce((sum, r) => sum + Number(r.quantity), 0)} unidades del lote «${session().name}» en la cuenta ${state.user.displayName}. Las capturas ya aplicadas no vuelven a sumar.`;
    $('#confirm').returnValue = ''; $('#confirm').showModal();
  });
};
$('#confirm').addEventListener('close', () => { if ($('#confirm').returnValue === 'ok') run(async () => { notice('Enviando el lote a UltimoTurno…'); await mutate('/review-matched'); await mutate('/send'); notice('Lote confirmado. Comprobante guardado.'); }); });
poll();
