import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  adjustInventoryQuantity,
  addPriceChartingCardsToClaim,
  claimPriceChartingImageQueue,
  closeActiveClaim,
  completeReservationSale,
  createClaimSession,
  createClaimSection,
  createPurchase,
  createSale,
  createOperationalDatabase,
  ensurePriceChartingImageQueueForAll,
  getDefaultOperationalUser,
  enrichCardIndexFromTcgCsv,
  getCardIndexStatus,
  getPriceChartingImageCacheStatus,
  getTcgplayerPriceCacheStatus,
  loadExampleInventory,
  listMovements,
  listClaimsWorkspace,
  listPriceChartingCache,
  listStockForBusiness,
  listSales,
  previewActiveClaimOrders,
  previewInventorySnapshot,
  recordPriceChartingImageFailure,
  recordPriceChartingImageSuccess,
  recordPriceChartingImageUrlDiscovered,
  replacePriceChartingCache,
  replaceTcgplayerPriceCache,
  refreshActiveClaimPricesFromPriceCharting,
  refreshCardIndexFromPriceCharting,
  updateClaimCard,
  upsertInventoryItem
} from "./index.js";

describe("operational inventory database", () => {
  it("persists products and inventory adjustments across reopen", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-operational-"));
    const options = {
      dataDir
    };

    const db = await createOperationalDatabase(options);
    const user = await getDefaultOperationalUser(db);
    const item = await upsertInventoryItem(db, {
      sku: "TEST-PIKA-001",
      name: "Pikachu Test",
      expansion: "Set Test",
      number: "001",
      language: "EN",
      condition: "NM",
      finish: "normal",
      location: "Caja test",
      quantityOnHand: 2,
      quantityReserved: 0,
      priceArs: 1000,
      priceUsd: 1
    }, user);
    await adjustInventoryQuantity(db, {
      inventoryItemId: item.id,
      quantityDelta: 3,
      note: "Ajuste test"
    }, user);
    await db.close();

    const reopened = await createOperationalDatabase(options);
    const stock = await listStockForBusiness(reopened, user.businessId);
    const persisted = stock.items.find((row) => row.sku === "TEST-PIKA-001");
    const movements = await listMovements(reopened, user.businessId);
    assert.equal(persisted?.quantityOnHand, 5);
    assert.equal(stock.summary.totalSkus, 1);
    assert.equal(movements.movements.filter((movement) => movement.sku === "TEST-PIKA-001").length, 2);
    assert.ok(movements.movements.some((movement) => movement.sku === "TEST-PIKA-001" && movement.quantityDelta === 2 && movement.note === "Carga manual inicial de inventario"));
    assert.ok(movements.movements.some((movement) => movement.sku === "TEST-PIKA-001" && movement.quantityDelta === 3 && movement.note === "Ajuste test"));
    await reopened.close();
  });

  it("loads example inventory idempotently for local exploration", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-examples-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);

    const first = await loadExampleInventory(db, user);
    const second = await loadExampleInventory(db, user);
    const stock = await listStockForBusiness(db, user.businessId);

    assert.equal(first.created, 5);
    assert.equal(second.created, 0);
    assert.equal(second.skipped, 5);
    assert.equal(stock.summary.totalSkus, 5);
    assert.ok(stock.summary.totalUnits > 0);
    await db.close();
  });

  it("persists reservations, completed sales and purchases with correct stock", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-commerce-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    const item = await upsertInventoryItem(db, {
      sku: "TEST-COMMERCE-001",
      name: "Eevee Comercio",
      expansion: "Set Operativo",
      number: "133",
      language: "EN",
      condition: "NM",
      finish: "normal",
      quantityOnHand: 5,
      quantityReserved: 0,
      priceArs: 2000
    }, user);

    const reservation = await createSale(db, {
      customerName: "Cliente Test",
      saleType: "reservation",
      channel: "whatsapp",
      lines: [{ inventoryItemId: item.id, quantity: 2, unitPriceArs: 1800 }]
    }, user);
    let stock = await listStockForBusiness(db, user.businessId);
    assert.equal(stock.items[0].quantityReserved, 2);
    assert.equal(stock.items[0].availableQuantity, 3);

    await completeReservationSale(db, reservation.id, user);
    stock = await listStockForBusiness(db, user.businessId);
    assert.equal(stock.items[0].quantityOnHand, 3);
    assert.equal(stock.items[0].quantityReserved, 0);
    assert.equal((await listSales(db, user.businessId)).sales[0].status, "paid");

    await createPurchase(db, {
      sellerName: "Proveedor Test",
      lines: [{ inventoryItemId: item.id, quantity: 4, unitCostArs: 900 }]
    }, user);
    stock = await listStockForBusiness(db, user.businessId);
    assert.equal(stock.items[0].quantityOnHand, 7);
    await db.close();
  });

  it("closes a claim into pending buyer orders without requiring stock items", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-claims-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "claim-cache-test",
      rowsReceived: 2,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "claim-pika-25",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
        productName: "Pikachu",
        normalizedName: "pikachu",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "25",
        loosePriceUsd: 4.99,
        imageUrl: "https://example.invalid/pikachu.jpg",
        searchKey: "pikachu promo 25"
      }, {
        priceChartingId: "claim-zard-usd",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/charizard-usd",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/charizard-usd",
        productName: "Charizard",
        normalizedName: "charizard",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "6",
        loosePriceUsd: 150,
        imageUrl: "https://example.invalid/charizard.jpg",
        searchKey: "charizard promo 6"
      }]
    });

    let workspace = await createClaimSession(db, { name: "Claim Test" }, user);
    assert.equal(workspace.activeClaim?.name, "Claim Test");
    workspace = await addPriceChartingCardsToClaim(db, ["claim-pika-25", "claim-zard-usd"], user);
    assert.equal(workspace.cards.length, 2);
    const pika = workspace.cards.find((card) => card.priceChartingId === "claim-pika-25")!;
    const zard = workspace.cards.find((card) => card.priceChartingId === "claim-zard-usd")!;
    assert.equal(pika.suggestedArs, 8000);

    workspace = await updateClaimCard(db, pika.id, {
      finalPriceArs: 9000,
      buyer: "Juan 4657",
      tags: "@juan"
    }, user);
    workspace = await updateClaimCard(db, zard.id, {
      finalPriceUsd: 150,
      quantity: 3,
      buyer: "Ana,Ana",
      tags: "@ana"
    }, user);
    assert.equal(workspace.summary.buyers, 2);
    assert.equal(workspace.summary.totalArs, 9000);
    assert.equal(workspace.summary.totalUsd, 300);
    assert.equal(workspace.summary.claimTotalUsd, 450);
    workspace = await closeActiveClaim(db, user);
    assert.equal(workspace.activeClaim, null);

    const sales = await listSales(db, user.businessId);
    assert.equal(sales.sales.length, 2);
    const juanSale = sales.sales.find((sale) => sale.customerName === "Juan 4657")!;
    const anaSale = sales.sales.find((sale) => sale.customerName === "Ana")!;
    assert.equal(juanSale.status, "pending");
    assert.equal(juanSale.channel, "claim");
    assert.equal(juanSale.lines[0].name, "Pikachu - Promo - $9000");
    assert.ok(juanSale.lines[0].inventoryItemId);
    assert.equal(anaSale.totalArs, 0);
    assert.equal(anaSale.totalUsd, 300);
    assert.equal(anaSale.lines[0].priceCurrency, "USD");
    assert.equal(anaSale.lines[0].quantity, 2);
    assert.equal(anaSale.lines[0].unitPriceUsd, 150);
    assert.equal(anaSale.lines[0].lineTotalUsd, 300);
    const stock = await listStockForBusiness(db, user.businessId);
    const claimedItem = stock.items.find((item) => item.id === juanSale.lines[0].inventoryItemId);
    assert.equal(claimedItem?.quantityOnHand, 1);
    assert.equal(claimedItem?.quantityReserved, 1);
    assert.equal(claimedItem?.availableQuantity, 0);
    const unsoldItem = stock.items.find((item) => item.id === anaSale.lines[0].inventoryItemId);
    assert.equal(unsoldItem?.quantityOnHand, 3);
    assert.equal(unsoldItem?.quantityReserved, 2);
    assert.equal(unsoldItem?.availableQuantity, 1);
    await db.close();
  });

  it("shows cached images for restored claim sale lines without inventory items", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-restored-claim-sale-images-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "restored-claim-sale-image",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "7980043",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/restored-card",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/restored-card",
        productName: "Restored Claim Card",
        normalizedName: "restored claim card",
        expansionName: "Claim Test",
        normalizedExpansion: "claim test",
        cardNumber: "7",
        loosePriceUsd: 10,
        imageUrl: "",
        searchKey: "restored claim card claim test 7"
      }]
    });
    await recordPriceChartingImageSuccess(db, {
      priceChartingId: "7980043",
      sourceImageUrl: "https://storage.googleapis.com/images.pricecharting.com/7980043/1600.jpg",
      localPath: path.join(dataDir, "pricecharting-images", "7980043.jpg"),
      publicUrl: "/pricecharting-images/files/7980043.jpg",
      contentType: "image/jpeg",
      byteSize: 207117,
      contentHash: "restored-hash"
    });

    await db.query(`
      insert into sales (id, business_id, customer_name, sale_type, status, channel, total_ars, total_usd, created_by)
      values ('00000000-0000-4000-8000-000000000101', $1, 'Cliente restaurado', 'reservation', 'pending', 'claim', 12000, 0, $2)
    `, [user.businessId, user.id]);
    await db.query(`
      insert into sale_items (
        id, business_id, sale_id, inventory_item_id, quantity, unit_price_ars, line_total_ars, display_name, sku_snapshot
      )
      values (
        '00000000-0000-4000-8000-000000000102', $1, '00000000-0000-4000-8000-000000000101',
        null, 1, 12000, 12000, 'Restored Claim Card - Claim Test - $12000', 'PKM-PC-7980043'
      )
    `, [user.businessId]);

    const sales = await listSales(db, user.businessId);
    assert.equal(sales.sales.length, 1);
    assert.equal(sales.sales[0].lines[0].inventoryItemId, "");
    assert.equal(sales.sales[0].lines[0].imageUrl, "/pricecharting-images/files/7980043.jpg");
    await db.close();
  });

  it("refreshes only active claim price fields from PriceCharting", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-claim-prices-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "claim-price-cache-old",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "claim-pika-price",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-price",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-price",
        productName: "Pikachu",
        normalizedName: "pikachu",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "25",
        loosePriceUsd: 4.99,
        imageUrl: "https://example.invalid/pikachu-old.jpg",
        searchKey: "pikachu promo 25"
      }]
    });

    let workspace = await createClaimSession(db, { name: "Claim Precios" }, user);
    workspace = await createClaimSection(db, { name: "Jugable" }, user);
    const sectionId = workspace.sections[0].id;
    workspace = await addPriceChartingCardsToClaim(db, ["claim-pika-price"], user, sectionId);
    workspace = await updateClaimCard(db, workspace.cards[0].id, {
      finalPriceArs: 9000,
      finalPriceUsd: 0,
      finalName: "Pika vendido",
      buyer: "Mati",
      tags: "@mati",
      status: "ready"
    }, user);
    const before = workspace.cards[0];

    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "claim-price-cache-new",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "claim-pika-price",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-price-new",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-price-new",
        productName: "Pikachu Changed",
        normalizedName: "pikachu changed",
        expansionName: "Promo Changed",
        normalizedExpansion: "promo changed",
        cardNumber: "99",
        loosePriceUsd: 10,
        imageUrl: "https://example.invalid/pikachu-new.jpg",
        searchKey: "pikachu changed promo 99"
      }]
    });

    const result = await refreshActiveClaimPricesFromPriceCharting(db, user);
    assert.equal(result.updated, 1);
    assert.equal(result.unchanged, 0);
    assert.equal(result.missing, 0);
    const after = result.workspace.cards[0];
    assert.equal(after.pcPriceUsd, 10);
    assert.equal(after.suggestedArs, 15500);
    assert.equal(after.sectionId, before.sectionId);
    assert.equal(after.sortOrder, before.sortOrder);
    assert.equal(after.productName, before.productName);
    assert.equal(after.expansionName, before.expansionName);
    assert.equal(after.cardNumber, before.cardNumber);
    assert.equal(after.imageUrl, before.imageUrl);
    assert.equal(after.canonicalUrl, before.canonicalUrl);
    assert.equal(after.finalPriceArs, before.finalPriceArs);
    assert.equal(after.finalPriceUsd, before.finalPriceUsd);
    assert.equal(after.finalName, before.finalName);
    assert.equal(after.buyer, before.buyer);
    assert.equal(after.tags, before.tags);
    assert.equal(after.status, before.status);
    await db.close();
  });

  it("creates stock from a PriceCharting purchase and exposes the last purchase cost", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-purchase-pricecharting-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "purchase-cache-test",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "psyduck-reverse-44",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-test/psyduck-44-reverse-holo",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-test/psyduck-44-reverse-holo",
        productName: "Psyduck Reverse Holo",
        normalizedName: "psyduck reverse holo",
        expansionName: "Test Set",
        normalizedExpansion: "test set",
        cardNumber: "044",
        loosePriceUsd: 2.25,
        imageUrl: "https://example.invalid/psyduck.jpg",
        searchKey: "psyduck reverse holo test set 044"
      }]
    });

    await createPurchase(db, {
      sellerName: "Proveedor Psyduck",
      lines: [{ priceChartingId: "psyduck-reverse-44", quantity: 2, unitCostArs: 1200 }]
    }, user);

    const stock = await listStockForBusiness(db, user.businessId);
    const item = stock.items.find((row) => row.sku === "PKM-PC-psyduck-reverse-44");
    assert.equal(item?.product.name, "Psyduck");
    assert.equal(item?.product.number, "044");
    assert.equal(item?.variant.finish, "reverse holo");
    assert.equal(item?.quantityOnHand, 2);
    assert.equal(item?.lastPurchaseArs, 1200);
    await db.close();
  });

  it("splits claim card quantities across comma-separated buyers", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-claim-quantity-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "claim-quantity-cache",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "claim-eevee-133",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/eevee-133",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/eevee-133",
        productName: "Eevee",
        normalizedName: "eevee",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "133",
        loosePriceUsd: 8,
        imageUrl: "https://example.invalid/eevee.jpg",
        searchKey: "eevee promo 133"
      }]
    });

    let workspace = await createClaimSession(db, { name: "Claim Cantidades" }, user);
    workspace = await addPriceChartingCardsToClaim(db, ["claim-eevee-133"], user);
    workspace = await updateClaimCard(db, workspace.cards[0].id, {
      finalPriceArs: 12000,
      quantity: 2,
      buyer: "Juan, Pedro"
    }, user);
    assert.equal(workspace.summary.cards, 2);
    assert.equal(workspace.summary.cardsWithBuyer, 2);
    assert.equal(workspace.summary.buyers, 2);

    const preview = await previewActiveClaimOrders(db, user);
    assert.equal(preview.claimName, "Claim Cantidades");
    assert.equal(preview.totals.buyers, 2);
    assert.equal(preview.totals.units, 2);
    assert.equal(preview.totals.totalArs, 24000);
    assert.equal(preview.buyers.find((buyer) => buyer.buyer === "Juan")?.lines[0].displayName, "Eevee - Promo - $12mil");
    assert.equal((await listClaimsWorkspace(db, user.businessId)).activeClaim?.name, "Claim Cantidades");

    await closeActiveClaim(db, user);
    const sales = await listSales(db, user.businessId);
    assert.equal(sales.sales.length, 2);
    for (const buyer of ["Juan", "Pedro"]) {
      const sale = sales.sales.find((item) => item.customerName === buyer);
      assert.ok(sale);
      assert.equal(sale.totalArs, 12000);
      assert.equal(sale.lines[0].quantity, 1);
      assert.equal(sale.lines[0].name, "Eevee - Promo - $12mil");
    }
    const stock = await listStockForBusiness(db, user.businessId);
    const claimedItem = stock.items.find((item) => item.product.name === "Eevee");
    assert.equal(claimedItem?.quantityOnHand, 2);
    assert.equal(claimedItem?.quantityReserved, 2);
    await db.close();
  });

  it("builds a master card index and enriches it with TCGCSV product links", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-card-index-"));
    const db = await createOperationalDatabase({ dataDir });
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "card-index-test",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "lugia-vstar-139",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-silver-tempest/lugia-vstar-139",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-silver-tempest/lugia-vstar-139",
        productName: "Lugia VSTAR",
        normalizedName: "lugia vstar",
        expansionName: "Silver Tempest",
        normalizedExpansion: "silver tempest",
        cardNumber: "139",
        loosePriceUsd: 12.5,
        imageUrl: "",
        searchKey: "lugia vstar silver tempest 139"
      }]
    });

    let status = await refreshCardIndexFromPriceCharting(db);
    assert.equal(status.totalEntries, 1);
    assert.equal(status.tcgplayerLinkedEntries, 0);

    const result = await enrichCardIndexFromTcgCsv(db, {
      groups: [{ groupId: 3170, name: "SWSH12: Silver Tempest", abbreviation: "SWSH12" }],
      products: [{
        productId: 451396,
        name: "Lugia VSTAR",
        cleanName: "Lugia VSTAR",
        imageUrl: "https://tcgplayer-cdn.tcgplayer.com/product/451396_200w.jpg",
        url: "https://www.tcgplayer.com/product/451396/pokemon-swsh12-silver-tempest-lugia-vstar",
        groupId: 3170,
        extendedData: [{ name: "Number", displayName: "Card Number", value: "139/195" }]
      }]
    });

    assert.equal(result.rowsMatched, 1);
    status = await getCardIndexStatus(db);
    assert.equal(status.tcgplayerLinkedEntries, 1);
    assert.equal(status.matchedEntries, 1);
    await db.close();
  });

  it("flags similar import rows for explicit review", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-review-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await upsertInventoryItem(db, {
      sku: "TEST-IMPORT-PIKA",
      name: "Pikachu",
      expansion: "Promo Test",
      number: "025",
      language: "JA",
      condition: "NM",
      finish: "holo",
      quantityOnHand: 1,
      priceArs: 5000
    }, user);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-review",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "pika-25",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-25",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-25",
        productName: "Pikachu",
        normalizedName: "pikachu",
        expansionName: "Promo Test",
        normalizedExpansion: "promo test",
        cardNumber: "025",
        loosePriceUsd: 4.99,
        imageUrl: "",
        searchKey: "pikachu promo test 025"
      }]
    });
    const preview = await previewInventorySnapshot(db, `sku,name,expansion,number,language,condition,finish,quantityOnHand,priceArs\n,ピカチュウ,Promo Test,025,JA,NM,holo,1,5500`, user.businessId);
    assert.equal(preview.summary.review, 1);
    assert.equal(preview.rows[0].candidates[0].sku, "TEST-IMPORT-PIKA");
    assert.equal(preview.rows[0].priceChartingId, "pika-25");
    await db.close();
  });

  it("links Japanese import rows to a single PriceCharting match by expansion and number", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "oddish-2",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-japanese-double-blaze/oddish-2",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-japanese-double-blaze/oddish-2",
        productName: "Oddish",
        normalizedName: "oddish",
        expansionName: "Japanese Double Blaze",
        normalizedExpansion: "japanese double blaze",
        cardNumber: "2/107",
        loosePriceUsd: 0.15,
        imageUrl: "/pricecharting-images/files/oddish-2.jpg",
        searchKey: "oddish japanese double blaze 2 107"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nナゾノクサ,Double Blaze,2/107,JA,NM,normal,9,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].name, "Oddish");
    assert.equal(preview.rows[0].priceChartingId, "oddish-2");
    assert.equal(preview.rows[0].priceChartingUrl, "https://www.pricecharting.com/game/pokemon-japanese-double-blaze/oddish-2");
    await db.close();
  });

  it("accepts MonPrice scanner CSV exports with preamble rows", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-monprice-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-monprice",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "lillie-192",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-ascended-heroes/lillie-s-determination-192",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-ascended-heroes/lillie-s-determination-192",
        productName: "Lillie's Determination",
        normalizedName: "lillie s determination",
        expansionName: "Ascended Heroes",
        normalizedExpansion: "ascended heroes",
        cardNumber: "192",
        loosePriceUsd: 1.13,
        imageUrl: "https://tcgplayer-cdn.tcgplayer.com/product/676004_in_1000x1000.jpg",
        languageGroup: "english",
        searchKey: "lillie s determination ascended heroes 192"
      }]
    });
    const csv = [
      "MonPrice export",
      "Generated,2026-09-11",
      "ID,Name,Number,Set,Count,Language,Finish Type,Reverse Holo,Average Price,Series,Rarity",
      "mp-1,Lillie's Determination,192,Ascended Heroes,3,English,,FALSE,1.13,Mega Evolution,Uncommon"
    ].join("\n");
    const preview = await previewInventorySnapshot(db, csv, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].rowNumber, 4);
    assert.equal(preview.rows[0].quantityOnHand, 3);
    assert.equal(preview.rows[0].language, "EN");
    assert.equal(preview.rows[0].finish, "normal");
    assert.equal(preview.rows[0].monPriceId, "mp-1");
    assert.equal(preview.rows[0].priceUsd, 1.13);
    assert.equal(preview.rows[0].priceChartingId, "lillie-192");
    assert.equal(preview.rows[0].imageUrl, "https://tcgplayer-cdn.tcgplayer.com/product/676004_in_1000x1000.jpg");
    assert.match(preview.rows[0].notes || "", /Serie MonPrice/);
    await db.close();
  });

  it("does not keep same-number PriceCharting matches from other expansions", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-expansion-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting-expansion",
      rowsReceived: 3,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "oddish-double-blaze",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-japanese-double-blaze/oddish-2",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-japanese-double-blaze/oddish-2",
        productName: "Oddish",
        normalizedName: "oddish",
        expansionName: "Japanese Double Blaze",
        normalizedExpansion: "japanese double blaze",
        cardNumber: "2",
        loosePriceUsd: 3.25,
        imageUrl: "",
        searchKey: "oddish japanese double blaze 2"
      }, {
        priceChartingId: "oddish-mcdonalds",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-japanese-mcdonalds-2002/oddish-2",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-japanese-mcdonalds-2002/oddish-2",
        productName: "Oddish",
        normalizedName: "oddish",
        expansionName: "Japanese 2002 McDonald's",
        normalizedExpansion: "japanese 2002 mcdonald s",
        cardNumber: "2",
        loosePriceUsd: 34.77,
        imageUrl: "",
        searchKey: "oddish japanese 2002 mcdonald s 2"
      }, {
        priceChartingId: "oddish-cosmic-eclipse",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/oddish-2",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-cosmic-eclipse/oddish-2",
        productName: "Oddish",
        normalizedName: "oddish",
        expansionName: "Cosmic Eclipse",
        normalizedExpansion: "cosmic eclipse",
        cardNumber: "2",
        loosePriceUsd: 0.84,
        imageUrl: "",
        searchKey: "oddish cosmic eclipse 2"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nOddish,Double Blaze,2/107,JA,NM,normal,9,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].priceChartingId, "oddish-double-blaze");
    assert.equal(preview.rows[0].priceChartingCandidates.length, 1);
    await db.close();
  });

  it("requires matching name, expansion and number for PriceCharting import identity", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-strict-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting-strict",
      rowsReceived: 3,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "voltorb-returns",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-team-rocket-returns/voltorb-80",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-team-rocket-returns/voltorb-80",
        productName: "Voltorb",
        normalizedName: "voltorb",
        expansionName: "Team Rocket Returns",
        normalizedExpansion: "team rocket returns",
        cardNumber: "80",
        loosePriceUsd: 2.74,
        imageUrl: "",
        searchKey: "voltorb team rocket returns 80"
      }, {
        priceChartingId: "rainbow-team-rocket",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-team-rocket/rainbow-energy-80",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-team-rocket/rainbow-energy-80",
        productName: "Rainbow Energy",
        normalizedName: "rainbow energy",
        expansionName: "Team Rocket",
        normalizedExpansion: "team rocket",
        cardNumber: "80",
        loosePriceUsd: 7.69,
        imageUrl: "",
        searchKey: "rainbow energy team rocket 80"
      }, {
        priceChartingId: "rainbow-team-rocket-1st",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-team-rocket/rainbow-energy-80-1st-edition",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-team-rocket/rainbow-energy-80-1st-edition",
        productName: "Rainbow Energy [1st Edition]",
        normalizedName: "rainbow energy 1st edition",
        expansionName: "Team Rocket",
        normalizedExpansion: "team rocket",
        cardNumber: "80",
        loosePriceUsd: 11.49,
        imageUrl: "",
        searchKey: "rainbow energy 1st edition team rocket 80"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nVoltorb,Team Rocket Returns,80/111,EN,NM,normal,32,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].priceChartingId, "voltorb-returns");
    assert.equal(preview.rows[0].priceChartingCandidates.length, 1);
    await db.close();
  });

  it("matches PriceCharting names that add a colon subtitle", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-colon-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting-colon",
      rowsReceived: 2,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "boss-corbeau",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-ascended-heroes/bosss-orders-corbeau-183",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-ascended-heroes/bosss-orders-corbeau-183",
        productName: "Boss's Orders: Corbeau",
        normalizedName: "boss s orders corbeau",
        expansionName: "Ascended Heroes",
        normalizedExpansion: "ascended heroes",
        cardNumber: "183",
        loosePriceUsd: 1.6,
        imageUrl: "",
        searchKey: "boss s orders corbeau ascended heroes 183"
      }, {
        priceChartingId: "boss-corbeau-reverse",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-ascended-heroes/bosss-orders-corbeau-183-reverse-holo",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-ascended-heroes/bosss-orders-corbeau-183-reverse-holo",
        productName: "Boss's Orders: Corbeau [Reverse Holo]",
        normalizedName: "boss s orders corbeau reverse holo",
        expansionName: "Ascended Heroes",
        normalizedExpansion: "ascended heroes",
        cardNumber: "183",
        loosePriceUsd: 2.4,
        imageUrl: "",
        searchKey: "boss s orders corbeau reverse holo ascended heroes 183"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nBoss's Orders,Ascended Heroes,183/295,EN,NM,normal,19,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].priceChartingId, "boss-corbeau");
    assert.equal(preview.rows[0].priceChartingCandidates.length, 1);
    await db.close();
  });

  it("matches Scarlet and Violet Promos imports against PriceCharting Promo expansion", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-promo-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting-promo",
      rowsReceived: 2,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "zorua-promo",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/ns-zorua-189",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/ns-zorua-189",
        productName: "N's Zorua",
        normalizedName: "n s zorua",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "189",
        loosePriceUsd: 6,
        imageUrl: "",
        searchKey: "n s zorua promo 189"
      }, {
        priceChartingId: "zorua-pokemon-center",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/ns-zorua-189-pokemon-center",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/ns-zorua-189-pokemon-center",
        productName: "N's Zorua [Pokemon Center]",
        normalizedName: "n s zorua pokemon center",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "189",
        loosePriceUsd: 9,
        imageUrl: "",
        searchKey: "n s zorua pokemon center promo 189"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nN's Zorua,Scarlet & Violet Promos,189/217,EN,NM,normal,36,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].priceChartingId, "zorua-promo");
    assert.equal(preview.rows[0].priceChartingCandidates.length, 1);
    await db.close();
  });

  it("matches WotC Promos imports against PriceCharting Promo expansion", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-wotc-promo-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting-wotc-promo",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "smeargle-promo-32",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/smeargle-32",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/smeargle-32",
        productName: "Smeargle",
        normalizedName: "smeargle",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "32",
        loosePriceUsd: 7.5,
        imageUrl: "",
        searchKey: "smeargle promo 32"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nSmeargle,WotC Promos,32,EN,NM,normal,1,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].priceChartingId, "smeargle-promo-32");
    await db.close();
  });

  it("assumes the normal version when no special finish is requested", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-review-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting-review",
      rowsReceived: 2,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "pika-normal",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23",
        productName: "Pikachu",
        normalizedName: "pikachu",
        expansionName: "Promo Test",
        normalizedExpansion: "promo test",
        cardNumber: "23",
        loosePriceUsd: 2,
        imageUrl: "",
        searchKey: "pikachu promo test 23"
      }, {
        priceChartingId: "pika-holo",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23-holo",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23-holo",
        productName: "Pikachu Holo",
        normalizedName: "pikachu holo",
        expansionName: "Promo Test",
        normalizedExpansion: "promo test",
        cardNumber: "23",
        loosePriceUsd: 8,
        imageUrl: "",
        searchKey: "pikachu holo promo test 23"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nPikachu,Promo Test,23,EN,NM,normal,1,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].priceChartingId, "pika-normal");
    assert.equal(preview.rows[0].priceChartingCandidates.length, 1);
    await db.close();
  });

  it("uses bracketed finish details to choose a special PriceCharting variant", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-bracket-finish-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting-bracket-finish",
      rowsReceived: 2,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "pika-normal",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23",
        productName: "Pikachu",
        normalizedName: "pikachu",
        expansionName: "Promo Test",
        normalizedExpansion: "promo test",
        cardNumber: "23",
        loosePriceUsd: 2,
        imageUrl: "",
        searchKey: "pikachu promo test 23"
      }, {
        priceChartingId: "pika-reverse",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23-reverse-holo",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23-reverse-holo",
        productName: "Pikachu Reverse Holo",
        normalizedName: "pikachu reverse holo",
        expansionName: "Promo Test",
        normalizedExpansion: "promo test",
        cardNumber: "23",
        loosePriceUsd: 5,
        imageUrl: "",
        searchKey: "pikachu reverse holo promo test 23"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nPikachu [Reverse Holo],Promo Test,23,EN,NM,normal,1,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].priceChartingId, "pika-reverse");
    await db.close();
  });

  it("uses the collector number before the slash to avoid false PriceCharting choices", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-number-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting-number",
      rowsReceived: 3,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "lillie-169",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-mega-evolution/lillies-determination-169",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-mega-evolution/lillies-determination-169",
        productName: "Lillie's Determination",
        normalizedName: "lillie s determination",
        expansionName: "Mega Evolution",
        normalizedExpansion: "mega evolution",
        cardNumber: "169",
        loosePriceUsd: 21.72,
        imageUrl: "",
        searchKey: "lillie s determination mega evolution 169"
      }, {
        priceChartingId: "lillie-119",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-mega-evolution/lillies-determination-119",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-mega-evolution/lillies-determination-119",
        productName: "Lillie's Determination",
        normalizedName: "lillie s determination",
        expansionName: "Mega Evolution",
        normalizedExpansion: "mega evolution",
        cardNumber: "119",
        loosePriceUsd: 1.19,
        imageUrl: "",
        searchKey: "lillie s determination mega evolution 119"
      }, {
        priceChartingId: "lillie-184",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-mega-evolution/lillies-determination-184",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-mega-evolution/lillies-determination-184",
        productName: "Lillie's Determination",
        normalizedName: "lillie s determination",
        expansionName: "Mega Evolution",
        normalizedExpansion: "mega evolution",
        cardNumber: "184",
        loosePriceUsd: 62.6,
        imageUrl: "",
        searchKey: "lillie s determination mega evolution 184"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nLillie's Determination,Mega Evolution,184/188,EN,NM,normal,68,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].priceChartingId, "lillie-184");
    assert.equal(preview.rows[0].priceChartingCandidates.length, 1);
    await db.close();
  });

  it("uses a specific finish to resolve same-number PriceCharting variants", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-import-pricecharting-finish-"));
    const db = await createOperationalDatabase({ dataDir });
    const user = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-import-pricecharting-finish",
      rowsReceived: 2,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "promo-normal",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23",
        productName: "Pikachu",
        normalizedName: "pikachu",
        expansionName: "Promo Test",
        normalizedExpansion: "promo test",
        cardNumber: "23",
        loosePriceUsd: 2,
        imageUrl: "",
        searchKey: "pikachu promo test 23"
      }, {
        priceChartingId: "promo-cosmos",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23-cosmos-holo",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo-test/pikachu-23-cosmos-holo",
        productName: "Pikachu Cosmos Holo",
        normalizedName: "pikachu cosmos holo",
        expansionName: "Promo Test",
        normalizedExpansion: "promo test",
        cardNumber: "23",
        loosePriceUsd: 8,
        imageUrl: "",
        searchKey: "pikachu cosmos holo promo test 23"
      }]
    });
    const preview = await previewInventorySnapshot(db, `name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nPikachu,Promo Test,23,EN,NM,cosmos holo,1,0`, user.businessId);
    assert.equal(preview.summary.creates, 1);
    assert.equal(preview.rows[0].priceChartingId, "promo-cosmos");
    await db.close();
  });

  it("replaces and searches the persistent PriceCharting cache", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-pricecharting-"));
    const db = await createOperationalDatabase({ dataDir });
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-hash",
      rowsReceived: 2,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "123",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
        productName: "Pikachu",
        normalizedName: "pikachu",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "025",
        loosePriceUsd: 4.99,
        imageUrl: "",
        searchKey: "pikachu promo 025"
      }, {
        priceChartingId: "124",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-jungle/eevee-133",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-jungle/eevee-133",
        productName: "Eevee",
        normalizedName: "eevee",
        expansionName: "Jungle",
        normalizedExpansion: "jungle",
        cardNumber: "133",
        loosePriceUsd: 3.5,
        imageUrl: "",
        searchKey: "eevee jungle 133"
      }, {
        priceChartingId: "125",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-fossil/psyduck-44",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-fossil/psyduck-44",
        productName: "Psyduck",
        normalizedName: "psyduck",
        expansionName: "Fossil",
        normalizedExpansion: "fossil",
        cardNumber: "044",
        loosePriceUsd: 2.25,
        imageUrl: "",
        searchKey: "psyduck fossil 044"
      }, {
        priceChartingId: "126",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-team-rocket/psyduck-65",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-team-rocket/psyduck-65",
        productName: "Psyduck",
        normalizedName: "psyduck",
        expansionName: "Team Rocket",
        normalizedExpansion: "team rocket",
        cardNumber: "65",
        loosePriceUsd: 1.25,
        imageUrl: "",
        searchKey: "psyduck team rocket 65"
      }]
    });
    const cache = await listPriceChartingCache(db, "pikachu", 10);
    assert.equal(cache.entries.length, 1);
    assert.equal(cache.entries[0].loosePriceUsd, 4.99);
    const psyduck = await listPriceChartingCache(db, "psyduck 44", 10);
    assert.equal(psyduck.entries.length, 1);
    assert.equal(psyduck.entries[0].priceChartingId, "125");
    const psyduckWithSlash = await listPriceChartingCache(db, "psyduck 44/62", 10);
    assert.equal(psyduckWithSlash.entries[0].priceChartingId, "125");
    assert.equal(cache.status.totalEntries, 4);
    assert.equal(cache.status.lastRun?.status, "completed");
    await db.close();
  });

  it("replaces TCGplayer prices and reports links through the master index", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-tcgplayer-prices-"));
    const db = await createOperationalDatabase({ dataDir });
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-hash",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "pc-pikachu-25",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
        productName: "Pikachu",
        normalizedName: "pikachu",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "025",
        loosePriceUsd: 4.99,
        imageUrl: "",
        searchKey: "pikachu promo 025"
      }]
    });
    await refreshCardIndexFromPriceCharting(db);
    await enrichCardIndexFromTcgCsv(db, {
      groups: [{ groupId: 900, name: "Pokemon Promo" }],
      products: [{
        productId: 555,
        name: "Pikachu",
        cleanName: "Pikachu",
        groupId: 900,
        imageUrl: "https://tcgplayer-cdn.tcgplayer.com/product/555_200w.jpg",
        url: "https://www.tcgplayer.com/product/555/pokemon-promo-pikachu",
        extendedData: [{ name: "Number", value: "25" }]
      }]
    });

    const firstStatus = await replaceTcgplayerPriceCache(db, {
      source: "tcgcsv",
      categoryId: "3",
      sourceVersion: "test-version-1",
      groupsSeen: 1,
      rowsReceived: 2,
      rowsSkipped: 0,
      rows: [{
        tcgplayerProductId: "555",
        subTypeName: "Normal",
        lowPriceUsd: 1,
        midPriceUsd: 2,
        highPriceUsd: 3,
        marketPriceUsd: 2.5,
        directLowPriceUsd: null,
        sourceGroupId: "900"
      }, {
        tcgplayerProductId: "555",
        subTypeName: "Reverse Holofoil",
        lowPriceUsd: 4,
        midPriceUsd: 5,
        highPriceUsd: 6,
        marketPriceUsd: 5.5,
        directLowPriceUsd: 4.5,
        sourceGroupId: "900"
      }]
    });
    assert.equal(firstStatus.totalEntries, 2);
    assert.equal(firstStatus.productEntries, 1);
    assert.equal(firstStatus.linkedProductEntries, 1);
    assert.equal(firstStatus.linkedCardIndexEntries, 1);

    await replaceTcgplayerPriceCache(db, {
      source: "tcgcsv",
      categoryId: "3",
      sourceVersion: "test-version-2",
      groupsSeen: 1,
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        tcgplayerProductId: "555",
        subTypeName: "Normal",
        lowPriceUsd: 2,
        midPriceUsd: 3,
        highPriceUsd: 4,
        marketPriceUsd: 3.5,
        directLowPriceUsd: null,
        sourceGroupId: "900"
      }]
    });
    const replacedStatus = await getTcgplayerPriceCacheStatus(db);
    assert.equal(replacedStatus.totalEntries, 1);
    assert.equal(replacedStatus.lastRun?.sourceVersion, "test-version-2");
    await db.close();
  });

  it("queues and records local PriceCharting images", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-pricecharting-images-"));
    const db = await createOperationalDatabase({ dataDir });
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-hash",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "123",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
        productName: "Pikachu",
        normalizedName: "pikachu",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "025",
        loosePriceUsd: 4.99,
        imageUrl: "",
        searchKey: "pikachu promo 025"
      }]
    });
    const queued = await ensurePriceChartingImageQueueForAll(db, 10);
    assert.equal(queued.queued, 1);
    const queue = await claimPriceChartingImageQueue(db, 5);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].priceChartingId, "123");
    await recordPriceChartingImageSuccess(db, {
      priceChartingId: "123",
      sourceImageUrl: "https://storage.googleapis.com/images.pricecharting.com/test/1600.jpg",
      localPath: path.join(dataDir, "pricecharting-images", "123.jpg"),
      publicUrl: "/pricecharting-images/files/123.jpg",
      contentType: "image/jpeg",
      byteSize: 120000,
      contentHash: "hash"
    });
    const status = await getPriceChartingImageCacheStatus(db);
    assert.equal(status.downloadedEntries, 1);
    assert.equal(status.bytesStored, 120000);
    const cache = await listPriceChartingCache(db, "pikachu", 10);
    assert.equal(cache.entries[0].imageUrl, "/pricecharting-images/files/123.jpg");
    await db.close();
  });

  it("requeues failed PriceCharting images when the catalog backfill runs again", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-pricecharting-requeue-"));
    const db = await createOperationalDatabase({ dataDir });
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-hash-requeue",
      rowsReceived: 1,
      rowsSkipped: 0,
      rows: [{
        priceChartingId: "456",
        canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/eevee-11",
        sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/eevee-11",
        productName: "Eevee",
        normalizedName: "eevee",
        expansionName: "Promo",
        normalizedExpansion: "promo",
        cardNumber: "011",
        loosePriceUsd: 3.5,
        imageUrl: "",
        searchKey: "eevee promo 011"
      }]
    });
    await ensurePriceChartingImageQueueForAll(db, 10);
    for (let index = 0; index < 5; index += 1) {
      await recordPriceChartingImageFailure(db, { priceChartingId: "456", errorMessage: "HTML sin imagen", retryAfterMinutes: 60 });
    }
    let status = await getPriceChartingImageCacheStatus(db);
    assert.equal(status.failedEntries, 1);

    const requeued = await ensurePriceChartingImageQueueForAll(db, 10);
    assert.equal(requeued.queued, 1);
    status = await getPriceChartingImageCacheStatus(db);
    assert.equal(status.pendingEntries, 1);
    assert.equal(status.failedEntries, 0);
    const queue = await claimPriceChartingImageQueue(db, 5);
    assert.equal(queue[0].priceChartingId, "456");
    await db.close();
  });

  it("can claim only PriceCharting images that already have a discovered URL", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "ultimoturno-pricecharting-url-only-"));
    const db = await createOperationalDatabase({ dataDir });
    await replacePriceChartingCache(db, {
      category: "pokemon-cards",
      sourceHash: "test-hash-url-only",
      rowsReceived: 2,
      rowsSkipped: 0,
      rows: [
        {
          priceChartingId: "url-ready",
          canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
          sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/pikachu-25",
          productName: "Pikachu",
          normalizedName: "pikachu",
          expansionName: "Promo",
          normalizedExpansion: "promo",
          cardNumber: "025",
          loosePriceUsd: 4.99,
          imageUrl: "",
          searchKey: "pikachu promo 025"
        },
        {
          priceChartingId: "missing-url",
          canonicalUrl: "https://www.pricecharting.com/game/pokemon-promo/eevee-11",
          sourceUrl: "https://www.pricecharting.com/game/pokemon-promo/eevee-11",
          productName: "Eevee",
          normalizedName: "eevee",
          expansionName: "Promo",
          normalizedExpansion: "promo",
          cardNumber: "011",
          loosePriceUsd: 3.5,
          imageUrl: "",
          searchKey: "eevee promo 011"
        }
      ]
    });
    await ensurePriceChartingImageQueueForAll(db, 10);
    await recordPriceChartingImageUrlDiscovered(db, {
      priceChartingId: "url-ready",
      sourceImageUrl: "https://images.pokemontcg.io/base1/58_hires.png"
    });

    const urlReadyQueue = await claimPriceChartingImageQueue(db, 10, { includeUrlFound: true, onlyWithSourceImageUrl: true });
    assert.deepEqual(urlReadyQueue.map((entry) => entry.priceChartingId), ["url-ready"]);

    const missingUrlQueue = await claimPriceChartingImageQueue(db, 10, { onlyMissingSourceImageUrl: true });
    assert.deepEqual(missingUrlQueue.map((entry) => entry.priceChartingId), ["missing-url"]);
    await db.close();
  });
});
