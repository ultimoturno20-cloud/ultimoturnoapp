import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startCompanion } from './server.mjs';

test('124-card companion batch uses the real isolated API: exact variants, additive quantities and lost apply response', { timeout: 120000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ut-companion-real-api-'));
  // Sanitize before loading API/database modules. Never read repository .env.
  for (const key of ['DATABASE_URL', 'ULTIMOTURNO_DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PRICECHARTING_TOKEN', 'OPENAI_API_KEY']) process.env[key] = '';
  Object.assign(process.env, {
    ULTIMOTURNO_ENV: 'staging', ULTIMOTURNO_DB_DRIVER: 'pglite', PGLITE_DATA_DIR: path.join(root, 'db'),
    ULTIMOTURNO_ALLOW_EXAMPLES: 'false', PRICECHARTING_AUTO_REFRESH_ENABLED: 'false', TCGPLAYER_PRICE_AUTO_REFRESH_ENABLED: 'false',
    ULTIMOTURNO_ACCESS_KEY: 'companion-isolated-only', ULTIMOTURNO_BLUE_RATE_MODE: 'manual', ULTIMOTURNO_BLUE_RATE_ARS: '1540'
  });
  const { createOperationalDatabase, getDefaultOperationalUser, createManagedUser, addInventoryStock } = await import('@ultimoturno/db');
  const db = await createOperationalDatabase({ driver: 'pglite', dataDir: process.env.PGLITE_DATA_DIR });
  const ids = {};
  try {
    const actor = { ...await getDefaultOperationalUser(db), roles: ['admin'] };
    await createManagedUser(db, { displayName: 'Companion QA', email: 'companion-synthetic@example.invalid', password: 'companion-synthetic-only', role: 'admin' }, actor);
    for (const [key, variant] of Object.entries({
      normal: { language: 'EN', condition: 'NM', finish: 'normal', quantityOnHand: 8, priceArs: 2000 },
      reverse: { language: 'EN', condition: 'NM', finish: 'reverse holo', quantityOnHand: 5, priceArs: 3000 },
      spanish: { language: 'ES', condition: 'LP', finish: 'normal', quantityOnHand: 4, priceArs: 1500 },
      graded: { language: 'EN', condition: 'NM', finish: 'normal', gradingCompany: 'PSA', grade: '10', quantityOnHand: 1, priceArs: 9000 }
    })) ids[key] = (await addInventoryStock(db, { name: 'Companion Synthetic QA', expansion: 'Synthetic QA Set', number: '001', ...variant }, actor)).id;
  } finally { await db.close(); }
  const { handleRequest } = await import('../../apps/api/dist/server.js');
  const apiServer = createServer((req, res) => { void handleRequest(req, res); });
  await new Promise(resolve => apiServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => apiServer.close(resolve)));
  const apiBase = `http://127.0.0.1:${apiServer.address().port}`;
  let loseApply = true;
  const companion = await startCompanion({
    port: 0, dataDir: path.join(root, 'sessions'), apiBase,
    fetchImpl: async (url, options) => {
      assert.equal(new URL(url).origin, apiBase);
      const response = await fetch(url, options);
      if (url.endsWith('/mobile-intake/apply') && loseApply) {
        loseApply = false; await response.json(); throw new Error('Simulated lost apply response after commit');
      }
      return response;
    }
  });
  t.after(() => companion.close());
  const html = await (await fetch(companion.url)).text();
  const localToken = html.match(/name="companion-token" content="([a-f0-9]+)"/)[1];
  const call = async (route, body = {}) => {
    const res = await fetch(companion.url + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Companion-Token': localToken }, body: JSON.stringify(body) });
    const data = await res.json(); return { status: res.status, data };
  };
  const login = await call('/login', { email: 'companion-synthetic@example.invalid', password: 'companion-synthetic-only' }); assert.equal(login.status, 200, login.data.error);
  const csv = ['Name,Set,Number,Count,Language,Condition,Finish,GradingCompany,Grade',
    ...Array.from({ length: 121 }, () => 'Companion Synthetic QA,Synthetic QA Set,001,1,EN,NM,normal,,'),
    'Companion Synthetic QA,Synthetic QA Set,001,3,EN,NM,reverse holo,,',
    'Companion Synthetic QA,Synthetic QA Set,001,4,ES,LP,normal,,',
    'Companion Synthetic QA,Synthetic QA Set,001,1,EN,NM,normal,PSA,10'].join('\n');
  const imported = await call('/import', { name: 'Synthetic 124-card batch', filename: 'synthetic.csv', text: csv }); assert.equal(imported.status, 200, imported.data.error);
  const sessionId = imported.data.sessions[0].id;
  const matched = await call('/match', { sessionId }); assert.equal(matched.status, 200, matched.data.error);
  const unmatched = matched.data.sessions[0].rows.filter(r => !r.candidate);
  if (unmatched.length) {
    const result = await call('/search', { sessionId, query: 'Companion Synthetic QA 001' });
    assert.fail(JSON.stringify({ unmatched: unmatched.map(({ language, condition, finish, gradingCompany, grade }) => ({ language, condition, finish, gradingCompany, grade })), candidates: result.data.candidates }));
  }
  const reviewed = await call('/review-matched', { sessionId }); assert.equal(reviewed.status, 200, reviewed.data.error);
  assert.ok(reviewed.data.sessions[0].rows.every(r => r.reviewed));
  const sent = await call('/transfer', { sessionId }); assert.equal(sent.status, 200, sent.data.error);
  const entryIds = sent.data.sessions[0].rows.map(r => r.entryId); assert.equal(new Set(entryIds).size, 124);
  const firstApply = await call('/apply', { sessionId }); assert.equal(firstApply.status, 400); assert.match(firstApply.data.error, /lost apply/);
  const retry = await call('/apply', { sessionId }); assert.equal(retry.status, 200, retry.data.error);
  assert.equal(retry.data.sessions[0].receipt.unitsApplied, 0); assert.equal(retry.data.sessions[0].receipt.skippedEntries, 124);
  // Independent API login and reads against the synthetic, temporary database.
  const auth = await (await fetch(apiBase + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'companion-synthetic@example.invalid', password: 'companion-synthetic-only' }) })).json();
  const stock = await (await fetch(apiBase + '/stock', { headers: { Authorization: `Bearer ${auth.token}` } })).json();
  for (const [key, quantity, price] of [['normal', 129, 2000], ['reverse', 8, 3000], ['spanish', 8, 1500], ['graded', 2, 9000]]) {
    const item = stock.items.find(i => i.id === ids[key]); assert.ok(item, key);
    assert.equal(item.quantityOnHand, quantity, key); assert.equal(item.priceArs, price, key);
  }
  assert.equal(stock.items.length, 4);
});
