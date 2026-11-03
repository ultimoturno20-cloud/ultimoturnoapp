import test from 'node:test';
import assert from 'node:assert/strict';
import { AndroidBridge, parseHierarchy, readMonprice, mergeSnapshot, monpriceFinish } from './android.mjs';
const leaf = (text = '', description = '') => `<node text="${text}" content-desc="${description}" bounds="[0,0][20,20]"/>`;
const root = content => `<hierarchy><node package="com.sarafan.pokemon" bounds="[0,0][1080,2424]">${content}</node></hierarchy>`;
const card = (name = 'Example', quantity = 1, finish = 'Normal') => `<node bounds="[0,700][1080,1200]">${leaf('', 'Decrease count')}${leaf(String(quantity))}${leaf('', 'Increase count')}${leaf('Nombre')}${leaf(name)}${leaf('Establecer')}${leaf('Example Set')}${leaf('Número')}${leaf('001/100')}${leaf('Tipo:')}${leaf(finish)}${leaf('Grading')}${leaf('', 'RAW')}</node>`;
const list = (cards, total, scroll = false) => root(`${leaf('Cartas Escaneadas')}${leaf('Cantidad')}${leaf(String(total))}<node scrollable="${scroll}" bounds="[0,400][1080,2100]">${cards}</node>`);
const camera = name => root(`${leaf('', 'settings')}${leaf('', 'next icon')}${leaf('', 'Inglés')}${name ? leaf('Nombre') + leaf(name) + leaf('Establecer') + leaf('Example Set') + leaf('Número') + leaf('001/100') : leaf('0 tarjetas')}`);
const png = Buffer.alloc(32); png.writeUInt32BE(1080, 16); png.writeUInt32BE(2424, 20);

function fakePhone({ initial = 'Example', pages = [list(card(), 1)] } = {}) {
  const phone = { mode: 'scanner', latest: initial, index: 0, commands: [] };
  phone.execute = async (args, binary) => {
    phone.commands.push(args);
    if (args[0] === 'devices') return 'List of devices attached\nsynthetic device model:Test\n';
    if (args[0] === 'exec-out' && args[1] === 'cat') return phone.mode === 'scanner' ? camera(phone.latest) : pages[phone.index];
    if (args[0] === 'exec-out' && args[1] === 'screencap') { assert.equal(binary, true); return png; }
    if (args[2] === 'tap') { phone.mode = 'list'; phone.index = 0; }
    if (args[2] === 'swipe') phone.index = Math.min(phone.index + 1, pages.length - 1);
    if (args[2] === 'keyevent') phone.mode = 'scanner';
    return '';
  };
  return phone;
}

test('reads Monprice identity and authoritative list quantity/finish; no OCR or price-as-counter', () => {
  const screen = readMonprice(parseHierarchy(camera('Example')), 'EN');
  assert.equal(screen.mode, 'scanner'); assert.equal(screen.latest.name, 'Example'); assert.equal(screen.language, 'EN');
  const snapshot = readMonprice(parseHierarchy(list(card('Example', 7, 'Foil'), 7)), 'EN');
  assert.equal(snapshot.total, 7); assert.equal(snapshot.rows[0].quantity, 7); assert.equal(snapshot.rows[0].finish, 'foil');
  assert.equal(snapshot.rows[0].gradingPending, false); assert.equal(snapshot.rows[0].number, '001/100');
});
test('rejects foreign screens, malformed XML and external entity declarations', () => {
  assert.throws(() => parseHierarchy('<node package="another.app"/>'), /Monprice/);
  assert.throws(() => parseHierarchy('<node package="com.sarafan.pokemon">'), /incompleta/);
  assert.throws(() => parseHierarchy('<!DOCTYPE a><node package="com.sarafan.pokemon"/>'), /no admitida/);
  assert.equal(readMonprice(parseHierarchy(list(card('A &amp; B'), 1)), 'EN').rows[0].name, 'A & B');
});
test('a stationary recognition does not add units; repeated cards use Monprice counts', async () => {
  const phone = fakePhone({ pages: [list(card('Example', 3), 3)] }), snapshots = [];
  const bridge = new AndroidBridge({ executeAdb: phone.execute, onSnapshot: rows => snapshots.push(rows), interval: 999999 });
  bridge.suspended = true;
  try {
    await bridge.start('EN'); await bridge.tick(); await bridge.tick();
    assert.equal(snapshots.length, 1); assert.equal(snapshots[0][0].quantity, 3); assert.equal(phone.mode, 'scanner');
    await bridge.finalize(); assert.equal(bridge.finalized, true); assert.equal(phone.mode, 'list');
  } finally { await bridge.stop(); }
});
test('reads all pages and deduplicates overlapping rows without summing a row twice', async () => {
  const phone = fakePhone({ pages: [list(card('A', 2), 5, true), list(card('A', 2) + card('B', 3), 5, true)] }); let rows;
  const bridge = new AndroidBridge({ executeAdb: phone.execute, onSnapshot: value => { rows = value; } }); bridge.suspended = true;
  try { await bridge.start('EN'); assert.equal(rows.length, 2); assert.equal(rows.reduce((sum, r) => sum + r.quantity, 0), 5); }
  finally { await bridge.stop(); }
});
test('never publishes an incomplete or conflicting list', async () => {
  for (const pages of [[list(card('A', 1), 2)], [list(card('A', 1), 2, true), list(card('A', 2), 2, true)]]) {
    const phone = fakePhone({ pages }); let snapshots = 0;
    const bridge = new AndroidBridge({ executeAdb: phone.execute, onSnapshot: () => snapshots++ }); bridge.suspended = true;
    try { await bridge.start('EN'); assert.equal(snapshots, 0); assert.ok(bridge.status.error); }
    finally { await bridge.stop(); }
  }
});
test('new batches after delivery require an empty Monprice session', async () => {
  const phone = fakePhone(); const bridge = new AndroidBridge({ executeAdb: phone.execute }); bridge.suspended = true;
  await assert.rejects(bridge.start('EN', { allowExisting: false }), /vacía/); await bridge.stop();
});
test('snapshot refresh preserves manual quantities, ignores and catalog choices', () => {
  const session = { rows: [], androidCondition: 'NM' };
  const rows = readMonprice(parseHierarchy(list(card('A', 2), 2)), 'EN').rows;
  mergeSnapshot(session, rows); const row = session.rows[0]; row.quantity = '9'; row.quantityEdited = true; row.candidate = { inventoryItemId: 'chosen' }; row.ignored = true;
  mergeSnapshot(session, [{ ...rows[0], quantity: 4 }]);
  assert.equal(session.rows[0].quantity, '9'); assert.equal(session.rows[0].sourceQuantity, 4); assert.equal(session.rows[0].ignored, true); assert.equal(session.rows[0].candidate.inventoryItemId, 'chosen');
  assert.throws(() => mergeSnapshot(session, []), /quitaría/);
  session.rows[0].transfer = 'sent'; assert.throws(() => mergeSnapshot(session, rows), /enviarse/);
});

test('Monprice specific ball patterns remain distinct from generic reverse holo', () => {
  for (const [input, expected] of [['Normal', 'normal'], ['Reverse Holo', 'reverse holo'], ['Reverse Holo Master Ball', 'master ball'], ['Reverse Holo Poke Ball', 'poke ball'], ['Reverse Holo Poké Ball', 'poke ball'], ['Reverse Holo Energy', 'reverse holo energy']]) {
    assert.equal(monpriceFinish(input), expected);
    const result = readMonprice(parseHierarchy(list(card('Example', 1, input), 1)), 'EN'); assert.equal(result.rows[0].finish, expected);
  }
  assert.equal(readMonprice(parseHierarchy(root(leaf('Normal') + leaf('Reverse Holo Poke Ball'))), 'EN').mode, 'correction');
  assert.equal(readMonprice(parseHierarchy(root(leaf('Which card is it?'))), 'EN').mode, 'correction');
});
test('one corrected printing keeps the same local row and edited quantity, without retaining an automatic old link', () => {
  const session = { rows: [], androidCondition: 'NM' };
  const source = readMonprice(parseHierarchy(list(card('Example', 1), 1)), 'EN').rows[0];
  mergeSnapshot(session, [{ ...source, expansion: 'Set A', number: '016/217' }]);
  const before = session.rows[0]; before.quantity = '7'; before.quantityEdited = true; before.candidate = { inventoryItemId: 'old-stock' }; before.priceArs = '4000'; before.reviewed = true;
  mergeSnapshot(session, [{ ...source, expansion: 'Set B', number: '004/131', finish: 'poke ball' }]);
  const corrected = session.rows[0]; assert.equal(session.rows.length, 1); assert.equal(corrected.id, before.id); assert.equal(corrected.quantity, '7');
  assert.equal(corrected.expansion, 'Set B'); assert.equal(corrected.number, '004/131'); assert.equal(corrected.finish, 'poke ball'); assert.equal(corrected.candidate, null); assert.equal(corrected.priceArs, ''); assert.equal(corrected.reviewed, false);
});
test('an explicit PC identity correction survives a later Monprice correction', () => {
  const session = { rows: [], androidCondition: 'NM' }, source = readMonprice(parseHierarchy(list(card('Example', 1), 1)), 'EN').rows[0];
  mergeSnapshot(session, [source]); Object.assign(session.rows[0], { expansion: 'Chosen Set', finish: 'master ball', identityCorrected: true, candidate: { inventoryItemId: 'chosen' }, quantity: '4', quantityEdited: true });
  mergeSnapshot(session, [{ ...source, finish: 'poke ball' }]);
  assert.equal(session.rows[0].expansion, 'Chosen Set'); assert.equal(session.rows[0].finish, 'master ball'); assert.equal(session.rows[0].candidate.inventoryItemId, 'chosen'); assert.equal(session.rows[0].quantity, '4');
});
test('a rejected ambiguous source update does not mutate any previously saved row', () => {
  const session = { rows: [], androidCondition: 'NM' }, source = readMonprice(parseHierarchy(list(card('Example', 1), 1)), 'EN').rows[0];
  mergeSnapshot(session, [source, { ...source, name: 'Another' }]); session.rows[1].quantityEdited = true;
  const before = structuredClone(session);
  assert.throws(() => mergeSnapshot(session, [{ ...source, quantity: 2 }]), /quitaría/);
  assert.deepEqual(session, before);
});
