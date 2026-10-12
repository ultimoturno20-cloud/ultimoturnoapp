import assert from "node:assert/strict";
import { test } from "node:test";
import { findExactTcgdexClaimImage, resolveClaimImage } from "./claim-image-resolver.js";

const identity = { productName: "Slowpoke", expansionName: "30th Celebration", cardNumber: "16", languageGroup: "english" };
const image = "https://assets.tcgdex.net/en/me/30th/016";
const detail = { name: "Slowpoke", localId: "016", set: { name: "30th Celebration" }, image };
const mockTcgdex = (payload = detail, summaries = [{ id: "30th-016", name: "Slowpoke", localId: "016" }]) => {
  const calls: string[] = [];
  const fetcher = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return Response.json(String(url).includes("?") ? summaries : payload);
  }) as typeof fetch;
  return { calls, fetcher };
};

test("TCGdex detail verifies Slowpoke 016 expansion, not just its summary", async () => {
  const mock = mockTcgdex();
  assert.deepEqual(await findExactTcgdexClaimImage(identity, mock.fetcher), { imageUrl: `${image}/high.webp`, source: "TCGdex" });
  assert.equal(mock.calls.length, 2);
  assert.match(mock.calls[1], /\/cards\/30th-016$/);
});

for (const [label, payload] of [
  ["other expansion", { ...detail, set: { name: "Celebrations" } }],
  ["unknown expansion", { ...detail, set: { name: "" } }],
  ["other name", { ...detail, name: "Galarian Slowpoke" }],
  ["other number", { ...detail, localId: "017" }],
  ["non-English asset", { ...detail, image: "https://assets.tcgdex.net/ja/me/30th/016" }]
] as const) {
  test(`TCGdex rejects ${label}`, async () => {
    assert.equal(await findExactTcgdexClaimImage(identity, mockTcgdex(payload).fetcher), null);
  });
}

test("TCGdex rejects other languages and special variants without requests", async () => {
  for (const input of [
    { ...identity, languageGroup: "japanese" }, { ...identity, languageGroup: "chinese" },
    { ...identity, languageGroup: "" }, { ...identity, productName: "Slowpoke [Pokemon Center]" },
    { ...identity, productName: "Slowpoke [Master Ball]" }, { ...identity, productName: "Slowpoke 1st Edition" }
  ]) {
    const mock = mockTcgdex();
    assert.equal(await findExactTcgdexClaimImage(input, mock.fetcher), null);
    assert.equal(mock.calls.length, 0);
  }
});

test("TCGdex handles normalized collector numbers and base-art finishes", async () => {
  const mock = mockTcgdex();
  assert.ok(await findExactTcgdexClaimImage({ ...identity, productName: "Slowpoke [Reverse Holo]", cardNumber: "016/128" }, mock.fetcher));
});

const resolverOptions = () => ({
  cachedUrls: [] as string[], storageUrls: [] as string[], pageUrls: ["page-one", "page-two"],
  externalImage: async () => null as { imageUrl: string; source: string } | null,
  pageImage: async (_url: string): Promise<string> => { throw new Error("No se pudo leer la pagina de PriceCharting (HTTP 403)."); },
  download: async (url: string, _source: string) => ({ sourceImageUrl: url, byteSize: 123 })
});

test("existing exact-ID catalog image avoids external and PriceCharting requests", async () => {
  const options = resolverOptions();
  options.cachedUrls = ["cached", "cached"];
  options.externalImage = async () => { assert.fail("must not query external sources"); };
  assert.equal((await resolveClaimImage(options)).sourceImageUrl, "cached");
});

test("failed cache and storage continue to verified external image", async () => {
  const options = resolverOptions();
  options.cachedUrls = ["broken"];
  options.storageUrls = ["missing"];
  options.download = async (url) => {
    if (url !== image) throw new Error("HTTP 404");
    return { sourceImageUrl: url, byteSize: 123 };
  };
  options.externalImage = async () => ({ imageUrl: image, source: "TCGdex" });
  assert.equal((await resolveClaimImage(options)).source, "TCGdex");
});

test("403 stops repeated page queries and reports one actionable error", async () => {
  const options = resolverOptions();
  let calls = 0;
  options.pageImage = async () => { calls++; throw new Error("PriceCharting HTTP 403"); };
  await assert.rejects(resolveClaimImage(options), (error: Error) => {
    assert.equal((error.message.match(/403/g) || []).length, 1);
    assert.match(error.message, /Corregir imagen.*URL directa/);
    return true;
  });
  assert.equal(calls, 1);
});

test("external failure still permits PriceCharting page image", async () => {
  const options = resolverOptions();
  options.externalImage = async () => { throw new Error("TCGdex HTTP 503"); };
  options.pageImage = async () => image;
  assert.equal((await resolveClaimImage(options)).sourceImageUrl, image);
});

test("429 remains visible for existing batch cooldown handling", async () => {
  const options = resolverOptions();
  options.cachedUrls = ["blocked-cache"];
  options.download = async () => { throw new Error("Catalogo respondio HTTP 403."); };
  options.pageImage = async () => { throw new Error("PriceCharting respondio HTTP 429 al buscar imagen."); };
  await assert.rejects(resolveClaimImage(options), /PriceCharting.*HTTP 429/);
});

test("download failure never claims success", async () => {
  const options = resolverOptions();
  options.externalImage = async () => ({ imageUrl: image, source: "TCGdex" });
  options.download = async () => { throw new Error("Respuesta inesperada al bajar imagen: text/html."); };
  await assert.rejects(resolveClaimImage(options), /Corregir imagen/);
});
