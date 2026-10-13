export type ClaimBuyerCard = {
  id: string;
  buyer: string;
  quantity: number;
  finalPriceArs: number;
  finalPriceUsd: number;
  status: string;
};

export function normalizeClaimBuyerKey(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");
}

export function allocateClaimBuyerUnits(value: string, quantity: number): Array<{ buyer: string; quantity: number }> {
  const count = Math.max(1, Math.floor(Number(quantity) || 1));
  if (!Number.isSafeInteger(count)) throw new Error("Cantidad de unidades invalida.");
  const text = String(value || "");
  if (!text.trim()) return [];
  const slots = text.split(",").map((buyer) => buyer.trim());
  if (text.includes(",") && slots.length > count) {
    throw new Error("Hay " + slots.length + " compradores cargados pero la cantidad es " + count + ". Revisá los campos por unidad.");
  }
  if (!text.includes(",")) return [{ buyer: slots[0], quantity: count }];
  const grouped = new Map<string, { buyer: string; quantity: number }>();
  // Commas represent unit slots; missing and empty slots have no buyer.
  for (const buyer of slots) {
    if (!buyer) continue;
    const key = normalizeClaimBuyerKey(buyer);
    const current = grouped.get(key);
    grouped.set(key, { buyer: current?.buyer || buyer, quantity: (current?.quantity || 0) + 1 });
  }
  return [...grouped.values()];
}

export const claimRaffleThresholdArs = 10000;

export type ClaimBuyerStanding = {
  key: string;
  buyer: string;
  units: number;
  totalArs: number;
  totalUsd: number;
  equivalentArs: number | null;
  missingPriceUnits: number;
  eligible: boolean;
  rank: number | null;
  tied: boolean;
};

export function buildClaimBuyerRanking(cards: readonly ClaimBuyerCard[], exchangeRate: number) {
  const rateAvailable = Number.isFinite(exchangeRate) && exchangeRate > 0;
  const groups = new Map<string, { buyer: string; units: number; arsCents: number; usdCents: number; missingPriceUnits: number }>();
  const issues: Array<{ cardId: string; reason: string }> = [];
  for (const card of cards) {
    if (card.status === "ignored" || !card.buyer.trim()) continue;
    let allocations: ReturnType<typeof allocateClaimBuyerUnits>;
    try { allocations = allocateClaimBuyerUnits(card.buyer, card.quantity); }
    catch (error) { issues.push({ cardId: card.id, reason: error instanceof Error ? error.message : "Asignacion invalida." }); continue; }
    const validPrices = [card.finalPriceArs, card.finalPriceUsd].every((price) => Number.isFinite(price) && price >= 0);
    const missingPrice = !validPrices || (card.finalPriceArs === 0 && card.finalPriceUsd === 0);
    if (missingPrice && allocations.length) issues.push({ cardId: card.id, reason: "Sin precio final valido." });
    for (const allocation of allocations) {
      const key = normalizeClaimBuyerKey(allocation.buyer);
      const current = groups.get(key) || { buyer: allocation.buyer, units: 0, arsCents: 0, usdCents: 0, missingPriceUnits: 0 };
      current.units += allocation.quantity;
      if (missingPrice) current.missingPriceUnits += allocation.quantity;
      else {
        current.arsCents += Math.round(card.finalPriceArs * 100) * allocation.quantity;
        current.usdCents += Math.round(card.finalPriceUsd * 100) * allocation.quantity;
      }
      groups.set(key, current);
    }
  }
  const buyers: ClaimBuyerStanding[] = [...groups].map(([key, row]) => {
    const cents = row.usdCents && !rateAvailable ? null
      : row.arsCents + Math.round(row.usdCents * (rateAvailable ? exchangeRate : 0));
    return {
      key, buyer: row.buyer, units: row.units, totalArs: row.arsCents / 100, totalUsd: row.usdCents / 100,
      equivalentArs: cents === null ? null : cents / 100,
      missingPriceUnits: row.missingPriceUnits,
      eligible: (cents ?? row.arsCents) > claimRaffleThresholdArs * 100,
      rank: null, tied: false
    };
  }).sort((a, b) => {
    if (a.equivalentArs === null) return b.equivalentArs === null ? a.key.localeCompare(b.key, "es-AR") : 1;
    if (b.equivalentArs === null) return -1;
    return b.equivalentArs - a.equivalentArs || a.key.localeCompare(b.key, "es-AR");
  });
  const amountCounts = new Map<number, number>();
  for (const buyer of buyers) if (buyer.equivalentArs !== null) amountCounts.set(buyer.equivalentArs, (amountCounts.get(buyer.equivalentArs) || 0) + 1);
  let previousAmount: number | null = null, previousRank = 0;
  buyers.forEach((buyer, index) => {
    if (buyer.equivalentArs === null) return;
    buyer.rank = buyer.equivalentArs === previousAmount ? previousRank : index + 1;
    buyer.tied = (amountCounts.get(buyer.equivalentArs) || 0) > 1;
    previousAmount = buyer.equivalentArs; previousRank = buyer.rank;
  });
  return { buyers, issues, rateAvailable, eligibleCount: buyers.filter((buyer) => buyer.eligible).length };
}

export function claimBuyerListText(buyers: readonly ClaimBuyerStanding[], raffle: boolean): string {
  return buyers.filter((buyer) => !raffle || buyer.eligible).map((buyer) => {
    if (raffle) return buyer.buyer.replace(/\s+/g, " ").trim();
    const total = buyer.equivalentArs === null ? "Sin cotizacion" : "$ " + buyer.equivalentArs.toLocaleString("es-AR", { maximumFractionDigits: 2 });
    return (buyer.rank ?? "-") + ". " + buyer.buyer.replace(/\s+/g, " ").trim() + " - " + total + (buyer.missingPriceUnits ? " (parcial)" : "");
  }).join("\n");
}
