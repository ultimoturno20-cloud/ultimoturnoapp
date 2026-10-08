import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import {
  addInventoryStock, addInventoryFolder151Template, adjustInventoryQuantity, createOperationalDatabase,
  createSale, completeReservationSale, getDefaultOperationalUser, getInventoryFolderContents, listStockForBusiness,
  removeInventoryFolderEntry, replacePriceChartingCache, revalueInventoryFolders,
  saveInventoryFolderEntry, upsertInventoryItem
} from "./index.js";
import { masterSet151Contents, masterSet151ImageUrl } from "./folder-templates.js";

const folderInput = {
  itemKind: "folder" as const, name: "Mi carpeta", expansion: "Coleccion", language: "EN",
  condition: "NM", finish: "carpeta", quantityOnHand: 1, quantityReserved: 0,
  priceArs: 9000, inventoryStatus: "not_for_sale"
};
const card = (id: string, name: string, number: string, price: number | null) => ({
  priceChartingId: id, productName: name, normalizedName: name.toLowerCase(),
  canonicalUrl: "", sourceUrl: "", expansionName: "Pokemon Scarlet & Violet 151",
  normalizedExpansion: "pokemon scarlet violet 151", cardNumber: number,
  loosePriceUsd: price, imageUrl: "", searchKey: name.toLowerCase()
});
const cache = (hash: string, rows: ReturnType<typeof card>[]) => ({
  category: "pokemon-cards", sourceHash: hash, rowsReceived: rows.length, rowsSkipped: 0, rows
});

it("keeps folders unique and values only their contents at the latest prices", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-folder-"));
  const db = await createOperationalDatabase({ dataDir });
  t.after(() => db.close());
  const actor = await getDefaultOperationalUser(db);
  const first = await addInventoryStock(db, folderInput, actor);
  const second = await addInventoryStock(db, folderInput, actor);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.product.id, second.product.id);
  assert.notEqual(first.sku, second.sku);
  await assert.rejects(addInventoryStock(db, { ...folderInput, quantityOnHand: 2 }, actor), /unico/);
  await assert.rejects(adjustInventoryQuantity(db, { inventoryItemId: first.id, quantityDelta: 1, note: "Test" }, actor), /unico/);
  await replacePriceChartingCache(db, cache("folder-first", [card("folder-normal", "Pikachu", "25", 10), card("folder-reverse", "Pikachu [Reverse Holo]", "25", 20), card("folder-promo", "Mew ex", "53", null)]));
  await saveInventoryFolderEntry(db, first.id, { priceChartingId: "folder-normal", quantity: 2 }, actor);
  await saveInventoryFolderEntry(db, first.id, { priceChartingId: "folder-reverse", quantity: 1 }, actor);
  await saveInventoryFolderEntry(db, first.id, { priceChartingId: "folder-promo", quantity: 1 }, actor);
  await assert.rejects(saveInventoryFolderEntry(db, first.id, { priceChartingId: "folder-normal", quantity: 1 }, actor), /ya esta/);
  let stock = revalueInventoryFolders(await listStockForBusiness(db, actor.businessId), 1000);
  assert.equal(stock.summary.totalUnits, 2);
  assert.equal(stock.summary.totalSkus, 2);
  assert.equal(stock.summary.availableUnits, 0);
  assert.equal(stock.summary.stockValueArs, 0);
  assert.equal(stock.summary.totalValueArs, 40000);
  assert.equal(stock.items.find((item) => item.id === first.id)?.folder?.totalCards, 4);
  assert.equal(stock.items.find((item) => item.id === first.id)?.folder?.missingPrices, 1);
  assert.equal(stock.items.find((item) => item.id === first.id)?.priceArs, 9000);
  await replacePriceChartingCache(db, cache("folder-next", [card("folder-normal", "Pikachu", "25", 12), card("folder-reverse", "Pikachu [Reverse Holo]", "25", 21), card("folder-promo", "Mew ex", "53", 5)]));
  stock = revalueInventoryFolders(await listStockForBusiness(db, actor.businessId), 1000);
  assert.equal(stock.summary.totalValueArs, 50000);
  assert.equal(stock.summary.collectionValueArs, 50000);
  const entries = await getInventoryFolderContents(db, first.id, actor);
  await db.query(`insert into pricecharting_image_cache (pricecharting_id, public_url, source_image_url)
    values ('folder-normal', 'https://storage.example.test/pikachu.png', 'https://source.example.test/pikachu.png')`);
  await db.query(`insert into card_index_entries (id, pricecharting_id, canonical_name, normalized_name, image_url)
    values ($1, 'folder-normal', 'Pikachu', 'pikachu', 'https://index.example.test/pikachu.png')`, [crypto.randomUUID()]);
  let imageEntries = await getInventoryFolderContents(db, first.id, actor);
  assert.equal(imageEntries.length, entries.length);
  assert.equal(imageEntries.find((entry) => entry.priceChartingId === "folder-normal")?.imageUrl, "https://storage.example.test/pikachu.png");
  assert.equal(imageEntries.find((entry) => entry.priceChartingId === "folder-normal")?.imageFallbackUrl, "https://index.example.test/pikachu.png");
  assert.equal(imageEntries.find((entry) => entry.priceChartingId === "folder-promo")?.imageUrl, "");
  await db.query("update pricecharting_image_cache set public_url = '' where pricecharting_id = 'folder-normal'");
  imageEntries = await getInventoryFolderContents(db, first.id, actor);
  assert.equal(imageEntries.find((entry) => entry.priceChartingId === "folder-normal")?.imageUrl, "https://index.example.test/pikachu.png");
  await assert.rejects(removeInventoryFolderEntry(db, second.id, entries[0].id, actor), /No se encontro/);
  await assert.rejects(getInventoryFolderContents(db, first.id, { ...actor, businessId: "00000000-0000-0000-0000-000000000001" }), /No se encontro/);
  await assert.rejects(getInventoryFolderContents(db, first.id, { ...actor, id: "00000000-0000-0000-0000-000000000002", roles: ["stock_owner"] }), /otro propietario/);
  await saveInventoryFolderEntry(db, first.id, { id: entries.find((entry) => entry.priceChartingId === "folder-normal")!.id, quantity: 3 }, actor);
  await removeInventoryFolderEntry(db, first.id, entries.find((entry) => entry.priceChartingId === "folder-promo")!.id, actor);
  assert.equal(revalueInventoryFolders(await listStockForBusiness(db, actor.businessId), 1000).summary.totalValueArs, 57000);
  // A cache refresh must retain references used exclusively inside folders.
  await replacePriceChartingCache(db, cache("folder-prune", [card("folder-normal", "Pikachu", "25", 13)]));
  assert.equal((await getInventoryFolderContents(db, first.id, actor)).find((entry) => entry.priceChartingId === "folder-reverse")?.priceUsd, 21);
});

it("builds the 151 checklist idempotently without special promos or sealed products", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-folder-template-"));
  const db = await createOperationalDatabase({ dataDir });
  t.after(() => db.close());
  const actor = await getDefaultOperationalUser(db);
  const folder = await addInventoryStock(db, folderInput, actor);
  const manifest = masterSet151Contents();
  assert.equal(manifest.length, 368);
  assert.equal(manifest.filter((row) => row.finish === "reverse holo").length, 153);
  assert.equal(manifest.filter((row) => !row.number).length, 8);
  assert.equal(manifest.some((row) => row.number === "3" && row.finish === "reverse holo"), false);
  await replacePriceChartingCache(db, cache("folder-151", [
    card("151-normal", "Bulbasaur", "001", 1),
    card("151-reverse", "Bulbasaur [Reverse Holo]", "001", 2),
    card("151-stamp", "Bulbasaur [Pokemon Center]", "001", 99),
    card("151-full", "Charizard ex", "199", 100),
    card("151-energy", "Grass Energy [Cosmos Holo]", "", 3)
  ]));
  let entries = await addInventoryFolder151Template(db, folder.id, actor);
  assert.equal(entries.length, 368);
  assert.equal(entries.filter((entry) => entry.priceChartingId).length, 4);
  assert.equal(entries.some((entry) => entry.priceChartingId === "151-stamp"), false);
  assert.equal(entries.filter((entry) => entry.imageUrl).length, 360);
  assert.equal(entries.find((entry) => entry.number === "2")?.imageUrl, "https://images.pokemontcg.io/sv3pt5/2.png");
  assert.equal(entries.find((entry) => entry.number === "2")?.priceUsd, null);
  assert.equal(entries.find((entry) => entry.priceChartingId === "151-reverse")?.imageUrl, "https://images.pokemontcg.io/sv3pt5/1.png");
  assert.equal(entries.find((entry) => entry.priceChartingId === "151-energy")?.imageUrl, "");
  entries = await addInventoryFolder151Template(db, folder.id, actor);
  assert.equal(entries.length, 368);
  const missing = entries.find((entry) => !entry.priceChartingId)!;
  await saveInventoryFolderEntry(db, folder.id, { id: missing.id, quantity: 2 }, actor);
  await addInventoryFolder151Template(db, folder.id, actor);
  assert.equal((await getInventoryFolderContents(db, folder.id, actor)).find((entry) => entry.id === missing.id)?.quantity, 2);
  const stock = await listStockForBusiness(db, actor.businessId);
  assert.equal(stock.summary.totalUnits, 1);
  assert.equal(stock.items[0].folder?.valueUsd, 106);
  assert.equal(stock.items[0].folder?.missingPrices, 365);
});

it("limits checklist artwork to the exact numbered 151 template entry", () => {
  assert.equal(masterSet151ImageUrl("151:1:reverse", "001/165", "Pokemon Scarlet & Violet 151"), "https://images.pokemontcg.io/sv3pt5/1.png");
  assert.equal(masterSet151ImageUrl("151:1:base", "2", "Scarlet & Violet 151"), "");
  assert.equal(masterSet151ImageUrl("151:1:base", "1", "Pokemon Promo"), "");
  assert.equal(masterSet151ImageUrl("manual:1", "1", "Scarlet & Violet 151"), "");
  assert.equal(masterSet151ImageUrl("151:energy:grass", "", "Scarlet & Violet 151"), "");
  assert.equal(masterSet151ImageUrl("151:208:base", "208", "Scarlet & Violet 151"), "");
});

it("sells a folder as one unit and locks its contents while reserved or sold", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-folder-sale-"));
  const db = await createOperationalDatabase({ dataDir });
  t.after(() => db.close());
  const actor = await getDefaultOperationalUser(db);
  const folder = await addInventoryStock(db, folderInput, actor);
  await replacePriceChartingCache(db, cache("folder-sale", [card("folder-sale-card", "Pikachu", "25", 10)]));
  const entries = await saveInventoryFolderEntry(db, folder.id, { priceChartingId: "folder-sale-card", quantity: 1 }, actor);
  const sale = { customerName: "Test", saleType: "reservation" as const, channel: "test", lines: [{ inventoryItemId: folder.id, quantity: 1, unitPriceArs: 9000 }] };
  await assert.rejects(createSale(db, sale, actor), /solo quedan 0/);
  await upsertInventoryItem(db, { ...folderInput, sku: folder.sku, inventoryStatus: "available" }, actor);
  const reservation = await createSale(db, sale, actor);
  await assert.rejects(removeInventoryFolderEntry(db, folder.id, entries[0].id, actor), /reservada o vendida/);
  await assert.rejects(saveInventoryFolderEntry(db, folder.id, { id: entries[0].id, quantity: 2 }, actor), /reservada o vendida/);
  assert.equal((await getInventoryFolderContents(db, folder.id, actor))[0].quantity, 1);
  await completeReservationSale(db, reservation.id, actor);
  assert.equal((await listStockForBusiness(db, actor.businessId)).summary.totalValueArs, 0);
  await assert.rejects(removeInventoryFolderEntry(db, folder.id, entries[0].id, actor), /reservada o vendida/);
});
