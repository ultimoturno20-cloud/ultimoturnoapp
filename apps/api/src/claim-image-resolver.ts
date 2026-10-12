export type ClaimImageIdentity = {
  productName: string;
  expansionName: string;
  cardNumber: string;
  languageGroup: string;
};

export type ClaimImageCandidate = { imageUrl: string; source: string };

const normalize = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const numberKey = (value: string): string => normalize(value.split("/")[0]).replace(/ /g, "").replace(/^0+(?=\d)/, "");

export async function findExactTcgdexClaimImage(
  input: ClaimImageIdentity,
  fetcher: typeof fetch = fetch
): Promise<ClaimImageCandidate | null> {
  // Other languages and special stamped/edition variants need their own verified image.
  if (input.languageGroup !== "english") return null;
  const name = input.productName.replace(/\s*\[(?:reverse holo|holo|holofoil)\]\s*$/i, "").trim();
  if (/\[|\]|\b(?:first edition|1st edition|pokemon center|master ball|poke ball|cosmos)\b/i.test(name)) return null;
  const number = numberKey(input.cardNumber);
  if (!name || !number || !input.expansionName) return null;
  const url = new URL("https://api.tcgdex.net/v2/en/cards");
  url.searchParams.set("name", name);
  url.searchParams.set("pagination:itemsPerPage", "100");
  const getJson = async (target: string) => {
    const response = await fetcher(target, {
      headers: { "User-Agent": "UltimoTurnoClaimImages/1.0" },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`TCGdex respondio HTTP ${response.status}.`);
    return response.json();
  };
  const cards = await getJson(url.href) as Array<{ id?: string; name?: string; localId?: string }>;
  if (!Array.isArray(cards)) throw new Error("TCGdex devolvio una respuesta inesperada.");
  const candidates = cards.filter((card) => card.id && normalize(card.name || "") === normalize(name)
    && numberKey(card.localId || "") === number).slice(0, 6);
  for (const candidate of candidates) {
    const card = await getJson(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(candidate.id!)}`) as {
      name?: string; localId?: string; image?: string; set?: { name?: string };
    };
    if (normalize(card.name || "") !== normalize(name) || numberKey(card.localId || "") !== number
      || normalize(card.set?.name || "") !== normalize(input.expansionName)) continue;
    if (!card.image?.startsWith("https://assets.tcgdex.net/en/")) continue;
    return { imageUrl: `${card.image}/high.webp`, source: "TCGdex" };
  }
  return null;
}

export async function resolveClaimImage<T>(options: {
  cachedUrls: string[];
  storageUrls: string[];
  externalImage: () => Promise<ClaimImageCandidate | null>;
  pageUrls: string[];
  pageImage: (url: string) => Promise<string>;
  download: (url: string, source: string) => Promise<T>;
}): Promise<T & { source: string }> {
  const errors = new Set<string>();
  const attemptedUrls = new Set<string>();
  const attempt = async (candidate: ClaimImageCandidate) => {
    if (!candidate.imageUrl || attemptedUrls.has(candidate.imageUrl)) return null;
    attemptedUrls.add(candidate.imageUrl);
    try {
      return { ...await options.download(candidate.imageUrl, candidate.source), source: candidate.source };
    } catch (error) {
      errors.add(error instanceof Error ? error.message : String(error));
      return null;
    }
  };
  for (const imageUrl of [...new Set(options.cachedUrls.filter(Boolean))]) {
    const result = await attempt({ imageUrl, source: "Catalogo" });
    if (result) return result;
  }
  for (const imageUrl of options.storageUrls) {
    const result = await attempt({ imageUrl, source: "PriceCharting storage" });
    if (result) return result;
  }
  try {
    const external = await options.externalImage();
    const result = external ? await attempt(external) : null;
    if (result) return result;
  } catch (error) {
    errors.add(error instanceof Error ? error.message : String(error));
  }
  for (const pageUrl of [...new Set(options.pageUrls.filter(Boolean))]) {
    try {
      const imageUrl = await options.pageImage(pageUrl);
      const result = await attempt({ imageUrl, source: "PriceCharting" });
      if (result) return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.add(message);
      if (/HTTP (403|429)/.test(message)) break;
    }
  }
  if ([...errors].some((message) => message.includes("PriceCharting") && message.includes("HTTP 429"))) {
    throw new Error("PriceCharting respondio HTTP 429 al buscar imagen. Espera antes de reintentar o usa Corregir imagen con una URL directa de la foto.");
  }
  if ([...errors].some((message) => message.includes("PriceCharting") && message.includes("HTTP 403"))) {
    throw new Error("PriceCharting bloqueo la consulta de imagen (HTTP 403) y no encontramos una alternativa verificada. Usa Corregir imagen con una URL directa de la foto, no el enlace de la pagina.");
  }
  throw new Error(`No encontramos una imagen verificada para esta carta. Usa Corregir imagen con una URL directa de la foto.${errors.size ? ` ${[...errors].slice(-2).join(" / ")}` : ""}`);
}
