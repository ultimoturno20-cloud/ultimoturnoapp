import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateClaimBuyerUnits, buildClaimBuyerRanking, claimBuyerListText, normalizeClaimBuyerKey, type ClaimBuyerCard } from "./claim-buyers.js";

const card = (patch: Partial<ClaimBuyerCard> = {}): ClaimBuyerCard => ({
  id: "card", buyer: "Ana", quantity: 1, finalPriceArs: 1000, finalPriceUsd: 0, status: "draft", ...patch
});
test("shares legacy quantities and preserves explicit empty slots", () => {
  assert.deepEqual(allocateClaimBuyerUnits(" Ana ", 3), [{ buyer: "Ana", quantity: 3 }]);
  assert.deepEqual(allocateClaimBuyerUnits("Ana,, ana,Beto", 4), [{ buyer: "Ana", quantity: 2 }, { buyer: "Beto", quantity: 1 }]);
  assert.deepEqual(allocateClaimBuyerUnits("Ana,", 3), [{ buyer: "Ana", quantity: 1 }]);
  assert.throws(() => allocateClaimBuyerUnits("Ana,Beto", 1), /Hay 2 compradores/);
  assert.deepEqual(allocateClaimBuyerUnits(" ", 2), []);
  assert.deepEqual(allocateClaimBuyerUnits("Ana", 1000000000), [{ buyer: "Ana", quantity: 1000000000 }]);
});
test("normalizes spaces/case but never merges accents or different buyers", () => {
  assert.equal(normalizeClaimBuyerKey("  ANA  Ruiz "), "ana ruiz");
  assert.notEqual(normalizeClaimBuyerKey("Jose"), normalizeClaimBuyerKey("Jos\u00e9"));
  const r = buildClaimBuyerRanking([card({buyer: "ANA Ruiz"}), card({buyer: " ana   ruiz ", quantity: 2}), card({buyer: "Otra"})], 1540);
  assert.equal(r.buyers.find(b => b.key === "ana ruiz")?.totalArs, 3000);
  assert.equal(r.buyers.length, 2);
});
test("uses only assigned units, ignores ignored cards and does not mutate inputs", () => {
  const cards = [card({buyer: "Ana,,Beto",quantity: 3,finalPriceArs: 6000}), card({buyer: "",finalPriceArs: 99999}), card({buyer: "Ana",status: "ignored", finalPriceArs: 99999})];
  const before = structuredClone(cards), r = buildClaimBuyerRanking(cards, 1540);
  assert.deepEqual(cards, before);
  assert.equal(r.buyers.length, 2);
  assert.ok(r.buyers.every(b => b.units === 1 && b.equivalentArs === 6000 && b.rank === 1 && b.tied));
});
test("combines ARS and USD at the current rate and recalculates eligibility", () => {
  const cards = [card({finalPriceArs: 5000, finalPriceUsd: 4}), card({buyer: "Beto",finalPriceArs: 11000})];
  const r = buildClaimBuyerRanking(cards, 1540);
  assert.equal(r.buyers[0].buyer, "Ana");
  assert.equal(r.buyers[0].equivalentArs, 11160);
  assert.equal(r.eligibleCount, 2);
  assert.equal(buildClaimBuyerRanking(cards, 1000).eligibleCount, 1);
});
test("threshold is strictly greater than 10000 using displayed monetary cents", () => {
  const r = buildClaimBuyerRanking([card({buyer: "Under",finalPriceArs:9999.99}),card({buyer: "Equal",finalPriceArs:10000}),card({buyer: "Over",finalPriceArs:10000.01})],1540);
  assert.deepEqual(r.buyers.filter(b=>b.eligible).map(b=>b.buyer),["Over"]);
  const exact = buildClaimBuyerRanking([card({ finalPriceArs: 9966.37, finalPriceUsd: 0.03 })],1121);
  assert.equal(exact.buyers[0].equivalentArs, 10000);
  assert.equal(exact.buyers[0].eligible, false);
});
test("ties share a place rather than awarding a prize by alphabet", () => {
  const r=buildClaimBuyerRanking([card({buyer:"Beto",finalPriceArs:20000}),card({buyer:"Ana",finalPriceArs:20000}),card({buyer:"Ciro",finalPriceArs:15000})],1540);
  assert.deepEqual(r.buyers.map(b=>b.rank),[1,1,3]);
  assert.deepEqual(r.buyers.map(b=>b.tied),[true,true,false]);
});
test("keeps missing-price buyers visible and known qualifying amounts eligible", () => {
  const r=buildClaimBuyerRanking([card({id:"missing",buyer:"Ana",quantity:2,finalPriceArs:0}),card({buyer:"Ana",finalPriceArs:12000}),card({buyer:"Beto",finalPriceArs:0})],1540);
  assert.equal(r.issues.length,2);
  assert.equal(r.buyers[0].missingPriceUnits,2);
  assert.equal(r.buyers[0].eligible,true);
  assert.equal(r.buyers[1].eligible,false);
  assert.equal(r.buyers[1].units,1);
});
test("invalid unit assignments do not invent totals or participants", () => {
  const r=buildClaimBuyerRanking([card({buyer:"Ana,Beto",quantity:1,finalPriceArs:30000})],1540);
  assert.equal(r.buyers.length,0);assert.equal(r.issues.length,1);
});
test("missing exchange rates never silently convert USD at zero", () => {
  const r=buildClaimBuyerRanking([card({buyer:"USD",finalPriceArs:0,finalPriceUsd:100}),card({buyer:"ARS",finalPriceArs:12000}),card({buyer:"Mixed",finalPriceArs:12000,finalPriceUsd:100})],0);
  assert.equal(r.buyers[0].buyer,"ARS");
  assert.equal(r.buyers.find(b=>b.buyer==="USD")?.equivalentArs,null);
  assert.equal(r.buyers.find(b=>b.buyer==="USD")?.eligible,false);
  assert.equal(r.buyers.find(b=>b.buyer==="Mixed")?.equivalentArs,null);
  assert.equal(r.buyers.find(b=>b.buyer==="Mixed")?.eligible,true);
  assert.equal(r.eligibleCount,2);
});
test("rejects invalid monetary values without corrupting buyer totals", () => {
  for(const value of [-1,Infinity,NaN]){
    const r=buildClaimBuyerRanking([card({finalPriceArs:value})],1540);
    assert.equal(r.buyers[0].equivalentArs,0);assert.equal(r.buyers[0].missingPriceUnits,1);assert.equal(r.issues.length,1);
  }
});
test("participant text includes one entry per normalized buyer, not per unit", () => {
  const r=buildClaimBuyerRanking([card({buyer:"Ana",quantity:3,finalPriceArs:5000}),card({buyer:" ana ",finalPriceArs:5000}),card({buyer:"Beto",finalPriceArs:10000})],1540);
  assert.equal(claimBuyerListText(r.buyers,true),"Ana");
  assert.ok(claimBuyerListText(r.buyers,false).includes("20.000"));
});
test("empty claims have no winner or raffle participant", () => {
  assert.deepEqual(buildClaimBuyerRanking([],1540),{buyers:[],issues:[],rateAvailable:true,eligibleCount:0});
});
