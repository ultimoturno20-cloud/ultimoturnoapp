// Browser-safe rules shared by the local UI and its server.
export const languages = ['EN', 'ES', 'JA', 'JP', 'ZH', 'CHS', 'CHT', 'KO', 'FR', 'DE', 'IT', 'PT'];
export const conditions = ['NM', 'LP', 'MP', 'HP', 'DMG', 'GRADED'];
export function quantityValue(row) {
  const value = Number(row.quantity);
  return /^\d+$/.test(String(row.quantity)) && Number.isSafeInteger(value) && value >= 1 && value <= 100000 ? value : null;
}

export function rowErrors(row, online = false) {
  const errors = [];
  if (!row.name.trim()) errors.push('nombre');
  if (!row.expansion.trim()) errors.push('edición');
  if (!row.number.trim()) errors.push('número');
  if (quantityValue(row) === null) errors.push('cantidad entera entre 1 y 100.000');
  if (!languages.includes(row.language)) errors.push('idioma');
  if (!conditions.includes(row.condition)) errors.push('condición');
  if (!row.finish.trim()) errors.push('acabado');
  if (Boolean(row.gradingCompany?.trim()) !== Boolean(row.grade?.trim())) errors.push('certificadora y grado');
  if (row.condition === 'GRADED' && (!row.gradingCompany?.trim() || !row.grade?.trim())) errors.push('certificadora y grado de carta graduada');
  if (!row.reviewed) errors.push('revisión');
  if (online) {
    if (!row.candidate?.priceChartingId && !row.candidate?.inventoryItemId) errors.push('vínculo con catálogo');
    if (!row.candidate?.inventoryItemId && (!/^\d+(\.\d{1,2})?$/.test(String(row.priceArs)) || !Number.isFinite(Number(row.priceArs)) || Number(row.priceArs) <= 0)) errors.push('precio de venta ARS');
  }
  return errors;
}

export const rowReady = row => rowErrors(row).length === 0;

export function fillMissingDefaults(session, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Elegí los datos que querés completar.');
  if (Object.keys(input).some(k => !['language', 'condition', 'finish'].includes(k))) throw new Error('Solo se pueden completar idioma, condición y acabado en lote.');
  const defaults = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v));
  if (!Object.keys(defaults).length) throw new Error('Elegí al menos un dato para completar.');
  if (defaults.language && !languages.includes(defaults.language)) throw new Error('Idioma no admitido.');
  if (defaults.condition && !conditions.includes(defaults.condition)) throw new Error('Condición no admitida.');
  if (defaults.finish?.length > 80) throw new Error('El acabado admite hasta 80 caracteres.');
  let changedRows = 0, changedFields = 0;
  for (const row of session.rows) {
    if (row.ignored || row.transfer !== 'local') continue;
    let changed = false;
    for (const [field, value] of Object.entries(defaults)) {
      if (!String(row[field] ?? '').trim()) { row[field] = value; changed = true; changedFields++; }
    }
    if (changed) { row.candidate = null; row.reviewed = false; changedRows++; }
  }
  return { changedRows, changedFields };
}

export function rowPage(rows, { query = '', status = 'all', page = 1, pageSize = 25 } = {}) {
  if (![25, 50, 100].includes(pageSize)) throw new Error('Tamaño de página inválido.');
  const text = query.toLocaleLowerCase('es').trim();
  const filtered = rows.filter(row => {
    const matches = `${row.name} ${row.expansion} ${row.number}`.toLocaleLowerCase('es').includes(text);
    return matches && (status === 'all' || (status === 'pending' && !row.ignored && !rowReady(row)) || (status === 'ready' && !row.ignored && rowReady(row)) || (status === 'unlinked' && !row.ignored && !row.candidate) || (status === 'uncertain' && row.transfer === 'uncertain') || (status === 'ignored' && row.ignored));
  });
  const total = filtered.length, pageCount = Math.max(1, Math.ceil(total / pageSize));
  const selectedPage = Math.max(1, Math.min(pageCount, Math.trunc(Number(page)) || 1));
  const offset = (selectedPage - 1) * pageSize;
  return { rows: filtered.slice(offset, offset + pageSize), total, page: selectedPage, pageCount, from: total ? offset + 1 : 0, to: Math.min(offset + pageSize, total) };
}
