import { masterSet151Contents } from "./folder-templates.js";

export const cardTypes = ["pokemon", "supporter", "item", "stadium", "tool", "energy", "unknown"] as const;
export type CardType = typeof cardTypes[number];
export type CardClassification = { cardType: CardType; cardTypeSource: "catalog" | "checklist" | "manual" | "unknown" };

const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function isCardType(value: unknown): value is CardType {
  return cardTypes.includes(value as CardType);
}

function metadataType(metadata: unknown): CardType | 'conflict' {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "unknown";
  const data = metadata as Record<string, unknown>;
  const values: string[] = [normalize(data.supertype), ...(Array.isArray(data.subtypes) ? data.subtypes.map(normalize) : [])];
  if (Array.isArray(data.extendedData)) for (const attribute of data.extendedData) {
    if (!attribute || typeof attribute !== "object") continue;
    const field = attribute as Record<string, unknown>;
    if ([field.name, field.displayName].some((key) => ["card type", "cardtype", "supertype", "subtype", "subtypes", "trainer type"].includes(normalize(key)))) values.push(normalize(field.value));
  }
  const categories = new Set<CardType>();
  for (const value of values) {
    if (/\b(?:pokemon )?tool\b/.test(value)) categories.add("tool");
    if (/\bsupporter\b/.test(value)) categories.add("supporter");
    if (/\bstadium\b/.test(value)) categories.add("stadium");
    if (/\bitem\b/.test(value)) categories.add("item");
    if (/\benergy\b/.test(value)) categories.add("energy");
    if (["pokemon", "grass", "fire", "water", "lightning", "psychic", "fighting", "darkness", "dark", "metal", "steel", "colorless", "dragon", "fairy"].includes(value)) categories.add("pokemon");
  }
  // Older Tools can also carry the Item subtype; retain the more specific category.
  if (categories.has("tool")) categories.delete("item");
  return categories.size === 1 ? [...categories][0] : categories.size > 1 ? 'conflict' : "unknown";
}

// PokemonTCG/pokemon-tcg-data cards/en/sv3pt5.json; names/numbers come from the same checklist.
const trainer151: Partial<Record<number, CardType>> = {
  152: "item", 153: "item", 154: "item", 155: "tool", 156: "supporter", 157: "stadium",
  158: "supporter", 159: "item", 160: "supporter", 161: "supporter", 162: "item", 163: "tool",
  164: "tool", 165: "tool", 194: "supporter", 195: "supporter", 196: "supporter", 197: "supporter",
  203: "supporter", 204: "supporter", 206: "item", 207: "energy"
};
const checklist151 = masterSet151Contents();
const cardName = (value: string) => normalize(value.replace(/\s*[[(][^\])]*[\])]/g, "").replace(/\s*-?\s*#?\d+\/\d+\s*$/, ""));

export function classifyCard(input: { name: string; expansion: string; number?: string; languageGroup?: string; entryKey?: string; metadata?: unknown[] }): CardClassification {
  const types = new Set((input.metadata || []).map(metadataType).filter((type) => type !== "unknown"));
  if (types.has('conflict')) return { cardType: 'unknown', cardTypeSource: 'unknown' };
  if (types.size === 1) return { cardType: [...types][0] as CardType, cardTypeSource: "catalog" };
  if (types.size > 1) return { cardType: "unknown", cardTypeSource: "unknown" };
  const expansion = normalize(input.expansion).replace(/^(pokemon|sv) /, "");
  if ((!input.languageGroup || input.languageGroup === "english") && ["scarlet violet 151", "scarlet and violet 151", "151"].includes(expansion)) {
    const number = String(input.number || "").split("/")[0].replace(/^0+/, "");
    const entry = checklist151.find((card) => cardName(card.name) === cardName(input.name)
      && (number ? card.number === number : card.entryKey === input.entryKey));
    if (entry) return { cardType: entry.number ? trainer151[Number(entry.number)] || "pokemon" : "energy", cardTypeSource: "checklist" };
  }
  return { cardType: "unknown", cardTypeSource: "unknown" };
}
