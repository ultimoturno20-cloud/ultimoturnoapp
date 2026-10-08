import assert from 'node:assert/strict';
import { it } from 'node:test';
import { defaultResellerCatalogFilters, filterResellerCatalog, type ResellerCatalogItem } from '../src/reseller-catalog.js';
const items: ResellerCatalogItem[] = [
  { inventoryItemId: '1', sku: 'A', name: 'Energía especial', expansion: 'Set A', number: '12', imageUrl: '', language: 'EN', condition: 'NM', finish: 'holo', tags: 'jugables; promo', cardType: 'energy', remaining: 3, sellable: 0, priceArs: 2000 },
  { inventoryItemId: '2', sku: 'B', name: 'Supporter', expansion: 'Set B', number: '2', imageUrl: '', language: 'JP', condition: 'LP', finish: 'normal', cardType: 'supporter', remaining: 2, sellable: 1, priceArs: 3000 },
  { inventoryItemId: '3', sku: 'C', name: 'Master set', expansion: 'Set A', number: '', imageUrl: '', itemKind: 'folder', availableQuantity: 1, priceArs: 4000 },
  { inventoryItemId: '4', sku: 'D', name: 'Unknown', expansion: 'Set A', number: '1', imageUrl: '', language: 'CN', availableQuantity: 7, priceArs: 800 }
];
it('filters both stock views without confusing quantities, card types or folders', () => {
  const filter = (patch: Partial<typeof defaultResellerCatalogFilters>) => filterResellerCatalog(items, { ...defaultResellerCatalogFilters, ...patch }).map((item) => item.inventoryItemId);
  assert.deepEqual(filter({ search: 'especial energia' }), ['1']);
  assert.deepEqual(filter({ cardType: 'supporter', languageGroup: 'japanese', condition: 'LP', finish: 'normal' }), ['2']);
  assert.deepEqual(filter({ cardType: 'unknown' }), ['4']);
  assert.deepEqual(filter({ tag: 'promo', expansion: 'Set A' }), ['1']);
  assert.deepEqual(filter({ availability: 'sellable' }), ['2']);
  assert.deepEqual(filter({ availability: 'restricted' }), ['1', '3', '2', '4']);
  assert.deepEqual(filter({ sort: 'quantity' }), ['4', '1', '2', '3']);
  assert.deepEqual(filter({ sort: 'price' }), ['3', '2', '1', '4']);
  assert.equal(items[0].inventoryItemId, '1');
});
