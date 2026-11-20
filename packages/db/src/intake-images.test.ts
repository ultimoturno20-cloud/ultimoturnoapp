import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createOperationalDatabase, getDefaultOperationalUser, addInventoryStock, getInventoryItem } from "./index.js";

test("intake preserves stored images across additional units and reopen, language and category remain distinct", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ut-intake-images-"));
  let db = await createOperationalDatabase({ driver: "pglite", dataDir });
  let itemId = "", businessId = "";
  try {
    const actor = await getDefaultOperationalUser(db);
    businessId = actor.businessId;
    const input = { name: "Image fixture", expansion: "QA Images", number: "001", language: "ES", condition: "NM", finish: "normal", quantityOnHand: 1, priceArs: 1000, location: "Caja QA", tags: "jugables", imageUrl: "https://images.example.test/es/fixture.webp" };
    const first = await addInventoryStock(db, input, actor);
    itemId = first.id;
    assert.equal(first.product.imageUrl, input.imageUrl);
    assert.equal(first.tags, "jugables");
    assert.equal(first.location, "Caja QA");
    assert.equal(first.variant.language, "ES");
    const added = await addInventoryStock(db, { ...input, imageUrl: undefined, tags: undefined }, actor);
    assert.equal(added.id, first.id);
    assert.equal(added.quantityOnHand, 2);
    assert.equal(added.product.imageUrl, input.imageUrl, "Adding units without a replacement image must preserve the saved image");
    assert.equal(added.tags, "jugables");
    const english = await addInventoryStock(db, { ...input, language: "EN", imageUrl: "https://images.example.test/en/fixture.webp" }, actor);
    assert.notEqual(english.id, first.id);
    assert.equal(english.variant.language, "EN");
    assert.equal(english.product.imageUrl, "https://images.example.test/en/fixture.webp");
    assert.equal((await getInventoryItem(db, first.id, businessId))?.product.imageUrl, input.imageUrl);
    const missing = await addInventoryStock(db, { ...input, name: "Image missing fixture", number: "002", imageUrl: undefined }, actor);
    assert.ok(!missing.product.imageUrl, "No image may be invented when no exact image was resolved");
    const replaceable = { ...input, name: "Editable image fixture", number: "003" };
    await addInventoryStock(db, replaceable, actor);
    const cleared = await addInventoryStock(db, { ...replaceable, imageUrl: "" }, actor);
    assert.ok(!cleared.product.imageUrl, "An explicit empty image still clears the image");
  } finally { await db.close(); }
  db = await createOperationalDatabase({ driver: "pglite", dataDir });
  try {
    const saved = await getInventoryItem(db, itemId, businessId);
    assert.equal(saved?.product.imageUrl, "https://images.example.test/es/fixture.webp");
    assert.equal(saved?.tags, "jugables");
    assert.equal(saved?.quantityOnHand, 2);
  } finally { await db.close(); }
});
