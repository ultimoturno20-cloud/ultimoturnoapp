import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMaultCopy, decideMaultIntake, maultCopyFingerprint, maultReceiptKey, maultCategoryTags, type MaultIntakeContext, type MaultCategoryRule } from "./mault-intake.js";

const raw = (extra = {}) => ({ object: "scanned_card", id: "fixture-copy", card_id: "fixture-printing", collection: { id: "collection-a" }, game: "pokemon", name: "Fixture", set: "QA", collector_number: "001", lang: "es", condition: "NM", finish: "foil", foil_type: "Reverse Holo (Poké Ball)", needs_review: false, ...extra });
const context = (extra: Partial<MaultIntakeContext> = {}): MaultIntakeContext => ({ businessId: "business-a", allowedCollectionIds: ["collection-a"], phase: "incremental", baselineComplete: true, conditionPolicy: "require_confirmation", conditionConfirmed: true, match: { catalogId: "catalog-a", sourceCardId: "fixture-printing", game: "pokemon", setCode: "qa", number: "1", language: "ES", condition: "NM", finish: "pokeball" }, ...extra });

test("Mault contract preserves languages and exact special finishes without inferring condition", () => {
  assert.equal(normalizeMaultCopy(raw()).finish, "pokeball");
  assert.equal(normalizeMaultCopy(raw({ foil_type: "Reverse Holo (Master Ball)", lang: "pt" })).finish, "masterball");
  assert.equal(normalizeMaultCopy(raw({ lang: "id" })).language, "ID");
  assert.equal(normalizeMaultCopy(raw({ lang: "zh-cn" })).language, "CHS");
  const unsupported = normalizeMaultCopy(raw({ foil_type: "Reverse Holo (Dusk Ball)" }));
  assert.equal(unsupported.sourceFoilType, "Reverse Holo (Dusk Ball)");
  assert.equal(unsupported.finish, null);
  assert.ok(unsupported.issues.includes("unsupported_or_conflicting_finish"));
});

test("Mault contract refuses missing identity and never defaults unknown language to EN", () => {
  assert.throws(() => normalizeMaultCopy(raw({ id: "" })));
  const unknown = normalizeMaultCopy(raw({ lang: "", condition: "", needs_review: undefined, finish: "nonfoil" }));
  assert.equal(unknown.language, "");
  assert.equal(unknown.finish, null);
  assert.equal(decideMaultIntake(unknown, context()).state, "review");
  assert.equal(normalizeMaultCopy(raw({ lang: "constructor", foil_type: "__proto__" })).language, "");
  assert.equal(normalizeMaultCopy(raw({ foil_type: "constructor" })).finish, null);
  assert.equal(normalizeMaultCopy(raw({ lang: "unrecognized" })).sourceLanguage, "unrecognized");
});

test("initial baseline and other games cannot increase stock", () => {
  const copy = normalizeMaultCopy(raw());
  assert.equal(decideMaultIntake(copy, context({ phase: "baseline" })).state, "baseline");
  assert.equal(decideMaultIntake(copy, context({ baselineComplete: false })).quantityDelta, 0);
  assert.equal(decideMaultIntake(normalizeMaultCopy(raw({ game: "mtg" })), context()).state, "excluded");
  assert.equal(decideMaultIntake(copy, context({ allowedCollectionIds: [] })).state, "excluded");
  assert.equal(decideMaultIntake(normalizeMaultCopy(raw({ collection: null })), context()).quantityDelta, 0);
});

test("readiness requires an exact variant and explicit condition policy", () => {
  const copy = normalizeMaultCopy(raw());
  assert.equal(decideMaultIntake(copy, context()).quantityDelta, 1);
  assert.equal(decideMaultIntake(copy, context({ conditionConfirmed: false })).state, "review");
  assert.equal(decideMaultIntake(copy, context({ conditionConfirmed: false, conditionPolicy: "accept_recorded" })).state, "ready");
  assert.equal(decideMaultIntake(copy, context({ match: "ambiguous" })).quantityDelta, 0);
  assert.equal(decideMaultIntake(copy, context({ match: "not_found" })).quantityDelta, 0);
  const base = context().match;
  assert.ok(typeof base !== "string");
  for (const mismatch of [{ sourceCardId: "another" }, { language: "EN" }, { finish: "reverse" as const }, { condition: "LP" }, { setCode: "other" }, { number: "2" }, { number: "1/99" }, { game: "mtg" }]) {
    assert.equal(decideMaultIntake(copy, context({ match: { ...base, ...mismatch } })).state, "review");
  }
});

test("receipts survive key rotation, reconnect and storage changes; identity corrections require review", () => {
  const copy = normalizeMaultCopy(raw());
  const receipt = { businessId: "business-a", copyId: copy.copyId, state: "imported" as const, fingerprint: maultCopyFingerprint(copy) };
  const moved = normalizeMaultCopy(raw({ collection: { id: "new" }, location: { id: "box", name: "QA box", position: 2 }, prices: { usd: "99" } }));
  assert.equal(decideMaultIntake(moved, context({ receipt })).state, "already_imported");
  assert.equal(decideMaultIntake(normalizeMaultCopy(raw({ condition: "LP" })), context({ receipt })).state, "review");
  assert.notEqual(maultReceiptKey("business-a", copy.copyId), maultReceiptKey("business-b", copy.copyId));
  assert.throws(() => decideMaultIntake(copy, context({ receipt: { ...receipt, businessId: "other" } })));
  assert.throws(() => decideMaultIntake(copy, context({ receipt: { ...receipt, copyId: "other" } })));
});

test("baseline historical copies need an explicit historical phase to become eligible", () => {
  const copy = normalizeMaultCopy(raw());
  const receipt = { businessId: "business-a", copyId: copy.copyId, state: "baseline" as const, fingerprint: maultCopyFingerprint(copy) };
  assert.equal(decideMaultIntake(copy, context({ receipt })).quantityDelta, 0);
  assert.equal(decideMaultIntake(copy, context({ receipt, phase: "confirmed_history" })).quantityDelta, 1);
});

test("category mappings use stable IDs in the same business and preserve manual tags", () => {
  const copy = normalizeMaultCopy(raw({ location: { id: "box-a", name: "Jugable", position: 1 } }));
  const rules: MaultCategoryRule[] = [
    { businessId: "business-a", sourceKind: "collection", sourceId: "collection-a", tags: ["jugables"] },
    { businessId: "business-a", sourceKind: "location", sourceId: "box-a", tags: ["JUGABLES", "promo"] },
    { businessId: "business-b", sourceKind: "collection", sourceId: "collection-a", tags: ["not-ours"] },
  ];
  assert.deepEqual(maultCategoryTags(copy, "business-a", rules, "vitrina"), ["vitrina", "jugables", "promo"]);
  assert.deepEqual(maultCategoryTags(copy, "business-a", []), [], "A location name alone is not a category rule");
  const renamed = { ...copy, location: { ...copy.location!, name: "Renamed box" } };
  assert.deepEqual(maultCategoryTags(renamed, "business-a", rules), ["jugables", "promo"]);
  const noLocation = normalizeMaultCopy(raw());
  assert.deepEqual(maultCategoryTags(noLocation, "business-a", rules), ["jugables"], "Collection mapping already works at scan time");
  assert.throws(() => maultCategoryTags(copy, "", rules));
});
