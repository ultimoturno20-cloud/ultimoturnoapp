export type Business = {
  id: string;
  name: string;
  slug: string;
  defaultCurrency: "ARS" | "USD";
};

export type ExternalIdentifier = {
  source: "pricecharting" | "tcgplayer" | "monprice" | "manual";
  externalId: string;
  url?: string;
};

export type CardProduct = {
  id: string;
  businessId: string;
  name: string;
  expansion: string;
  number?: string;
  imageUrl?: string;
  identifiers: ExternalIdentifier[];
};

export type CardVariant = {
  id: string;
  productId: string;
  language: "EN" | "JA" | "CHS" | "ES" | "OTRO";
  condition: "NM" | "LP" | "MP" | "HP" | "DMG" | "SEALED" | "OTRA";
  finish: "normal" | "holo" | "reverse" | "masterball" | "pokeball" | "otro";
};

export type InventoryItem = {
  id: string;
  businessId: string;
  sku: string;
  productId: string;
  variantId: string;
  location: string;
  quantityOnHand: number;
  quantityReserved: number;
  active: boolean;
  priceArs?: number;
  priceUsd?: number;
};

export type InventoryMovementType =
  | "initial_seed"
  | "import"
  | "manual_adjustment"
  | "sale"
  | "sale_cancel"
  | "reservation"
  | "reservation_release";

export type InventoryMovement = {
  id: string;
  businessId: string;
  inventoryItemId: string;
  type: InventoryMovementType;
  quantityDelta: number;
  unitCostUsd?: number;
  note?: string;
  createdAt: string;
};

export type ImportRunStatus = "draft" | "parsed" | "needs_review" | "ready" | "applied" | "cancelled";

export type ImportRun = {
  id: string;
  businessId: string;
  source: "monprice_csv" | "legacy_snapshot" | "manual_csv";
  status: ImportRunStatus;
  fileName: string;
  totalRows: number;
  reviewRows: number;
  createdAt?: string;
  note?: string;
};

export type StockSummary = {
  totalSkus: number;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  stockValueArs: number;
};

export function availableQuantity(item: Pick<InventoryItem, "quantityOnHand" | "quantityReserved">): number {
  return Math.max(0, item.quantityOnHand - item.quantityReserved);
}

export function summarizeStock(items: InventoryItem[]): StockSummary {
  return items.reduce<StockSummary>((summary, item) => {
    const available = availableQuantity(item);
    summary.totalSkus += 1;
    summary.totalUnits += item.quantityOnHand;
    summary.reservedUnits += item.quantityReserved;
    summary.availableUnits += available;
    summary.stockValueArs += available * (item.priceArs || 0);
    return summary;
  }, { totalSkus: 0, totalUnits: 0, reservedUnits: 0, availableUnits: 0, stockValueArs: 0 });
}

export function assertReservationQuantity(item: InventoryItem, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("La reserva debe ser una cantidad entera positiva.");
  }
  if (availableQuantity(item) < quantity) {
    throw new Error("Stock insuficiente para reservar.");
  }
}

export const fixtureBusiness: Business = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "UltimoTurno Demo",
  slug: "ultimoturno-demo",
  defaultCurrency: "ARS"
};

function demoCardImage(title: string, code: string, background: string, accent: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 336">
      <rect width="240" height="336" rx="18" fill="#17181d"/>
      <rect x="14" y="14" width="212" height="308" rx="14" fill="${background}"/>
      <rect x="28" y="28" width="184" height="132" rx="12" fill="${accent}" opacity="0.9"/>
      <circle cx="74" cy="82" r="34" fill="#fff" opacity="0.28"/>
      <circle cx="155" cy="96" r="52" fill="#fff" opacity="0.18"/>
      <rect x="28" y="184" width="184" height="18" rx="9" fill="#fff" opacity="0.32"/>
      <rect x="28" y="214" width="138" height="12" rx="6" fill="#fff" opacity="0.22"/>
      <rect x="28" y="238" width="160" height="12" rx="6" fill="#fff" opacity="0.18"/>
      <text x="28" y="285" fill="#fff" font-family="Arial, sans-serif" font-size="23" font-weight="700">${title}</text>
      <text x="28" y="308" fill="#fff" font-family="Arial, sans-serif" font-size="14" opacity="0.78">#${code}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const fixtureProducts: CardProduct[] = [
  {
    id: "22222222-2222-4222-8222-222222222221",
    businessId: fixtureBusiness.id,
    name: "Pikachu Promo",
    expansion: "Destellos Iniciales",
    number: "025",
    imageUrl: demoCardImage("Pikachu", "025", "#f4b63f", "#d9480f"),
    identifiers: [{ source: "pricecharting", externalId: "demo-pikachu-025", url: "https://example.invalid/pikachu" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    businessId: fixtureBusiness.id,
    name: "Charizard Coleccion",
    expansion: "Llamas del Sur",
    number: "006",
    imageUrl: demoCardImage("Charizard", "006", "#e8590c", "#7c2d12"),
    identifiers: [{ source: "tcgplayer", externalId: "demo-charizard-006", url: "https://example.invalid/charizard" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222223",
    businessId: fixtureBusiness.id,
    name: "Eevee Reverse",
    expansion: "Evoluciones Demo",
    number: "133",
    imageUrl: demoCardImage("Eevee", "133", "#8d6e63", "#f2c078"),
    identifiers: [{ source: "monprice", externalId: "scan-eevee-133" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222224",
    businessId: fixtureBusiness.id,
    name: "Mewtwo Archivo",
    expansion: "Poder Psiquico",
    number: "150",
    imageUrl: demoCardImage("Mewtwo", "150", "#7c3aed", "#22d3ee"),
    identifiers: [{ source: "pricecharting", externalId: "demo-mewtwo-150", url: "https://example.invalid/mewtwo" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222225",
    businessId: fixtureBusiness.id,
    name: "Bulbasaur Base",
    expansion: "Bosque Inicial",
    number: "001",
    imageUrl: demoCardImage("Bulbasaur", "001", "#2f9e44", "#a9e34b"),
    identifiers: [{ source: "manual", externalId: "manual-bulbasaur-001" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222226",
    businessId: fixtureBusiness.id,
    name: "Squirtle Sellado",
    expansion: "Agua Clara",
    number: "007",
    imageUrl: demoCardImage("Squirtle", "007", "#1971c2", "#74c0fc"),
    identifiers: [{ source: "monprice", externalId: "scan-squirtle-007" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222227",
    businessId: fixtureBusiness.id,
    name: "Gengar Master",
    expansion: "Sombras Urbanas",
    number: "094",
    imageUrl: demoCardImage("Gengar", "094", "#5f3dc4", "#f783ac"),
    identifiers: [{ source: "tcgplayer", externalId: "demo-gengar-094", url: "https://example.invalid/gengar" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222228",
    businessId: fixtureBusiness.id,
    name: "Dragonite Holo",
    expansion: "Cielos Antiguos",
    number: "149",
    imageUrl: demoCardImage("Dragonite", "149", "#f08c00", "#4dabf7"),
    identifiers: [{ source: "pricecharting", externalId: "demo-dragonite-149", url: "https://example.invalid/dragonite" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222229",
    businessId: fixtureBusiness.id,
    name: "Snorlax Vitrina",
    expansion: "Descanso Total",
    number: "143",
    imageUrl: demoCardImage("Snorlax", "143", "#0b7285", "#ffd43b"),
    identifiers: [{ source: "manual", externalId: "manual-snorlax-143" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222230",
    businessId: fixtureBusiness.id,
    name: "Lucario Promo",
    expansion: "Fuerza Metal",
    number: "448",
    imageUrl: demoCardImage("Lucario", "448", "#364fc7", "#ced4da"),
    identifiers: [{ source: "monprice", externalId: "scan-lucario-448" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222231",
    businessId: fixtureBusiness.id,
    name: "Rayquaza Gold",
    expansion: "Cielos Antiguos",
    number: "384",
    imageUrl: demoCardImage("Rayquaza", "384", "#087f5b", "#fcc419"),
    identifiers: [{ source: "tcgplayer", externalId: "demo-rayquaza-384", url: "https://example.invalid/rayquaza" }]
  },
  {
    id: "22222222-2222-4222-8222-222222222232",
    businessId: fixtureBusiness.id,
    name: "Charmander Caja",
    expansion: "Llamas del Sur",
    number: "004",
    imageUrl: demoCardImage("Charmander", "004", "#f76707", "#ffe066"),
    identifiers: [{ source: "manual", externalId: "manual-charmander-004" }]
  }
];

export const fixtureVariants: CardVariant[] = [
  { id: "33333333-3333-4333-8333-333333333331", productId: fixtureProducts[0].id, language: "EN", condition: "NM", finish: "holo" },
  { id: "33333333-3333-4333-8333-333333333332", productId: fixtureProducts[1].id, language: "JA", condition: "LP", finish: "normal" },
  { id: "33333333-3333-4333-8333-333333333333", productId: fixtureProducts[2].id, language: "CHS", condition: "NM", finish: "reverse" },
  { id: "33333333-3333-4333-8333-333333333334", productId: fixtureProducts[3].id, language: "ES", condition: "MP", finish: "holo" },
  { id: "33333333-3333-4333-8333-333333333335", productId: fixtureProducts[4].id, language: "EN", condition: "LP", finish: "normal" },
  { id: "33333333-3333-4333-8333-333333333336", productId: fixtureProducts[5].id, language: "JA", condition: "SEALED", finish: "normal" },
  { id: "33333333-3333-4333-8333-333333333337", productId: fixtureProducts[6].id, language: "EN", condition: "NM", finish: "masterball" },
  { id: "33333333-3333-4333-8333-333333333338", productId: fixtureProducts[7].id, language: "ES", condition: "HP", finish: "holo" },
  { id: "33333333-3333-4333-8333-333333333339", productId: fixtureProducts[8].id, language: "CHS", condition: "DMG", finish: "normal" },
  { id: "33333333-3333-4333-8333-333333333340", productId: fixtureProducts[9].id, language: "ES", condition: "NM", finish: "pokeball" },
  { id: "33333333-3333-4333-8333-333333333341", productId: fixtureProducts[10].id, language: "JA", condition: "NM", finish: "holo" },
  { id: "33333333-3333-4333-8333-333333333342", productId: fixtureProducts[11].id, language: "EN", condition: "MP", finish: "normal" }
];

export const fixtureInventory: InventoryItem[] = [
  {
    id: "44444444-4444-4444-8444-444444444441",
    businessId: fixtureBusiness.id,
    sku: "DEMO-PC-025-EN-NM-HOLO",
    productId: fixtureProducts[0].id,
    variantId: fixtureVariants[0].id,
    location: "Carpeta demo",
    quantityOnHand: 4,
    quantityReserved: 1,
    active: true,
    priceArs: 2500,
    priceUsd: 2
  },
  {
    id: "44444444-4444-4444-8444-444444444442",
    businessId: fixtureBusiness.id,
    sku: "DEMO-CZ-006-JA-LP",
    productId: fixtureProducts[1].id,
    variantId: fixtureVariants[1].id,
    location: "Vitrina demo",
    quantityOnHand: 1,
    quantityReserved: 0,
    active: true,
    priceArs: 18000,
    priceUsd: 12
  },
  {
    id: "44444444-4444-4444-8444-444444444443",
    businessId: fixtureBusiness.id,
    sku: "DEMO-EE-133-CHS-NM-REV",
    productId: fixtureProducts[2].id,
    variantId: fixtureVariants[2].id,
    location: "Caja scanner demo",
    quantityOnHand: 8,
    quantityReserved: 0,
    active: true,
    priceArs: 1200
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    businessId: fixtureBusiness.id,
    sku: "DEMO-MT-150-ES-MP-HOLO",
    productId: fixtureProducts[3].id,
    variantId: fixtureVariants[3].id,
    location: "Caja psiquico A2",
    quantityOnHand: 2,
    quantityReserved: 1,
    active: true,
    priceArs: 9200,
    priceUsd: 7.4
  },
  {
    id: "44444444-4444-4444-8444-444444444445",
    businessId: fixtureBusiness.id,
    sku: "DEMO-BB-001-EN-LP-NOR",
    productId: fixtureProducts[4].id,
    variantId: fixtureVariants[4].id,
    location: "Binder verde fila 1",
    quantityOnHand: 6,
    quantityReserved: 0,
    active: true,
    priceArs: 950,
    priceUsd: 0.8
  },
  {
    id: "44444444-4444-4444-8444-444444444446",
    businessId: fixtureBusiness.id,
    sku: "DEMO-SQ-007-JA-SEALED",
    productId: fixtureProducts[5].id,
    variantId: fixtureVariants[5].id,
    location: "Estante sellados",
    quantityOnHand: 3,
    quantityReserved: 2,
    active: true,
    priceArs: 4800,
    priceUsd: 4.1
  },
  {
    id: "44444444-4444-4444-8444-444444444447",
    businessId: fixtureBusiness.id,
    sku: "DEMO-GG-094-EN-NM-MB",
    productId: fixtureProducts[6].id,
    variantId: fixtureVariants[6].id,
    location: "Vitrina premium",
    quantityOnHand: 1,
    quantityReserved: 1,
    active: true,
    priceArs: 32500,
    priceUsd: 26.5
  },
  {
    id: "44444444-4444-4444-8444-444444444448",
    businessId: fixtureBusiness.id,
    sku: "DEMO-DN-149-ES-HP-HOLO",
    productId: fixtureProducts[7].id,
    variantId: fixtureVariants[7].id,
    location: "Caja estado medio",
    quantityOnHand: 0,
    quantityReserved: 0,
    active: true,
    priceArs: 7600,
    priceUsd: 6.2
  },
  {
    id: "44444444-4444-4444-8444-444444444449",
    businessId: fixtureBusiness.id,
    sku: "DEMO-SN-143-CHS-DMG-NOR",
    productId: fixtureProducts[8].id,
    variantId: fixtureVariants[8].id,
    location: "Caja ofertas",
    quantityOnHand: 5,
    quantityReserved: 0,
    active: true,
    priceArs: 650,
    priceUsd: 0.5
  },
  {
    id: "44444444-4444-4444-8444-444444444450",
    businessId: fixtureBusiness.id,
    sku: "DEMO-LC-448-ES-NM-PB",
    productId: fixtureProducts[9].id,
    variantId: fixtureVariants[9].id,
    location: "Carpeta promos",
    quantityOnHand: 7,
    quantityReserved: 3,
    active: true,
    priceArs: 1750,
    priceUsd: 1.3
  },
  {
    id: "44444444-4444-4444-8444-444444444451",
    businessId: fixtureBusiness.id,
    sku: "DEMO-RQ-384-JA-NM-HOLO",
    productId: fixtureProducts[10].id,
    variantId: fixtureVariants[10].id,
    location: "Caja alta rotacion",
    quantityOnHand: 2,
    quantityReserved: 0,
    active: true,
    priceArs: 41000,
    priceUsd: 33
  },
  {
    id: "44444444-4444-4444-8444-444444444452",
    businessId: fixtureBusiness.id,
    sku: "DEMO-CH-004-EN-MP-NOR",
    productId: fixtureProducts[11].id,
    variantId: fixtureVariants[11].id,
    location: "Pendiente de revisar",
    quantityOnHand: 10,
    quantityReserved: 0,
    active: true,
    priceArs: 700,
    priceUsd: 0.6
  }
];

export const fixtureMovements: InventoryMovement[] = [
  {
    id: "55555555-5555-4555-8555-555555555551",
    businessId: fixtureBusiness.id,
    inventoryItemId: fixtureInventory[0].id,
    type: "initial_seed",
    quantityDelta: 4,
    note: "Carga ficticia inicial",
    createdAt: "2026-08-03T12:00:00.000Z"
  },
  {
    id: "55555555-5555-4555-8555-555555555552",
    businessId: fixtureBusiness.id,
    inventoryItemId: fixtureInventory[0].id,
    type: "reservation",
    quantityDelta: 0,
    note: "Reserva ficticia para validar ecommerce futuro",
    createdAt: "2026-08-03T12:05:00.000Z"
  },
  {
    id: "55555555-5555-4555-8555-555555555553",
    businessId: fixtureBusiness.id,
    inventoryItemId: fixtureInventory[2].id,
    type: "import",
    quantityDelta: 8,
    note: "Importacion ficticia MonPrice",
    createdAt: "2026-08-03T12:10:00.000Z"
  },
  {
    id: "55555555-5555-4555-8555-555555555554",
    businessId: fixtureBusiness.id,
    inventoryItemId: fixtureInventory[5].id,
    type: "reservation",
    quantityDelta: 0,
    note: "Reserva ficticia de prueba para compra web futura",
    createdAt: "2026-08-03T12:20:00.000Z"
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    businessId: fixtureBusiness.id,
    inventoryItemId: fixtureInventory[7].id,
    type: "manual_adjustment",
    quantityDelta: -1,
    note: "Ajuste ficticio por carta enviada a revision",
    createdAt: "2026-08-03T12:30:00.000Z"
  },
  {
    id: "55555555-5555-4555-8555-555555555556",
    businessId: fixtureBusiness.id,
    inventoryItemId: fixtureInventory[10].id,
    type: "import",
    quantityDelta: 2,
    unitCostUsd: 22,
    note: "Ingreso ficticio desde lote premium",
    createdAt: "2026-08-03T12:45:00.000Z"
  },
  {
    id: "55555555-5555-4555-8555-555555555557",
    businessId: fixtureBusiness.id,
    inventoryItemId: fixtureInventory[9].id,
    type: "reservation_release",
    quantityDelta: 0,
    note: "Liberacion ficticia de reserva vencida",
    createdAt: "2026-08-03T13:00:00.000Z"
  },
  {
    id: "55555555-5555-4555-8555-555555555558",
    businessId: fixtureBusiness.id,
    inventoryItemId: fixtureInventory[11].id,
    type: "import",
    quantityDelta: 10,
    unitCostUsd: 0.25,
    note: "Importacion ficticia con estado a revisar",
    createdAt: "2026-08-03T13:15:00.000Z"
  }
];

export const fixtureImports: ImportRun[] = [
  {
    id: "66666666-6666-4666-8666-666666666661",
    businessId: fixtureBusiness.id,
    source: "monprice_csv",
    status: "needs_review",
    fileName: "demo-monprice.csv",
    totalRows: 12,
    reviewRows: 2,
    createdAt: "2026-08-03T12:10:00.000Z",
    note: "Dos filas tienen expansion o condicion sin confirmar."
  },
  {
    id: "66666666-6666-4666-8666-666666666662",
    businessId: fixtureBusiness.id,
    source: "manual_csv",
    status: "parsed",
    fileName: "lote-feria-demo.csv",
    totalRows: 36,
    reviewRows: 0,
    createdAt: "2026-08-03T13:10:00.000Z",
    note: "Archivo ficticio parseado, todavia no aplicado."
  },
  {
    id: "66666666-6666-4666-8666-666666666663",
    businessId: fixtureBusiness.id,
    source: "legacy_snapshot",
    status: "ready",
    fileName: "snapshot-stock-demo.csv",
    totalRows: 84,
    reviewRows: 1,
    createdAt: "2026-08-03T13:35:00.000Z",
    note: "Snapshot ficticio para probar conciliacion visual."
  }
];
