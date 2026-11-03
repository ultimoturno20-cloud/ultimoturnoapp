import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const execute = promisify(execFile);
const appPackage = 'com.sarafan.pokemon';
const decode = text => String(text || '').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (_, entity) => {
  if (entity.startsWith('#')) { const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
  return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[entity.toLowerCase()];
});
export function parseHierarchy(xml) {
  if (xml.length > 4_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Respuesta Android no admitida.');
  const root = { attrs: {}, children: [] }, stack = [root];
  for (const match of xml.matchAll(/<node\b[^>]*>|<\/node>/g)) {
    if (match[0] === '</node>') { if (stack.length < 2) throw new Error('Pantalla Android incompleta.'); stack.pop(); continue; }
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]));
    const node = { attrs, children: [], parent: stack.at(-1) }; node.parent.children.push(node);
    if (!match[0].endsWith('/>')) stack.push(node);
  }
  if (stack.length !== 1 || !root.children.length) throw new Error('Pantalla Android incompleta.');
  if (root.children[0].attrs.package !== appPackage) throw new Error('Abrí Monprice en el Pixel para continuar.');
  return root;
}
const flatten = node => [node, ...node.children.flatMap(flatten)];
const texts = node => flatten(node).map(n => n.attrs.text).filter(Boolean);
const valueAfter = (list, labels) => { const index = list.findIndex(t => labels.includes(t)); return index < 0 ? '' : list[index + 1] || ''; };
export const sourceKey = row => JSON.stringify([row.name, row.expansion, row.number, row.language, row.finish, row.gradingCompany || '', row.grade || '']);
function bounds(node) {
  const n = node?.attrs.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/)?.slice(1).map(Number);
  if (!n || n[2] <= n[0] || n[3] <= n[1]) throw new Error('Control de Monprice no disponible.');
  return n;
}
const languages = { 'Inglés': 'EN', 'English': 'EN', 'Español': 'ES', 'Spanish': 'ES', 'Japonés': 'JA', 'Japanese': 'JA', 'Chino': 'ZH', 'Chinese': 'ZH' };
export function monpriceFinish(value) {
  const text = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (/\bmaster\s*ball\b/.test(text)) return 'master ball';
  if (/\bpoke\s*ball\b/.test(text)) return 'poke ball';
  return text;
}
export function readMonprice(root, language) {
  const nodes = flatten(root), all = texts(root);
  const list = all.includes('Cartas Escaneadas') || all.includes('Scanned Cards');
  const settings = nodes.find(n => n.attrs['content-desc'] === 'settings');
  const selectedLanguage = nodes.map(n => languages[n.attrs['content-desc']]).find(Boolean);
  const readIdentity = values => ({ name: valueAfter(values, ['Nombre', 'Name']), expansion: valueAfter(values, ['Establecer', 'Set']), number: valueAfter(values, ['Número', 'Number']) });
  const identity = readIdentity(all);
  const correction = all.includes('Which card is it?') || all.some(value => /reverse holo (?:poke|master) ball/i.test(value));
  if (!list) return { mode: settings ? 'scanner' : correction ? 'correction' : 'other', language: selectedLanguage, empty: all.includes('0 tarjetas') || all.includes('0 cards'), latest: identity.name && identity.expansion && identity.number ? identity : null, next: nodes.find(n => n.attrs['content-desc'] === 'next icon') };
  const totalText = valueAfter(all, ['Cantidad', 'Quantity']);
  if (!/^\d+$/.test(totalText)) throw new Error('Monprice no mostró la cantidad total de la lista.');
  const rows = [], seenParents = new Set();
  for (const name of nodes.filter(n => ['Nombre', 'Name'].includes(n.attrs.text))) {
    let container = name.parent;
    while (container && !flatten(container).some(n => n.attrs['content-desc'] === 'Decrease count')) container = container.parent;
    if (!container || seenParents.has(container)) continue;
    if (flatten(container).filter(n => ['Nombre', 'Name'].includes(n.attrs.text)).length !== 1) continue;
    seenParents.add(container);
    const inner = flatten(container), labels = texts(container), card = readIdentity(labels);
    const decrease = inner.findIndex(n => n.attrs['content-desc'] === 'Decrease count');
    const quantity = inner.slice(decrease + 1).find(n => /^\d+$/.test(n.attrs.text || ''))?.attrs.text;
    const type = valueAfter(labels, ['Tipo:', 'Type:', 'Tipo', 'Type']);
    const raw = inner.some(n => n.attrs['content-desc'] === 'RAW' || n.attrs.text === 'RAW');
    // Never guess a grade or conflate Foil with Reverse Holo.
    const finish = monpriceFinish(type);
    if (card.name && card.expansion && card.number && quantity && finish) rows.push({ ...card, quantity: Number(quantity), language, finish, gradingCompany: '', grade: '', gradingPending: !raw, bounds: container.attrs.bounds });
  }
  return { mode: 'list', total: Number(totalText), rows, scroll: nodes.find(n => n.attrs.scrollable === 'true' && flatten(n).some(c => ['Nombre', 'Name'].includes(c.attrs.text))) };
}

export function mergeSnapshot(session, sourceRows) {
  if (session.appliedAt || session.rows.some(r => r.transfer !== 'local')) throw new Error('Este lote ya comenzó a enviarse. No se modifica su captura.');
  const existing = new Map(session.rows.filter(r => r.androidKey).map(r => [r.androidKey, r]));
  const incomingKeys = new Set(sourceRows.map(sourceKey));
  const removed = [...existing.values()].filter(row => !incomingKeys.has(row.androidKey));
  const added = sourceRows.filter(row => !existing.has(sourceKey(row)));
  const family = value => String(value || '').normalize('NFKC').trim().toLowerCase();
  // Monprice can replace the chosen printing in the same scan slot. A unique
  // one-for-one replacement with unchanged name/language/source quantity is
  // treated as a source correction; it never creates an extra physical unit.
  const replacement = removed.length === 1 && added.length === 1 &&
    family(removed[0].androidSnapshotName || removed[0].name) === family(added[0].name) &&
    removed[0].sourceQuantity === added[0].quantity &&
    removed[0].language === added[0].language ? removed[0] : null;
  if (removed.some(row => row !== replacement && (row.quantityEdited || row.candidate))) throw new Error('La lista de Monprice cambió y quitaría una fila editada. Revisá el lote antes de continuar.');
  const next = sourceRows.map(source => {
    const key = sourceKey(source), old = existing.get(key) || (replacement && added[0] === source ? replacement : null);
    if (old) {
      const row = { ...old };
      if (row.androidKey !== key) {
        row.sourceCorrection = { name: old.androidSnapshotName || old.name, expansion: session.androidSnapshot?.find(r => sourceKey(r) === old.androidKey)?.expansion || old.expansion, number: session.androidSnapshot?.find(r => sourceKey(r) === old.androidKey)?.number || old.number };
        if (!row.identityCorrected) {
          Object.assign(row, { name: source.name, expansion: source.expansion, number: source.number, language: source.language, finish: source.finish, gradingCompany: source.gradingCompany, grade: source.grade, gradingPending: source.gradingPending, candidate: null, priceArs: '' });
        }
        row.androidKey = key; row.reviewed = false;
      }
      if (row.sourceQuantity !== source.quantity) { if (!row.quantityEdited) row.quantity = String(source.quantity); row.reviewed = false; }
      row.sourceQuantity = source.quantity; row.androidSnapshotName = source.name; return row;
    }
    return { id: randomUUID(), sourceRow: 0, ...source, androidSnapshotName: source.name, quantity: String(source.quantity), sourceQuantity: source.quantity, androidKey: key, condition: session.androidCondition, priceArs: '', candidate: null, reviewed: false, ignored: false, transfer: 'local', gradingPending: source.gradingPending };
  });
  session.rows = [...session.rows.filter(r => !r.androidKey), ...next];
  session.androidSnapshot = sourceRows;
  session.androidSyncedAt = new Date().toISOString();
}

async function findAdb() {
  const candidates = [process.env.COMPANION_ADB_PATH];
  try { candidates.push(...String((await execute(process.platform === 'win32' ? 'where.exe' : 'which', ['adb'], { windowsHide: true })).stdout).trim().split(/\r?\n/)); } catch { /* use scrcpy installation */ }
  if (process.platform === 'win32') {
    try {
      const script = 'Get-Process -Name scrcpy -ErrorAction SilentlyContinue | ForEach-Object { if ($_.Path) { Join-Path (Split-Path -Parent $_.Path) "adb.exe" } }';
      candidates.push(...String((await execute('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true })).stdout).trim().split(/\r?\n/));
    } catch { /* report a useful configuration message below */ }
  }
  for (const candidate of candidates.filter(Boolean)) {
    if (!path.isAbsolute(candidate) || !['adb', 'adb.exe'].includes(path.basename(candidate).toLowerCase())) continue;
    try { await access(candidate); return candidate; } catch { /* try next */ }
  }
  throw new Error('No encontré ADB. Abrí scrcpy o configurá COMPANION_ADB_PATH con la ruta de adb.exe.');
}

export class AndroidBridge {
  constructor({ onSnapshot, adbPath, executeAdb, interval = 1000 } = {}) {
    this.onSnapshot = onSnapshot; this.adbPath = adbPath; this.executeAdb = executeAdb; this.interval = interval;
    this.status = { connected: false, mode: 'off', message: 'Conectá el Pixel con Monprice abierto.' };
  }
  async run(args, binary = false) {
    if (this.executeAdb) return this.executeAdb(args, binary);
    const result = await execute(this.adbPath, [...(this.serial ? ['-s', this.serial] : []), ...args], { windowsHide: true, timeout: 20000, maxBuffer: 16_000_000, encoding: binary ? 'buffer' : 'utf8' });
    return result.stdout;
  }
  async ui() {
    const file = `/data/local/tmp/ultimoturno-companion-${process.pid}.xml`;
    await this.run(['shell', 'uiautomator', 'dump', file]);
    this.root = parseHierarchy(String(await this.run(['exec-out', 'cat', file])));
    return readMonprice(this.root, this.language);
  }
  async start(language, { allowExisting = true, reviewOnly = false } = {}) {
    await this.stop(); this.language = language; this.lastLatest = null; this.finalized = reviewOnly;
    this.adbPath ||= this.executeAdb ? 'test-adb' : await findAdb();
    const devices = String(await this.run(['devices', '-l'])).split(/\r?\n/).filter(l => /^\S+\s+device\b/.test(l));
    if (devices.length !== 1) throw new Error('Conectá y autorizá un solo teléfono Android para capturar.');
    this.serial = devices[0].split(/\s+/)[0];
    const screen = await this.ui();
    if (screen.language && screen.language !== language) throw new Error('El idioma seleccionado no coincide con Monprice.');
    if (!allowExisting && !(screen.empty || (screen.mode === 'list' && screen.total === 0))) throw new Error('Para otro lote, iniciá una sesión de escaneo vacía en Monprice.');
    if (!['scanner', 'list', 'correction'].includes(screen.mode)) throw new Error('Abrí el escáner o la lista de cartas escaneadas de Monprice.');
    this.status = { connected: true, mode: 'capture', message: 'Leyendo Monprice. Las cantidades se copian de su lista.' };
    await this.tick(); this.schedule();
  }
  schedule() { clearTimeout(this.timer); if (this.status.connected && !this.suspended) { this.timer = setTimeout(() => { this.tick().finally(() => this.schedule()); }, this.interval); this.timer.unref?.(); } }
  async pause() { this.suspended = true; clearTimeout(this.timer); if (this.pending) await this.pending; }
  resume() { this.suspended = false; this.schedule(); }
  async tick() {
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const screen = await this.ui();
        if (screen.language && screen.language !== this.language) throw new Error('Cambió el idioma en Monprice. Elegí el idioma correcto para continuar.');
        if (!this.finalized && screen.mode === 'scanner' && screen.latest && JSON.stringify(screen.latest) !== this.lastLatest) {
          this.status.message = 'Copiando la lista de Monprice…';
          await this.sync(true); this.lastLatest = JSON.stringify(screen.latest);
        } else if (!this.finalized && screen.mode === 'list') await this.sync(false);
        this.frame = await this.run(['exec-out', 'screencap', '-p'], true);
        this.status.frameAt = Date.now();
        this.status.message = this.finalized ? 'Captura terminada. Revisá cantidades y enviá el lote.' : 'Monprice conectado. Escaneá la siguiente carta.';
        this.status.error = null;
      } catch (error) { this.frame = null; this.status.frameAt = Date.now(); this.status.error = error.message; this.status.message = error.message; }
    })();
    try { await this.pending; } finally { this.pending = null; }
  }
  async tapNode(node) { const [x1, y1, x2, y2] = bounds(node); await this.run(['shell', 'input', 'tap', String(Math.round((x1 + x2) / 2)), String(Math.round((y1 + y2) / 2))]); }
  async sync(returnToScanner) {
    let screen = await this.ui();
    if (screen.mode === 'scanner') { if (!screen.next) throw new Error('Monprice todavía no tiene una lista de escaneos.'); await this.tapNode(screen.next); screen = await this.ui(); }
    if (screen.mode !== 'list') throw new Error('Abrí la lista de cartas escaneadas en Monprice.');
    const expected = screen.total, found = new Map(), pageSignatures = new Set();
    for (let page = 0; page < 200; page++) {
      if (screen.total !== expected) throw new Error('La cantidad de Monprice cambió durante la lectura. Volvé a copiar la lista.');
      const pageKeys = new Set();
      for (const row of screen.rows) {
        const key = sourceKey(row);
        if (pageKeys.has(key)) throw new Error('Monprice muestra dos filas idénticas. Revisá la lista o usá su exportación.');
        pageKeys.add(key);
        if (found.has(key) && found.get(key).quantity !== row.quantity) throw new Error('Cambió una cantidad de Monprice. Volvé a copiar la lista.');
        found.set(key, row);
      }
      const units = [...found.values()].reduce((sum, r) => sum + r.quantity, 0);
      this.status.message = `Copiando Monprice: ${units}/${expected} unidades…`;
      if (units === expected) {
        await this.onSnapshot?.([...found.values()].map(({ bounds: unused, ...row }) => row));
        if (returnToScanner) await this.run(['shell', 'input', 'keyevent', '4']);
        return;
      }
      if (units > expected) throw new Error('La lista leída no coincide con la cantidad total de Monprice.');
      const signature = JSON.stringify(screen.rows.map(r => [sourceKey(r), r.quantity, r.bounds]));
      if (pageSignatures.has(signature) || !screen.scroll) throw new Error('No pude leer toda la lista de Monprice. No se enviará una lista parcial.');
      pageSignatures.add(signature);
      const [x1, y1, x2, y2] = bounds(screen.scroll);
      await this.run(['shell', 'input', 'swipe', String(Math.round((x1 + x2) / 2)), String(Math.round(y1 + (y2 - y1) * .8)), String(Math.round((x1 + x2) / 2)), String(Math.round(y1 + (y2 - y1) * .35)), '300']);
      screen = await this.ui();
    }
    throw new Error('La lista supera la lectura automática admitida. Usá la exportación CSV de Monprice.');
  }
  async finalize() {
    clearTimeout(this.timer); if (this.pending) await this.pending;
    try { await this.sync(false); this.finalized = true; this.status.mode = 'review'; this.status.error = null; this.frame = await this.run(['exec-out', 'screencap', '-p'], true); }
    finally { this.schedule(); }
  }
  async input({ x, y, back = false }) {
    clearTimeout(this.timer); if (this.pending) await this.pending;
    try {
      await this.ui();
      if (back) await this.run(['shell', 'input', 'keyevent', '4']);
      else {
        if (!this.frame || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 1 || y > 1) throw new Error('Coordenadas no válidas.');
        const width = this.frame.readUInt32BE(16), height = this.frame.readUInt32BE(20);
        await this.run(['shell', 'input', 'tap', String(Math.min(width - 1, Math.round(x * width))), String(Math.min(height - 1, Math.round(y * height)))]);
      }
      await this.tick();
    } finally { this.schedule(); }
  }
  async stop() {
    clearTimeout(this.timer); this.status.connected = false; if (this.pending) await this.pending;
    if (this.serial) { try { await this.run(['shell', 'rm', '-f', `/data/local/tmp/ultimoturno-companion-${process.pid}.xml`]); } catch { /* disconnected phone; no retry */ } }
    this.serial = null; this.frame = null; this.status = { connected: false, mode: 'off', message: 'Captura detenida. El lote sigue guardado en esta PC.' };
  }
}
