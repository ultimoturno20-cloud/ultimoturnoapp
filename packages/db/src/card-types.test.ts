import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { classifyCard, isCardType, type CardType } from './card-types.js';
import { masterSet151Contents } from './folder-templates.js';
import {
  addInventoryFolder151Template, addInventoryStock, applyInventorySnapshot, createOperationalDatabase,
  getDefaultOperationalUser, listPriceChartingCache, listStockForBusiness, listUnifiedCatalogCards,
  replacePriceChartingCache, saveInventoryFolderEntry, upsertInventoryItem
} from './index.js';

const metadata = (type: string) => ({ extendedData: [{ name: 'CardType', displayName: 'Card Type', value: type }] });
const classify = (...data: unknown[]) => classifyCard({ name: 'Unknown', expansion: 'Test', metadata: data });

it('normalizes trusted card metadata without guessing from names, elements or finishes', () => {
  for (const [value, expected] of [
    ['Grass', 'pokemon'], ['Dragon', 'pokemon'], ['Pokémon', 'pokemon'], ['Supporter', 'supporter'],
    ['Trainer - Item', 'item'], ['Stadium', 'stadium'], ['Pokémon Tool', 'tool'], ['Energy', 'energy']
  ]) assert.equal(classify(metadata(value)).cardType, expected);
  assert.equal(classify({ supertype: 'Trainer', subtypes: ['Item', 'Pokemon Tool'] }).cardType, 'tool');
  assert.equal(classify({ supertype: 'Energy', subtypes: ['Basic'] }).cardType, 'energy');
  assert.equal(classify({ supertype: 'Pokemon', subtypes: ['Basic', 'ex'] }).cardType, 'pokemon');
  assert.equal(classifyCard({ name: 'Energy Sticker', expansion: 'Test' }).cardType, 'unknown');
  assert.equal(classify({ extendedData: [{ name: 'Subtype', value: 'Reverse Holo' }] }).cardType, 'unknown');
  assert.equal(classify(metadata('Trainer')).cardType, 'unknown');
  assert.equal(classify(metadata('Item'), metadata('Supporter')).cardType, 'unknown');
  assert.equal(classify({ supertype: 'Pokemon', subtypes: ['Supporter'] }, metadata('Item')).cardType, 'unknown');
  assert.equal(classify(null, 'Supporter', []).cardType, 'unknown');
  assert.equal(isCardType('tool'), true);
  assert.equal(isCardType('holo'), false);
});

it('classifies every exact English 151 checklist entry, not unrelated numbers or promos', () => {
  const entries = masterSet151Contents();
  const types = entries.map((entry) => classifyCard({ ...entry, languageGroup: 'english' }).cardType);
  assert.equal(types.includes('unknown'), false);
  for (const type of ['pokemon', 'supporter', 'item', 'stadium', 'tool', 'energy']) assert.ok(types.includes(type as CardType));
  assert.equal(types.filter((type) => type === 'energy').length, 9);
  assert.equal(classifyCard({ name: 'Energy Sticker [Reverse Holo]', number: '0159/165', expansion: 'Pokemon Scarlet & Violet 151' }).cardType, 'item');
  assert.equal(classifyCard({ name: 'Big Air Balloon', number: '155', expansion: 'SV: Scarlet & Violet 151' }).cardType, 'tool');
  for (const input of [
    { name: 'Charizard ex', number: '999', expansion: 'Scarlet & Violet 151' },
    { name: 'Fake Card', number: '1', expansion: 'Scarlet & Violet 151' },
    { name: 'Bulbasaur', number: '1', expansion: 'Pokemon 151', languageGroup: 'japanese' },
    { name: 'Mew ex', number: '53', expansion: 'Pokemon Promo' },
    { name: 'Grass Energy', expansion: 'Scarlet & Violet 151' }
  ]) assert.equal(classifyCard(input).cardType, 'unknown');
});

it('classifies existing and new inventory, preserves overrides at intake and leaves operational values unchanged', async (t) => {
  const db = await createOperationalDatabase({ dataDir: await mkdtemp(path.join(tmpdir(), 'ut-card-types-')) });
  t.after(() => db.close());
  const actor = await getDefaultOperationalUser(db);
  const input = { name: 'Existing card', expansion: 'Test Set', number: '42', language: 'EN', condition: 'NM', finish: 'normal', quantityOnHand: 2, priceArs: 800, priceChartingId: 'type-existing' };
  const cached = [
    ['type-existing', 'Existing card', 'Test Set', '42'], ['type-new', 'New card', 'Test Set', '43'],
    ['type-promo', 'Mew ex', 'Pokemon Promo', '53'], ['tcgcsv-998877', 'Synthetic Card', 'Test Set', '44']
  ].map(([priceChartingId, productName, expansionName, cardNumber]) => ({
    priceChartingId, productName, expansionName, cardNumber, canonicalUrl: '', sourceUrl: '', imageUrl: '',
    normalizedName: productName.toLowerCase(), normalizedExpansion: expansionName.toLowerCase(), loosePriceUsd: 5, searchKey: productName.toLowerCase(), languageGroup: 'english' as const
  }));
  await replacePriceChartingCache(db, { category: 'pokemon-cards', sourceHash: 'card-types', rowsReceived: cached.length, rowsSkipped: 0, rows: cached });
  const existing = await addInventoryStock(db, input, actor);
  assert.equal(existing.cardType, 'unknown');
  const before = await listStockForBusiness(db, actor.businessId);
  const movementCount = await db.query('select count(*) from inventory_movements');
  for (const [id, type] of [['type-existing', 'Supporter'], ['type-new', 'Tool'], ['type-promo', 'Psychic'], ['tcgcsv-998877', 'Stadium']]) {
    await db.query(`insert into card_index_entries (id, pricecharting_id, canonical_name, normalized_name, match_status, evidence_json)
      values ($1, $2, 'Test', 'test', $3, $4::jsonb)`, [crypto.randomUUID(), id, id.startsWith('tcgcsv-') ? 'pricecharting_only' : 'matched', JSON.stringify(metadata(type))]);
  }
  let stock = await listStockForBusiness(db, actor.businessId);
  assert.equal(stock.items[0].cardType, 'supporter');
  assert.equal(stock.items[0].cardTypeSource, 'catalog');
  assert.deepEqual(stock.summary, before.summary);
  assert.equal(stock.items[0].quantityOnHand, existing.quantityOnHand);
  assert.equal(stock.items[0].priceArs, existing.priceArs);
  assert.deepEqual(await db.query('select count(*) from inventory_movements'), movementCount);
  assert.equal((await listUnifiedCatalogCards(db, 'New card')).entries[0].cardType, 'tool');
  assert.equal((await listPriceChartingCache(db, 'New card')).entries[0].cardType, 'tool');
  assert.equal((await listUnifiedCatalogCards(db, 'Synthetic Card')).entries[0].cardType, 'stadium');
  const newItem = await addInventoryStock(db, { ...input, name: 'New card', number: '43', priceChartingId: 'type-new' }, actor);
  assert.equal(newItem.cardType, 'tool');
  let edited = await upsertInventoryItem(db, { ...input, sku: existing.sku, cardTypeOverride: 'item' }, actor);
  assert.equal(edited.cardType, 'item');
  assert.equal(edited.cardTypeSource, 'manual');
  edited = await addInventoryStock(db, { ...input, quantityOnHand: 1, cardTypeOverride: '' }, actor);
  assert.equal(edited.id, existing.id);
  assert.equal(edited.quantityOnHand, 3);
  assert.equal(edited.cardType, 'item');
  edited = await upsertInventoryItem(db, { ...input, sku: existing.sku, quantityOnHand: 3, cardTypeOverride: null }, actor);
  assert.equal(edited.cardType, 'supporter');
  assert.equal(edited.cardTypeOverride, null);
  edited = await upsertInventoryItem(db, { ...input, sku: existing.sku, quantityOnHand: 3, cardTypeOverride: 'unknown' }, actor);
  assert.equal(edited.cardTypeSource, 'manual');
  assert.equal(edited.cardType, 'unknown');
  await assert.rejects(upsertInventoryItem(db, { ...input, sku: existing.sku, cardTypeOverride: 'invalid' as CardType }, actor), /Tipo de carta invalido/);
  await assert.rejects(upsertInventoryItem(db, { ...input, sku: existing.sku, cardTypeOverride: 'tool' }, { ...actor, id: crypto.randomUUID(), roles: ['stock_owner'] }), /otro propietario/);
  await db.query("update card_index_entries set review_status = 'rejected' where pricecharting_id = 'type-new'");
  stock = await listStockForBusiness(db, actor.businessId);
  assert.equal(stock.items.find((item) => item.id === newItem.id)?.cardType, 'unknown');
  await db.query("update card_index_entries set review_status = 'pending', match_status = 'weak_match' where pricecharting_id = 'type-new'");
  assert.equal((await listStockForBusiness(db, actor.businessId)).items.find((item) => item.id === newItem.id)?.cardType, 'unknown');
  const csv = 'sku,name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nTYPE-IMPORT,Energy Sticker,Scarlet & Violet 151,159,EN,NM,normal,1,800';
  await applyInventorySnapshot(db, csv, actor);
  assert.equal((await listStockForBusiness(db, actor.businessId)).items.find((item) => item.sku === 'TYPE-IMPORT')?.cardType, 'item');
  const folder = await addInventoryStock(db, { ...input, itemKind: 'folder', name: 'Master set 151', expansion: 'Coleccion', quantityOnHand: 1, priceChartingId: '', inventoryStatus: 'not_for_sale' }, actor);
  assert.equal(folder.cardType, undefined);
  const contents = await addInventoryFolder151Template(db, folder.id, actor);
  assert.equal(contents.length, 368);
  assert.ok(contents.every((entry) => entry.cardType && entry.cardType !== 'unknown'));
  const withPromo = await saveInventoryFolderEntry(db, folder.id, { priceChartingId: 'type-promo', quantity: 1 }, actor);
  assert.equal(withPromo.find((entry) => entry.priceChartingId === 'type-promo')?.cardType, 'pokemon');
});
