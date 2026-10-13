import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildClaimBuyerRanking, normalizeClaimBuyerKey } from "@ultimoturno/domain";
import { createOperationalDatabase, getDefaultOperationalUser, replacePriceChartingCache, createClaimSession, addPriceChartingCardsToClaim, updateClaimCard, addClaimFree, previewActiveClaimOrders } from "./index.js";

test("buyer ranking uses the same allocations and money as claim order preview without counting frees", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ut-claim-ranking-"));
  const db = await createOperationalDatabase({ dataDir, driver: "pglite" });
  try {
    const actor = await getDefaultOperationalUser(db);
    await replacePriceChartingCache(db, {
      category: "pokemon-cards", sourceHash: "ranking-test", rowsReceived: 3, rowsSkipped: 0,
      rows: ["rank-a", "rank-b", "rank-ignored"].map((id, index) => ({
        priceChartingId: id, canonicalUrl: "https://www.pricecharting.com/game/qa/" + id, sourceUrl: "",
        productName: "Ranking fixture " + id, normalizedName: id, expansionName: "QA", normalizedExpansion: "qa",
        cardNumber: String(index + 1), loosePriceUsd: 1, imageUrl: "", searchKey: id
      }))
    });
    await createClaimSession(db, { name: "Isolated buyer ranking" }, actor);
    const initial = await addPriceChartingCardsToClaim(db, ["rank-a", "rank-b", "rank-ignored"], actor);
    const find = (id: string) => initial.cards.find((card) => card.priceChartingId === id)!.id;
    await updateClaimCard(db, find("rank-a"), { quantity: 3, buyer: "Ana,,Beto", finalPriceArs: 6000, finalPriceUsd: 2 }, actor);
    await updateClaimCard(db, find("rank-b"), { quantity: 2, buyer: " ana ", finalPriceArs: 3000, finalPriceUsd: 0 }, actor);
    await updateClaimCard(db, find("rank-ignored"), { buyer: "Ignored", finalPriceArs: 99999, status: "ignored" }, actor);
    await addClaimFree(db, { buyer: "Beto", finalName: "Free fixture", quantity: 2 }, actor);
    const workspace = await addClaimFree(db, { buyer: "Only Free", finalName: "Free only", quantity: 1 }, actor);
    const before = JSON.stringify(workspace);
    const ranking = buildClaimBuyerRanking(workspace.cards, 1540);
    const preview = await previewActiveClaimOrders(db, actor);
    assert.equal(JSON.stringify(workspace), before);
    assert.equal(ranking.buyers.length, 2);
    assert.equal(ranking.issues.length, 0);
    assert.equal(ranking.eligibleCount, 1);
    for (const buyer of ranking.buyers) {
      const order = preview.buyers.find((entry) => normalizeClaimBuyerKey(entry.buyer) === buyer.key)!;
      assert.equal(buyer.totalArs, order.totalArs);
      assert.equal(buyer.totalUsd, order.totalUsd);
      assert.equal(buyer.units, order.lines.filter((line) => line.kind === "card").reduce((sum, line) => sum + line.quantity, 0));
      assert.equal(buyer.equivalentArs, order.totalArs + order.totalUsd * 1540);
    }
    assert.ok(preview.buyers.some((buyer) => buyer.buyer === "Only Free"));
    assert.ok(!ranking.buyers.some((buyer) => buyer.buyer === "Only Free"));
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from sales")).rows[0].count, 0);
    assert.equal((await db.query<{ status: string }>("select status from claim_sessions where id=$1", [workspace.activeClaim!.id])).rows[0].status, "open");
  } finally { await db.close(); }
});
