import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Resolved from the repository when installed under tools/stock-companion.
const { parse } = require('csv-parse/sync');

const key = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function parseExport(text, filename = '') {
  let records;
  if (filename.toLowerCase().endsWith('.json') || /^[\s\uFEFF]*[\[{]/.test(text)) {
    const data = JSON.parse(text.replace(/^\uFEFF/, ''));
    records = Array.isArray(data) ? data : data.cards ?? data.items ?? data.scans;
    if (!Array.isArray(records)) throw new Error('JSON no reconocido. Usá una lista o un objeto con cards, items o scans.');
  } else {
    const first = text.replace(/^\uFEFF/, '').split(/\r?\n/)[0];
    const delimiter = [',', ';', '\t'].map(d => { try { return { d, n: parse(first, { delimiter: d })[0]?.length ?? 0 }; } catch { return { d, n: 0 }; } }).sort((a, b) => b.n - a.n)[0].d;
    records = parse(text, { bom: true, delimiter, columns: true, skip_empty_lines: true, trim: true });
  }
  if (!records.length || records.length > 10000) throw new Error('El lote debe contener entre 1 y 10.000 filas.');
  const rows = records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`Fila ${index + 1}: objeto inválido.`);
    const values = new Map(Object.entries(record).map(([k, v]) => [key(k), v]));
    const get = (...names) => names.map(n => values.get(key(n))).find(v => v !== undefined && v !== null && v !== '') ?? '';
    const quantity = get('count', 'quantity', 'quantityOnHand', 'cantidad', 'qty');
    return {
      id: randomUUID(), sourceRow: index + 1,
      name: String(get('name', 'cardName', 'nombre')), expansion: String(get('set', 'setName', 'expansion', 'edicion')),
      number: String(get('number', 'cardNumber', 'numero')), quantity: quantity === '' ? '' : String(quantity),
      language: String(get('language', 'idioma')).toUpperCase(), condition: String(get('condition', 'condicion')).toUpperCase(),
      finish: String(get('finish', 'acabado', 'variant')), priceArs: '',
      gradingCompany: String(get('gradingCompany', 'grader', 'certificadora')).toUpperCase(), grade: String(get('grade', 'grado')),
      reviewed: false, ignored: false, transfer: 'local', candidate: null
    };
  });
  if (!rows.some(r => r.name || r.expansion || r.number)) throw new Error('No encontré columnas Name/Set/Number o sus equivalentes.');
  // A conservative content receipt: formatting changes still produce the same fingerprint.
  const fingerprint = createHash('sha256').update(JSON.stringify(rows.map(({ id, ...r }) => r))).digest('hex');
  return { rows, fingerprint };
}

export function rowErrors(row, online = false) {
  const errors = [];
  if (!row.name.trim()) errors.push('nombre');
  if (!row.expansion.trim()) errors.push('edición');
  if (!row.number.trim()) errors.push('número');
  if (!/^\d+$/.test(String(row.quantity)) || !Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) < 1 || Number(row.quantity) > 100000) errors.push('cantidad entera entre 1 y 100.000');
  if (!['EN', 'ES', 'JP', 'JA', 'ZH', 'KO', 'FR', 'DE', 'IT', 'PT'].includes(row.language)) errors.push('idioma');
  if (!['NM', 'LP', 'MP', 'HP', 'DMG'].includes(row.condition)) errors.push('condición');
  if (!row.finish.trim()) errors.push('acabado');
  if (Boolean(row.gradingCompany) !== Boolean(row.grade)) errors.push('certificadora y grado');
  if (!row.reviewed) errors.push('revisión');
  if (online) {
    if (!row.candidate?.priceChartingId && !row.candidate?.inventoryItemId) errors.push('vínculo con catálogo');
    if (!row.candidate?.inventoryItemId && (!/^\d+(\.\d{1,2})?$/.test(String(row.priceArs)) || Number(row.priceArs) <= 0)) errors.push('precio de venta ARS');
  }
  return errors;
}

export function payloadFor(session, row) {
  const candidate = row.candidate;
  return {
    helperName: 'Programa compañero', matchType: candidate.inventoryItemId ? 'inventory' : 'card_index',
    inventoryItemId: candidate.inventoryItemId || undefined, priceChartingId: candidate.priceChartingId || '',
    sku: candidate.sku || '', name: row.name, expansion: row.expansion, number: row.number,
    language: row.language, condition: row.condition, finish: row.finish,
    gradingCompany: row.gradingCompany || '', grade: row.grade || '',
    quantityOnHand: Number(row.quantity), priceArs: candidate.inventoryItemId ? candidate.priceArs : Number(row.priceArs),
    priceUsd: candidate.inventoryItemId ? candidate.priceUsd : null, imageUrl: candidate.imageUrl || '',
    location: session.location, intakeBatch: session.name,
    notes: markerFor(session, row)
  };
}
export const markerFor = (session, row) => `UT-COMPANION:${session.id}:${row.id}`;

export function exactStockCandidate(row, candidates) {
  if (candidates.length >= 30) return null; // A truncated result cannot establish uniqueness.
  const norm = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  const fields = ['name', 'expansion', 'number', 'language', 'condition', 'finish', 'gradingCompany', 'grade'];
  if (rowErrors({ ...row, reviewed: true }).length) return null;
  const matches = candidates.filter(c => c.inventoryItemId && fields.every(f => norm(c[f]) === norm(row[f])));
  return matches.length === 1 ? matches[0] : null;
}

export async function transfer(session, api, save) {
  const rows = session.rows.filter(r => !r.ignored);
  if (!rows.length || rows.some(r => rowErrors(r, true).length)) throw new Error('Revisá todas las filas y vinculalas al catálogo antes de enviar.');
  for (const row of rows) {
    if (row.transfer === 'sent') continue;
    if (row.transfer !== 'local') throw new Error('Hay una transferencia incierta. Usá Comprobar transferencia; no se reenviará automáticamente.');
    row.transfer = 'uncertain';
    await save(); // Durable before making any non-idempotent request.
    const result = await api('/mobile-intake/entries', 'POST', payloadFor(session, row));
    if (!result.entry?.id) throw new Error('El servidor no confirmó la captura. Comprobá la transferencia.');
    row.entryId = result.entry.id;
    row.transfer = 'sent';
    await save();
  }
}

export async function reconcile(session, api, save) {
  const unknown = session.rows.filter(r => r.transfer === 'uncertain');
  for (const row of unknown) {
    let cursor = '', asOf = '', matches = [];
    do {
      const query = new URLSearchParams({ status: 'all', limit: '100', query: markerFor(session, row), cursor, asOf });
      const page = await api('/mobile-intake/view?' + query);
      matches.push(...page.entries.filter(e => e.notes === markerFor(session, row)));
      cursor = page.nextCursor || ''; asOf = page.asOf;
    } while (cursor);
    if (matches.length === 1) {
      row.entryId = matches[0].id; row.transfer = 'sent'; await save();
    } else if (matches.length > 1) throw new Error('Hay capturas duplicadas en el servidor. Requieren revisión en Carga móvil.');
  }
  if (session.rows.some(r => r.transfer === 'uncertain')) throw new Error('La captura todavía no aparece. El reenvío queda bloqueado para evitar duplicados; revisá Carga móvil.');
}

export function assertAccount(session, user) {
  if (!user?.roles?.includes('admin')) throw new Error('La conexión actual requiere una cuenta administradora. Podés preparar lotes sin conexión.');
  if (session.account && (session.account.userId !== user.id || session.account.businessId !== user.businessId)) throw new Error('Este lote pertenece a otra cuenta o negocio.');
}
