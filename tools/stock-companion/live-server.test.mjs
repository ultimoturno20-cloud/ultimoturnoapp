import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
import { startCompanion } from './server.mjs';

test('live phone session keeps PC quantity edits and sends through a single retry-safe endpoint', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'ut-live-server-'));
  const leaf = (text = '', description = '') => `<node text="${text}" content-desc="${description}" bounds="[0,0][10,10]"/>`;
  const wrap = content => `<hierarchy><node package="com.sarafan.pokemon">${content}</node></hierarchy>`;
  const identity = leaf('Nombre') + leaf('Example') + leaf('Establecer') + leaf('Synthetic Set') + leaf('Número') + leaf('001');
  const scanner = wrap(leaf('', 'settings') + leaf('', 'next icon') + leaf('', 'Inglés') + identity);
  const list = wrap(leaf('Cartas Escaneadas') + leaf('Cantidad') + leaf('3') + `<node>${leaf('', 'Decrease count')}${leaf('3')}${leaf('', 'Increase count')}${identity}${leaf('Tipo:')}${leaf('Normal')}${leaf('', 'RAW')}</node>`);
  let phoneMode = 'scanner', stock = 8, creates = 0, applies = 0; const captured = new Map(), receipts = new Set();
  const phone = async args => {
    if (args[0] === 'devices') return 'List of devices attached\nfixture device\n';
    if (args[0] === 'exec-out' && args[1] === 'cat') return phoneMode === 'scanner' ? scanner : list;
    if (args[0] === 'exec-out' && args[1] === 'screencap') return Buffer.alloc(32);
    if (args[2] === 'tap') phoneMode = 'list'; if (args[2] === 'keyevent') phoneMode = 'scanner'; return '';
  };
  const remote = async (url, options) => {
    assert.ok(url.startsWith('http://127.0.0.1:9999/api/')); const route = new URL(url).pathname.replace('/api', ''), body = options.body ? JSON.parse(options.body) : {};
    const json = data => ({ ok: true, json: async () => data });
    if (route === '/auth/login') return json({ token: 'synthetic', user: { id: 'admin', businessId: 'business', displayName: 'Synthetic admin', roles: ['admin'] } });
    if (route === '/mobile-intake/search') return json({ candidates: [{ id: 'stock', inventoryItemId: 'stock', name: 'Example', expansion: 'Synthetic Set', number: '001', language: 'EN', condition: 'NM', finish: 'normal', priceArs: 2000, priceUsd: null }] });
    if (route === '/mobile-intake/entries') { const id = 'entry-' + (++creates); captured.set(id, body); return json({ entry: { id } }); }
    if (route === '/mobile-intake/apply') { applies++; let units = 0, count = 0; for (const id of body.ids) if (!receipts.has(id)) { receipts.add(id); units += captured.get(id).quantityOnHand; count++; } stock += units; return json({ result: { unitsApplied: units, appliedEntries: count, skippedEntries: body.ids.length - count, errors: [] } }); }
    throw new Error('Unexpected route ' + route);
  };
  const app = await startCompanion({ dataDir, port: 0, apiBase: 'http://127.0.0.1:9999/api', fetchImpl: remote, androidOptions: { executeAdb: phone, interval: 999999 } });
  try {
    const html = await (await fetch(app.url)).text(), token = html.match(/name="companion-token" content="([a-f0-9]+)"/)[1];
    assert.match(html, /Mesa de escaneo/);
    const call = async (route, body = {}) => { const r = await fetch(app.url + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Companion-Token': token }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; };
    const start = await call('/android/start', { name: 'Synthetic scan', language: 'EN', condition: 'NM' }); assert.equal(start.status, 200, start.data.error);
    const sessionId = start.data.androidSessionId, rowId = start.data.sessions[0].rows[0].id;
    assert.equal(start.data.sessions[0].rows[0].quantity, '1');
    assert.equal(start.data.sessions[0].rows[0].scannerPreview, true); assert.equal(phoneMode, 'scanner');
    assert.equal((await fetch(app.url + '/android/frame')).status, 403);
    assert.equal((await fetch(app.url + '/android/frame', { headers: { 'X-Companion-Token': token } })).status, 200);
    await call('/edit', { sessionId, rowId, patch: { quantity: '5' } });
    await call('/login', { email: 'qa@example.invalid', password: 'synthetic' });
    assert.equal((await call('/send', { sessionId })).status, 400); assert.equal(creates, 0);
    const finalized = await call('/android/finalize'); assert.equal(finalized.status, 200, finalized.data.error); assert.equal(finalized.data.sessions[0].rows[0].quantity, '5');
    assert.equal(finalized.data.sessions[0].rows[0].id, rowId); assert.equal(finalized.data.sessions[0].rows[0].scannerPreview, false);
    await call('/choose', { sessionId, rowId, query: 'Example', candidateId: 'stock' }); await call('/review-matched', { sessionId });
    assert.equal((await call('/send', { sessionId })).status, 200); assert.equal(stock, 13); assert.equal(creates, 1); assert.equal(applies, 1);
    assert.equal((await call('/send', { sessionId })).status, 200); assert.equal(stock, 13); assert.equal(creates, 1); assert.equal(applies, 1);
  } finally { await app.close(); await rm(dataDir, { recursive: true, force: true }); }
});
