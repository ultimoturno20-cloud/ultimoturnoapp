import test from 'node:test';
import assert from 'node:assert/strict';
import { fillMissingDefaults, rowPage, rowErrors, rowReady } from './batch.mjs';

const row = i => ({ id: String(i), name: `Example ${i}`, expansion: 'Set QA', number: String(i), quantity: '2', language: '', condition: '', finish: '', gradingCompany: '', grade: '', transfer: 'local', reviewed: false, ignored: false, candidate: null });

test('bulk defaults fill only missing fields across the full lot and preserve protected rows', () => {
  const session = { rows: Array.from({ length: 123 }, (_, i) => row(i)) };
  session.rows[0].language = 'ES'; session.rows[0].condition = 'LP'; session.rows[0].finish = 'reverse holo';
  session.rows[1].transfer = 'sent'; session.rows[2].transfer = 'uncertain'; session.rows[3].ignored = true;
  session.rows[4].candidate = { inventoryItemId: 'old-match' }; session.rows[4].reviewed = true;
  const frozen = structuredClone(session.rows.slice(0, 4));
  const result = fillMissingDefaults(session, { language: 'EN', condition: 'NM', finish: 'normal' });
  assert.equal(result.changedRows, 119); assert.equal(result.changedFields, 357);
  assert.deepEqual(session.rows.slice(0, 4), frozen);
  assert.equal(session.rows[122].language, 'EN'); assert.equal(session.rows[122].quantity, '2');
  assert.equal(session.rows[4].candidate, null); assert.equal(session.rows[4].reviewed, false);
  assert.equal(fillMissingDefaults(session, { language: 'EN' }).changedRows, 0);
});

test('invalid defaults fail before changing any row; quantity, price and grading cannot be mass replaced', () => {
  const session = { rows: [row(1)] }, before = structuredClone(session);
  for (const defaults of [null, [], {}, { language: 'INVALID' }, { condition: 'BAD' }, { finish: 'x'.repeat(81) }, { quantity: 1 }, { priceArs: 1 }, { grade: '10' }]) {
    assert.throws(() => fillMissingDefaults(session, defaults)); assert.deepEqual(session, before);
  }
});

test('pagination traverses all 423 cards once and does not mutate global units or selection', () => {
  const rows = Array.from({ length: 423 }, (_, i) => row(i)); const seen = [];
  for (let page = 1; page <= 17; page++) {
    const view = rowPage(rows, { page, pageSize: 25 }); assert.equal(view.total, 423);
    assert.equal(view.pageCount, 17); seen.push(...view.rows.map(r => r.id));
  }
  assert.equal(seen.length, 423); assert.equal(new Set(seen).size, 423);
  assert.equal(rows.reduce((sum, r) => sum + Number(r.quantity), 0), 846);
  assert.equal(rowPage(rows, { page: 100, pageSize: 50 }).rows.length, 23);
  assert.equal(rowPage(rows, { page: 100, pageSize: 50 }).page, 9);
  assert.equal(rowPage(rows, { query: 'DOES NOT EXIST' }).from, 0);
  assert.equal(rowPage(rows, { query: 'Example 422' }).rows[0].id, '422');
});

test('UI readiness matches server rules and Chinese stock identities remain valid', () => {
  const r = { ...row(1), reviewed: true, language: 'CHS', condition: 'NM', finish: 'normal' };
  assert.equal(rowReady(r), true); assert.deepEqual(rowErrors({ ...r, language: 'CHT' }), []);
  for (const patch of [{ quantity: '100001' }, { name: ' ' }, { gradingCompany: 'PSA' }, { grade: '10' }, { condition: 'BAD' }, { condition: 'GRADED' }]) assert.equal(rowReady({ ...r, ...patch }), false);
  const graded = { ...r, gradingCompany: 'PSA', grade: '10' }; assert.equal(rowReady(graded), true);
  assert.equal(rowReady({ ...graded, grade: '   ' }), false);
});

test('filtered pages distinguish ignored, unlinked, pending and uncertain cards', () => {
  const rows = Array.from({ length: 120 }, (_, i) => row(i)); rows[0].ignored = true; rows[110].transfer = 'uncertain';
  rows[119] = { ...rows[119], language: 'EN', condition: 'NM', finish: 'normal', reviewed: true, candidate: { inventoryItemId: 'stock' } };
  assert.equal(rowPage(rows, { status: 'ready' }).total, 1);
  assert.equal(rowPage(rows, { status: 'unlinked' }).total, 118);
  assert.equal(rowPage(rows, { status: 'uncertain' }).rows[0].id, '110');
  assert.equal(rowPage(rows, { status: 'ignored' }).total, 1);
  assert.equal(rowPage(rows, { status: 'pending' }).total, 118);
});
