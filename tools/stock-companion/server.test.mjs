import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startCompanion } from './server.mjs';

test('local HTTP workflow: auth, review, additive apply, replay and restart; synthetic API only', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'ut-companion-test-'));
  let stock = 8, creates = 0, applies = 0, lastPayload, lost = true, userId = 'qa-admin'; const applied = new Set();
  const fakeFetch = async (url, options) => {
    assert.ok(url.startsWith('http://127.0.0.1:9999/api/'));
    const route = new URL(url).pathname.replace('/api', ''); const body = options.body ? JSON.parse(options.body) : {};
    const json = data => ({ ok: true, json: async () => data });
    if (route === '/auth/login') return json({ token: 'synthetic-test-token', user: { id: userId, businessId: 'qa-business', roles: ['admin'], displayName: 'QA synthetic' } });
    if (route === '/auth/logout') return json({ ok: true });
    assert.equal(options.headers.Authorization, 'Bearer synthetic-test-token');
    if (route === '/mobile-intake/search') return json({ candidates: [{ id: 'qa-card', inventoryItemId: 'qa-stock', priceChartingId: 'qa-pc', name: 'Example', expansion: 'Test', number: '001', language: 'EN', condition: 'NM', finish: 'normal', priceArs: 1200, priceUsd: 1 }] });
    if (route === '/mobile-intake/entries') { creates++; lastPayload = body; if (lost) { lost = false; throw new Error('Respuesta perdida'); } return json({ entry: { id: 'qa-entry' } }); }
    if (route === '/mobile-intake/view') return json({ entries: [{ id: 'qa-entry', notes: lastPayload.notes }], asOf: 'now', nextCursor: null });
    if (route === '/mobile-intake/apply') {
      applies++; assert.deepEqual(body.ids, ['qa-entry']);
      const replay = applied.has('qa-entry'); if (!replay) { stock += lastPayload.quantityOnHand; applied.add('qa-entry'); }
      return json({ result: { appliedEntries: replay ? 0 : 1, skippedEntries: replay ? 1 : 0, unitsApplied: replay ? 0 : lastPayload.quantityOnHand, errors: [] } });
    }
    throw new Error('Unexpected route ' + route);
  };
  let app;
  try {
    app = await startCompanion({ dataDir, port: 0, apiBase: 'http://127.0.0.1:9999/api', fetchImpl: fakeFetch });
    await assert.rejects(startCompanion({ dataDir, port: 0 }), /instancia/);
    const html = await (await fetch(app.url)).text(); const token = html.match(/name="companion-token" content="([a-f0-9]+)"/)[1];
    const call = async (route, body, overrides = {}) => {
      const response = await fetch(app.url + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Companion-Token': token, ...overrides }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    };
    assert.equal((await call('/state', undefined, { 'X-Companion-Token': 'wrong' })).status, 403);
    assert.equal((await call('/import', {}, { Origin: 'https://evil.invalid' })).status, 403);
    const input = { name: 'Synthetic QA', filename: 'test.csv', text: 'Name,Set,Number,Count,Language,Condition,Finish\nExample,Test,001,3,EN,NM,normal' };
    let result = await call('/import', input); assert.equal(result.status, 200);
    const session = result.data.sessions[0], sessionId = session.id, rowId = session.rows[0].id;
    assert.equal((await call('/import', input)).status, 400);
    await call('/login', { email: 'synthetic@example.invalid', password: 'test-only' });
    assert.equal((await call('/match', { sessionId })).status, 200);
    const matched = await call('/state'); assert.equal(matched.data.sessions[0].rows[0].candidate.inventoryItemId, 'qa-stock');
    assert.equal(matched.data.sessions[0].rows[0].reviewed, false);
    assert.equal((await call('/choose', { sessionId, rowId, query: 'Example', candidateId: 'qa-card' })).status, 200);
    await call('/logout', {}); userId = 'different-admin'; await call('/login', { email: 'synthetic@example.invalid', password: 'test-only' });
    assert.equal((await call('/transfer', { sessionId })).status, 400); assert.equal(creates, 0);
    await call('/logout', {}); userId = 'qa-admin'; await call('/login', { email: 'synthetic@example.invalid', password: 'test-only' });
    await call('/review-matched', { sessionId });
    assert.equal((await call('/transfer', { sessionId })).status, 400); assert.equal(creates, 1);
    assert.equal((await call('/transfer', { sessionId })).status, 400); assert.equal(creates, 1);
    assert.equal((await call('/reconcile', { sessionId })).status, 200);
    assert.equal((await call('/edit', { sessionId, rowId, patch: { quantity: '99' } })).status, 400);
    assert.equal((await call('/transfer', { sessionId })).status, 200); assert.equal(creates, 1);
    assert.equal((await call('/apply', { sessionId })).status, 200); assert.equal(stock, 11);
    assert.equal((await call('/apply', { sessionId })).status, 200); assert.equal(stock, 11); assert.equal(applies, 1);
    const disk = await readFile(path.join(dataDir, 'sessions.json'), 'utf8');
    assert.ok(!disk.includes('test-only')); assert.ok(!disk.includes('synthetic-test-token')); assert.ok(!disk.includes('synthetic@example.invalid'));
    await app.close(); app = await startCompanion({ dataDir, port: 0, apiBase: 'http://127.0.0.1:9999/api', fetchImpl: fakeFetch });
    const nextHtml = await (await fetch(app.url)).text(); const nextToken = nextHtml.match(/name="companion-token" content="([a-f0-9]+)"/)[1];
    const restored = await (await fetch(app.url + '/state', { headers: { 'X-Companion-Token': nextToken } })).json();
    assert.equal(restored.user, null); assert.ok(restored.sessions[0].appliedAt); assert.equal(restored.sessions[0].rows[0].entryId, 'qa-entry');
  } finally { if (app) await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});

test('remote API destinations cannot be redirected to an arbitrary host', async () => {
  await assert.rejects(startCompanion({ apiBase: 'https://evil.invalid/api' }), /Destino API/);
});
