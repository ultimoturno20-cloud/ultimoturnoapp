import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExport, rowErrors, transfer, reconcile, assertAccount, markerFor, payloadFor, exactStockCandidate } from './core.mjs';

const valid = () => ({ ...parseExport('Name,Set,Number,Count,Language,Condition,Finish\nExample,Test,001,3,EN,NM,normal').rows[0], reviewed: true, candidate: { id: 'i', inventoryItemId: 'i', priceChartingId: 'pc', priceArs: 1200, priceUsd: 1 } });
const session = () => ({ id: 'session-qa', name: 'QA synthetic', location: 'A', rows: [valid()] });

test('CSV handles BOM, separators, quoted delimiters, escaped quotes, multiline values and leading zeroes', () => {
  const { rows } = parseExport('\uFEFFName;Set;Number;Count\n"Example; \"\"A\"\"";"Set\nOne";001;2');
  assert.equal(rows[0].name, 'Example; "A"'); assert.equal(rows[0].expansion, 'Set\nOne'); assert.equal(rows[0].number, '001');
  assert.equal(parseExport('Name\tSet\tNumber\tCount\nA\tB\t003\t1').rows[0].quantity, '1');
  assert.equal(parseExport('"Name","Set","Number","Count"\nA,B,003,1').rows[0].number, '003');
});
test('JSON accepts supported wrappers and aliases; unsupported nested schema fails clearly', () => {
  assert.equal(parseExport(JSON.stringify({ cards: [{ nombre: 'A', edicion: 'B', numero: '003', cantidad: 2 }] }), 'a.json').rows[0].number, '003');
  assert.throws(() => parseExport('{"collection":{}}', 'a.json'), /JSON no reconocido/);
  assert.throws(() => parseExport('Unknown,Count\nhello,2'), /columnas/);
  assert.throws(() => parseExport('Name,Count\n"broken,2'), /Quote/);
});
test('quantity never silently defaults, rounds or accepts zero, negatives, exponent notation or overflow', () => {
  for (const quantity of ['', '0', '-2', '1.5', '1e2', '100001', '9007199254740992']) {
    const row = valid(); row.quantity = quantity; assert.ok(rowErrors(row).some(e => e.includes('cantidad')), quantity);
  }
  assert.equal(parseExport('Name,Set,Number\nA,B,001').rows[0].quantity, '');
});
test('does not merge repeated rows or variants; fingerprint detects equivalent exports', () => {
  const a = parseExport('Name,Set,Number,Count\nA,B,001,1\nA,B,001,1');
  assert.equal(a.rows.length, 2); assert.notEqual(a.rows[0].id, a.rows[1].id);
  assert.equal(a.fingerprint, parseExport('Name;Set;Number;Count\r\nA;B;001;1\r\nA;B;001;1').fingerprint);
});
test('preserves identity and existing prices; new cards require a positive explicit sale price', () => {
  const s = session(), row = s.rows[0]; row.finish = 'reverse holo'; row.language = 'ES'; row.condition = 'LP'; row.priceArs = '999999';
  const p = payloadFor(s, row); assert.equal(p.priceArs, 1200); assert.equal(p.quantityOnHand, 3); assert.equal(p.finish, 'reverse holo'); assert.equal(p.language, 'ES'); assert.equal(p.condition, 'LP');
  row.candidate = { priceChartingId: 'pc' }; row.priceArs = ''; assert.ok(rowErrors(row, true).includes('precio de venta ARS'));
  row.priceArs = '1200'; assert.deepEqual(rowErrors(row, true), []);
});
test('transfer persists uncertain state BEFORE request, and replays never create another capture', async () => {
  const s = session(), events = []; let creates = 0;
  const api = async () => { creates++; events.push('network'); assert.equal(s.rows[0].transfer, 'uncertain'); return { entry: { id: 'entry' } }; };
  await transfer(s, api, async () => events.push('save:' + s.rows[0].transfer));
  assert.deepEqual(events, ['save:uncertain', 'network', 'save:sent']);
  await transfer(s, api, async () => {}); assert.equal(creates, 1);
});
test('lost create response blocks all automatic retries, including after process restart', async () => {
  let s = session(), creates = 0, disk;
  const save = async () => { disk = JSON.stringify(s); };
  await assert.rejects(transfer(s, async () => { creates++; throw new Error('timeout'); }, save), /timeout/);
  s = JSON.parse(disk);
  await assert.rejects(transfer(s, async () => { creates++; }, save), /incierta/);
  assert.equal(creates, 1);
});
test('failed durable save prevents any network call', async () => {
  let calls = 0;
  await assert.rejects(transfer(session(), async () => calls++, async () => { throw new Error('disk full'); }), /disk full/);
  assert.equal(calls, 0);
});
test('reconciliation exhausts pagination and recovers exact marker without a new capture', async () => {
  const s = session(); s.rows[0].transfer = 'uncertain'; let calls = 0;
  await reconcile(s, async route => {
    calls++; const query = new URL('http://qa' + route).searchParams;
    assert.equal(query.get('status'), 'all');
    if (calls === 1) return { entries: [], asOf: 'boundary', nextCursor: 'next' };
    assert.equal(query.get('cursor'), 'next'); assert.equal(query.get('asOf'), 'boundary');
    return { entries: [{ id: 'recovered', notes: markerFor(s, s.rows[0]) }], nextCursor: null, asOf: 'boundary' };
  }, async () => {});
  assert.equal(s.rows[0].entryId, 'recovered'); assert.equal(s.rows[0].transfer, 'sent'); assert.equal(calls, 2);
});
test('no match or multiple matches do not authorize resend', async () => {
  for (const entries of [[], [{ id: '1' }, { id: '2' }]]) {
    const s = session(); s.rows[0].transfer = 'uncertain';
    entries.forEach(e => e.notes = markerFor(s, s.rows[0]));
    await assert.rejects(reconcile(s, async () => ({ entries, nextCursor: null, asOf: 'now' }), async () => {}));
    assert.equal(s.rows[0].transfer, 'uncertain');
  }
});
test('admin, actor AND business scope required for a bound session', () => {
  const s = session(); s.account = { userId: 'u', businessId: 'b' };
  const user = { id: 'u', businessId: 'b', roles: ['admin'] }; assertAccount(s, user);
  for (const u of [null, { ...user, roles: ['stock_owner'] }, { ...user, id: 'other' }, { ...user, businessId: 'other' }]) assert.throws(() => assertAccount(s, u));
});
test('invalid or unreviewed rows stop transfer before network', async () => {
  const s = session(); s.rows[0].reviewed = false; let calls = 0;
  await assert.rejects(transfer(s, async () => calls++, async () => {}), /Revisá/); assert.equal(calls, 0);
});

test('automatic matches require exact full identity, a unique existing item and untruncated results', () => {
  const row = valid(); const candidate = { ...row, inventoryItemId: 'stock', priceChartingId: 'pc' };
  assert.equal(exactStockCandidate(row, [candidate]), candidate);
  for (const field of ['name', 'expansion', 'number', 'language', 'condition', 'finish', 'gradingCompany', 'grade']) {
    assert.equal(exactStockCandidate(row, [{ ...candidate, [field]: 'different' }]), null, field);
  }
  assert.equal(exactStockCandidate(row, [candidate, { ...candidate, inventoryItemId: 'other' }]), null);
  assert.equal(exactStockCandidate(row, Array.from({ length: 30 }, () => candidate)), null);
  assert.equal(exactStockCandidate(row, [{ ...candidate, inventoryItemId: undefined }]), null);
  const graded = parseExport('Name,Set,Number,Count,GradingCompany,Grade\nA,B,001,1,PSA,10').rows[0];
  assert.equal(graded.gradingCompany, 'PSA'); assert.equal(graded.grade, '10');
  const gradedRow = { ...row, gradingCompany: 'PSA', grade: '10' };
  const gradedCandidate = { ...candidate, gradingCompany: 'PSA', grade: '10', condition: 'GRADED' };
  assert.equal(exactStockCandidate(gradedRow, [gradedCandidate]), gradedCandidate);
  assert.equal(payloadFor(session(), gradedRow).condition, 'GRADED');
  assert.equal(exactStockCandidate({ ...row, number: '001/100' }, [{ ...candidate, number: '1' }])?.inventoryItemId, 'stock');
  assert.equal(exactStockCandidate({ ...row, number: '001/100' }, [{ ...candidate, number: '1/200' }]), null);
});
