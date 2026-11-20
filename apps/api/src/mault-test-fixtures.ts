import { defaultMaultSyncConfig, type MaultSyncConfig } from "@ultimoturno/domain";

export const maultFixtureConfig = (): MaultSyncConfig => ({ ...defaultMaultSyncConfig(), enabled: true, autoImport: true,
  requireReviewed: true, requireStorage: true, acceptRecordedCondition: true, newItemPriceArs: 1000,
  collections: ["Items", "Pokemon", "Energy", "Tools", "Stadiums", "Supporters"].map(label => ({ id: "qa-" + label.toLowerCase(), label, tags: [label.toLowerCase()] })) });
export const maultFixtureCopy = (id: string, language = "es", collection = "Items", extra: Record<string, unknown> = {}) => ({
  object: "scanned_card", id, card_id: "qa-" + language, name: "QA Mault " + language, game: "pokemon", set: "qa", set_name: "QA Expansion",
  collector_number: "001", lang: language, finish: "nonfoil", foil_type: null, stamp: null, condition: "NM",
  collection: { id: "qa-" + collection.toLowerCase(), name: collection }, location: { id: "qa-box", name: "Caja QA", position: 1 },
  needs_review: false, is_reviewed: true, updated_at: "2026-11-20T00:00:00.000Z", ...extra,
});
export function maultFixtureProvider(imageBases: Record<string, string> = {}) {
  const copies = new Map<string, ReturnType<typeof maultFixtureCopy>>();
  const requests: string[] = [];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  let brokenImage = false, wrongCatalog = false;
  const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  const fetcher: typeof fetch = async (target, options) => {
    const url = new URL(String(target)); requests.push(url.origin + url.pathname);
    if (options?.redirect !== "error") throw new Error("Fixtures require redirect protection");
    if (url.hostname === "mault.test") {
      if (url.pathname === "/api/v1/collections") return json({ object: "list", has_more: false, data: maultFixtureConfig().collections.map(c => ({ id: c.id, name: c.label })) });
      if (url.pathname === "/api/v1/cards") return json({ object: "list", has_more: false, next_since: "2026-11-19T23:59:00.000Z", data: [...copies.values()] });
      const id = decodeURIComponent(url.pathname.split("/").pop()!);
      return copies.has(id) ? json(copies.get(id)) : new Response("", { status: 404 });
    }
    if (url.hostname === "api.tcgdex.net") {
      const language = url.pathname.split("/")[2], id = decodeURIComponent(url.pathname.split("/").pop()!);
      const source = [...copies.values()].find(c => c.card_id === id && c.lang === language);
      if (!source) return new Response("", { status: 404 });
      return json({ id: wrongCatalog ? "other" : id, name: source.name, localId: source.collector_number,
        set: { id: source.set, name: source.set_name }, image: imageBases[language] || `https://assets.tcgdex.net/${language}/qa/${id}` });
    }
    if (url.hostname === "assets.tcgdex.net") return brokenImage ? new Response("missing", { status: 404 })
      : new Response(png, { headers: { "content-type": "image/png" } });
    throw new Error("Unexpected fixture network request");
  };
  return { copies, requests, fetcher, breakImages: (broken: boolean) => { brokenImage = broken; },
    mismatchCatalog: (wrong: boolean) => { wrongCatalog = wrong; } };
}
