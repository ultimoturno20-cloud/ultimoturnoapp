import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type View = "dashboard" | "inventory" | "claims" | "claim-live" | "orders" | "sales" | "purchases" | "catalog" | "movements" | "import" | "mobile-intake" | "admin";
type AvailabilityFilter = "all" | "available" | "reserved" | "out";
type LanguageGroupFilter = "all" | "english" | "japanese" | "chinese";
type SortMode = "name" | "expansion" | "number" | "price" | "quantity";
type IssueFilter = "all" | "missingImage" | "missingPriceCharting" | "zeroPrice" | "lowStock" | "duplicates";
type InventoryPriceSource = "sale" | "pricecharting" | "tcgplayer" | "coolstuff";
type InventoryDensity = "comfortable" | "compact";
type InventoryBatchPatch = {
  location?: string;
  intakeBatch?: string;
  inventoryStatus?: string;
  priceSource?: InventoryPriceSource;
  tags?: string;
};
type CardIndexFilter = "all" | "matched" | "pending_review" | "weak_match" | "conflict" | "pricecharting_only" | "missing_tcg" | "missing_image" | "approved" | "rejected" | "manual";
type OrderFilter = "all" | "pending" | "packed" | "paid" | "debt" | "no_message" | "message" | "note";
type InventoryFilters = {
  query: string;
  expansion: string;
  language: string;
  languageGroup: LanguageGroupFilter;
  condition: string;
  location: string;
  intakeBatch: string;
  inventoryStatus: string;
  tag: string;
  availability: AvailabilityFilter;
  priceSource: InventoryPriceSource;
  sortMode: SortMode;
  issue: IssueFilter;
};

type AppEnvironment = {
  dataProfile: string;
  allowExamples: boolean;
};

type BlueExchangeRate = {
  buy: number | null;
  sell: number;
  source: string;
  updatedAt: string;
  fallback: boolean;
};

type StockRow = {
  purchaseCost: number | null;
  purchaseCurrency: string;
  id: string;
  businessId: string;
  sku: string;
  location: string;
  intakeBatch: string;
  inventoryStatus: string;
  tags: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
  priceArs: number;
  priceUsd: number | null;
  priceReferences?: {
    sale: { ars: number; usd: number | null };
    priceCharting: { usd: number | null; priceChartingId: string; url: string };
    tcgplayer: {
      usd: number | null;
      productId: string;
      url: string;
      subTypeName: string;
      lowPriceUsd: number | null;
      midPriceUsd: number | null;
      highPriceUsd: number | null;
      marketPriceUsd: number | null;
      directLowPriceUsd: number | null;
    };
    coolstuff: { usd: number | null; url: string };
  };
  lastPurchaseArs: number | null;
  lastPurchaseAt?: string;
  active: boolean;
  product: {
    id: string;
    name: string;
    expansion: string;
    number?: string;
    imageUrl?: string;
    identifiers: Array<{ source: string; externalId: string; url?: string }>;
  };
  variant: {
    id: string;
    language: string;
    condition: string;
    finish: string;
    gradingCompany?: string;
    grade?: string;
    gradingCert?: string;
  };
};

type StockSummary = {
  totalSkus: number;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  stockValueArs: number;
};

type InventoryResetResult = {
  touchedSkus: number;
  unitsCleared: number;
  reservationsCleared: number;
};

type MovementRow = {
  id: string;
  inventoryItemId: string;
  type: string;
  quantityDelta: number;
  note?: string;
  createdAt: string;
  itemName?: string;
  sku?: string;
};

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName?: string;
  createdAt: string;
};

type SnapshotPreviewRow = InventoryFormState & {
  rowNumber: number;
  action: "create" | "update" | "review" | "invalid";
  warnings: string[];
  existingSku?: string;
  translatedName?: string;
  candidates: ImportCandidate[];
  priceChartingId?: string;
  priceChartingUrl?: string;
  priceChartingCandidates: PriceChartingImportCandidate[];
};

type ImportRunRow = {
  id: string;
  businessId: string;
  source: string;
  status: string;
  fileName: string;
  totalRows: number;
  reviewRows: number;
  appliedRows: number;
  createdAt: string;
  note?: string;
};

type ImportCandidate = {
  inventoryItemId: string;
  sku: string;
  name: string;
  expansion: string;
  number?: string;
  language: string;
  condition: string;
  gradingCompany?: string;
  grade?: string;
  gradingCert?: string;
  imageUrl?: string;
  confidence: number;
  reasons: string[];
};

type PriceChartingImportCandidate = {
  priceChartingId: string;
  canonicalUrl: string;
  productName: string;
  expansionName: string;
  cardNumber: string;
  loosePriceUsd: number | null;
  imageUrl?: string;
  confidence: number;
  reasons: string[];
};

type ImportResolution = {
  resolution: "create" | "update" | "ignore";
  matchedInventoryItemId?: string;
  priceChartingId?: string;
};

type ImportBatchState = {
  name: string;
  defaultLocation: string;
  defaultInventoryStatus: string;
  note: string;
};

type MobileInventoryCandidate = {
  id: string;
  matchType: "inventory" | "card_index";
  inventoryItemId?: string;
  priceChartingId: string;
  sku: string;
  name: string;
  expansion: string;
  number: string;
  language: string;
  condition: string;
  finish: string;
  gradingCompany: string;
  grade: string;
  availableQuantity: number;
  priceArs: number;
  priceUsd: number | null;
  imageUrl: string;
  helper: string;
  score: number;
};

type MobileInventoryEntry = {
  id: string;
  businessId: string;
  status: "pending" | "reviewed" | "rejected";
  helperName: string;
  source: string;
  matchType: "inventory" | "card_index" | "manual";
  inventoryItemId?: string;
  priceChartingId: string;
  sku: string;
  name: string;
  expansion: string;
  number: string;
  language: string;
  condition: string;
  finish: string;
  gradingCompany: string;
  grade: string;
  location: string;
  intakeBatch: string;
  quantityOnHand: number;
  priceArs: number;
  priceUsd: number | null;
  imageUrl: string;
  notes: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedByName?: string;
};

type MobileInventoryApplyResult = {
  requestedEntries: number;
  appliedEntries: number;
  appliedGroups: number;
  unitsApplied: number;
  createdItems: number;
  updatedItems: number;
  skippedEntries: number;
  errors: Array<{ id: string; name: string; error: string }>;
};

type MobileIntakeDraft = {
  name: string;
  expansion: string;
  number: string;
  language: string;
  condition: string;
  finish: string;
  quantityOnHand: string;
  location: string;
  intakeBatch: string;
  priceArs: string;
  priceUsd: string;
  notes: string;
};

type StockQualitySummary = {
  missingImage: number;
  missingPriceCharting: number;
  zeroPrice: number;
  lowStock: number;
  duplicates: number;
};

type IconName = "activity" | "cart" | "check" | "claims" | "close" | "copy" | "download" | "edit" | "external" | "filter" | "home" | "image" | "import" | "inventory" | "orders" | "palette" | "play" | "plus" | "purchases" | "refresh" | "sales" | "search" | "settings";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    activity: <><path d="M4 12h4l2-7 4 14 2-7h4" /></>,
    cart: <><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /><path d="M3 5h2l2.2 10h10.2l2-7H7" /></>,
    check: <path d="m5 12 4 4 10-10" />,
    claims: <><path d="M5 4h14v16H5z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></>,
    close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    edit: <><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="m13 7 4 4" /></>,
    external: <><path d="M14 4h6v6" /><path d="m10 14 10-10" /><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" /></>,
    filter: <><path d="M4 5h16" /><path d="M7 12h10" /><path d="M10 19h4" /></>,
    home: <><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></>,
    image: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="m7 16 4-4 3 3 2-2 3 3" /><circle cx="9" cy="9" r="1" /></>,
    import: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></>,
    inventory: <><path d="M4 7h16" /><path d="M6 7v13h12V7" /><path d="M9 11h6" /></>,
    orders: <><path d="M7 4h10v16H7z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    play: <path d="M8 5v14l11-7-11-7Z" />,
    purchases: <><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
    refresh: <><path d="M20 12a8 8 0 0 1-13.7 5.7" /><path d="M4 12A8 8 0 0 1 17.7 6.3" /><path d="M17 2v5h-5" /><path d="M7 22v-5h5" /></>,
    sales: <><path d="M12 3v18" /><path d="M17 7.5c-.9-1-2.4-1.5-4.3-1.5-2.2 0-3.7.9-3.7 2.5 0 4 8 1.8 8 6 0 1.7-1.6 2.8-4.1 2.8-2 0-3.7-.6-4.9-1.8" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 21 10h0a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
    palette: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

type CartLine = {
  inventoryItemId: string;
  quantity: number;
  unitPriceArs: number;
};

type SaleRecord = {
  id: string;
  customerName: string;
  saleType: "sale" | "reservation";
  status: "pending" | "packed" | "paid" | "delivered" | "cancelled";
  channel: string;
  totalArs: number;
  totalUsd: number;
  amountPaidArs: number;
  paymentDueAt?: string;
  internalNote: string;
  messageSentAt?: string;
  createdAt: string;
  completedAt?: string;
  lines: Array<CartLine & { name: string; sku: string; imageUrl: string; unitPriceUsd: number; lineTotalArs: number; lineTotalUsd: number; priceCurrency: "ARS" | "USD" | "FREE"; saleItemId: string; packed: boolean; packedAt?: string }>;
};

type PurchaseRecord = {
  id: string;
  sellerName: string;
  status: "received" | "cancelled";
  totalArs: number;
  note: string;
  createdAt: string;
  lines: Array<{ inventoryItemId: string; quantity: number; unitCostArs: number; lineTotalArs: number; name: string; sku: string }>;
};

type PurchaseCartLine = {
  inventoryItemId?: string;
  priceChartingId?: string;
  quantity: number;
  unitCostArs: number;
  name?: string;
  expansion?: string;
  number?: string;
  imageUrl?: string;
};

type StockImageReviewItem = {
  inventoryItemId: string;
  productName: string;
  expansion: string;
  cardNumber?: string;
  language: string;
  condition: string;
  productId: string;
  hasProductImage: boolean;
  priceChartingId: string;
  priceChartingName: string;
  priceChartingExpansion: string;
  priceChartingNumber: string;
  pcPublicUrl: string;
  pcSourceUrl: string;
  pcCanonicalUrl: string;
  pcImageUrl: string;
  imageSource: string;
  matchCriteria: string;
  quantityOnHand: number;
  availableQuantity: number;
  sku: string;
};

type ImageCatalogEntry = {
  priceChartingId: string;
  productName: string;
  expansionName: string;
  cardNumber: string;
  loosePriceUsd: number | null;
  canonicalUrl: string;
  imageUrl: string;
  sourceImageUrl: string;
  publicUrl: string;
  status: string;
  sourceImageFound: boolean;
  downloadedLocally: boolean;
  bytesDownloaded: number;
  attempts: number;
  errorMessage: string;
  lastAttemptAt?: string;
  downloadedAt?: string;
  importedAt: string;
  lastAttemptRelative: string;
  statusColor: string;
  sourceLabel: string;
};

type ClaimSession = {
  id: string;
  name: string;
  status: "open" | "closed" | "archived";
  sourceNote: string;
  paymentDueAt?: string;
  createdAt: string;
  closedAt?: string;
  closedSaleIds: string[];
};

type ClaimCard = {
  id: string;
  claimId: string;
  sectionId: string;
  priceChartingId: string;
  canonicalUrl: string;
  productName: string;
  expansionName: string;
  cardNumber: string;
  imageUrl: string;
  pcPriceUsd: number | null;
  suggestedArs: number;
  finalPriceArs: number;
  finalPriceUsd: number;
  finalName: string;
  buyer: string;
  quantity: number;
  tags: string;
  status: "draft" | "ready" | "sold" | "ignored";
  gridBatch: string;
  sortOrder: number;
};

type ClaimSection = {
  id: string;
  claimId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

type ClaimFree = {
  id: string;
  claimId: string;
  buyer: string;
  finalName: string;
  productName: string;
  expansionName: string;
  quantity: number;
  priceChartingId: string;
  canonicalUrl: string;
  tags: string;
  notes: string;
};

type ClaimsWorkspace = {
  activeClaim: ClaimSession | null;
  sections: ClaimSection[];
  cards: ClaimCard[];
  frees: ClaimFree[];
  history: Array<ClaimSession & { cards: number; buyers: number; totalArs: number; totalUsd: number }>;
  summary: {
    cards: number;
    cardsWithBuyer: number;
    buyers: number;
    missingPrices: number;
    missingImages: number;
    totalArs: number;
    totalUsd: number;
    claimTotalArs: number;
    claimTotalUsd: number;
    frees: number;
  };
};

type ClaimOrderPreview = {
  claimId: string;
  claimName: string;
  buyers: Array<{
    buyer: string;
    totalArs: number;
    totalUsd: number;
    units: number;
    lines: Array<{
      kind: "card" | "free";
      claimCardId: string;
      claimFreeId: string;
      displayName: string;
      productName: string;
      expansionName: string;
      priceChartingId: string;
      quantity: number;
      unitPriceArs: number;
      unitPriceUsd: number;
      lineTotalArs: number;
      lineTotalUsd: number;
      tags: string;
      sourceReference: string;
    }>;
  }>;
  totals: {
    buyers: number;
    lines: number;
    units: number;
    totalArs: number;
    totalUsd: number;
  };
};

type PriceChartingCacheEntry = {
  priceChartingId: string;
  canonicalUrl: string;
  sourceUrl: string;
  productName: string;
  normalizedName?: string;
  expansionName: string;
  normalizedExpansion?: string;
  cardNumber: string;
  languageGroup: LanguageGroupFilter;
  language?: string;
  finish?: string;
  loosePriceUsd: number | null;
  tcgplayerPriceUsd?: number | null;
  tcgplayerSubtype?: string;
  imageUrl: string;
  importedAt: string;
};

type PriceChartingCacheStatus = {
  totalEntries: number;
  pricedEntries: number;
  lastRun: null | {
    id: string;
    category: string;
    status: "completed" | "failed";
    rowsReceived: number;
    rowsImported: number;
    rowsSkipped: number;
    errorMessage: string;
    completedAt: string;
  };
};

type PriceChartingAutoRefreshStatus = {
  enabled: boolean;
  time: string;
  timezone: string;
  category: string;
  running: boolean;
  nextRunAt: string;
  lastStartedAt: string;
  lastCompletedAt: string;
  lastStatus: "never" | "success" | "failed" | "skipped";
  lastError: string;
  lastEntries: number;
};

type TcgplayerPriceCacheStatus = {
  totalEntries: number;
  pricedEntries: number;
  productEntries: number;
  linkedProductEntries: number;
  linkedCardIndexEntries: number;
  lastRun: null | {
    id: string;
    source: string;
    categoryId: string;
    sourceVersion: string;
    status: "completed" | "failed" | "skipped";
    groupsSeen: number;
    rowsReceived: number;
    rowsImported: number;
    rowsSkipped: number;
    errorMessage: string;
    completedAt: string;
  };
};

type TcgplayerPriceAutoRefreshStatus = {
  enabled: boolean;
  time: string;
  timezone: string;
  source: string;
  categoryId: string;
  running: boolean;
  nextRunAt: string;
  lastStartedAt: string;
  lastCompletedAt: string;
  lastStatus: "never" | "success" | "failed" | "skipped";
  lastError: string;
  lastEntries: number;
};

type PriceChartingImageCacheStatus = {
  totalEntries: number;
  pendingEntries: number;
  urlEntries: number;
  downloadedEntries: number;
  failedEntries: number;
  bytesStored: number;
  stockLinkedEntries: number;
};

type CardIndexEntry = {
  id: string;
  priceChartingId: string;
  canonicalName: string;
  canonicalExpansion: string;
  cardNumber: string;
  languageGroup: LanguageGroupFilter;
  priceChartingUrl: string;
  tcgplayerProductId: string;
  tcgplayerUrl: string;
  tcgplayerImageUrl: string;
  coolstuffUrl: string;
  imageUrl: string;
  imageSource: string;
  matchConfidence: number;
  matchStatus: "pricecharting_only" | "matched" | "weak_match" | "conflict" | "manual";
  reviewStatus: "pending" | "approved" | "rejected" | "manual";
  reviewNote: string;
  evidence: Record<string, unknown>;
  updatedAt: string;
  reviewedAt?: string;
};

type CardIndexStatus = {
  totalEntries: number;
  priceChartingEntries: number;
  tcgplayerLinkedEntries: number;
  coolstuffLinkedEntries: number;
  imageLinkedEntries: number;
  matchedEntries: number;
  weakMatchEntries: number;
  conflictEntries: number;
  priceChartingOnlyEntries: number;
  lastRun: null | {
    source: string;
    status: "completed" | "failed";
    rowsSeen: number;
    rowsMatched: number;
    rowsWeak: number;
    rowsConflict: number;
    errorMessage: string;
    completedAt: string;
  };
};

type CardIndexTcgCsvBatchResult = {
  status: CardIndexStatus;
  rowsSeen: number;
  rowsMatched: number;
  rowsWeak: number;
  rowsConflict: number;
  rowsSkipped: number;
  groupOffset: number;
  groupLimit: number;
  groupsProcessed: number;
  totalGroups: number;
  nextGroupOffset: number | null;
  complete: boolean;
};

type CardIndexPriceChartingBatchResult = {
  processed: number;
  nextAfterId: string;
  complete: boolean;
  status: CardIndexStatus;
};

type ImageResolverMode = "auto" | "pokemon-tcg" | "external-index";

type ImageBatchResult = {
  mode: ImageResolverMode;
  includeAll: boolean;
  processed: number;
  urlFound: number;
  downloaded: number;
  skipped: number;
  failed: number;
  rateLimited?: boolean;
  cooldownUntil?: string;
  completedAt: string;
  items: Array<{ priceChartingId: string; status: "downloaded" | "url_found" | "failed" | "skipped"; source?: string; error?: string }>;
};

type InventoryFormState = {
  purchaseCost: number | null;
  purchaseCurrency: string;
  sku: string;
  name: string;
  expansion: string;
  number: string;
  imageUrl: string;
  priceChartingId: string;
  priceChartingUrl: string;
  language: string;
  condition: string;
  finish: string;
  gradingCompany: string;
  grade: string;
  gradingCert: string;
  location: string;
  intakeBatch: string;
  inventoryStatus: string;
  tags: string;
  quantityOnHand: number;
  quantityReserved: number;
  priceArs: number;
  priceUsd: number | null;
  notes: string;
};

const apiBase = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
const accessKeyStorageKey = "ultimoturno_access_key";
const accessKeyCookieName = "ultimoturno_access_key";
const importDraftStorageKey = "ultimoturno_import_stock_draft_v2";
const mobileHelperStorageKey = "ultimoturno_mobile_helper_name";
const mobileBatchStorageKey = "ultimoturno_mobile_default_batch";
const mobileConditionStorageKey = "ultimoturno_mobile_default_condition";
const fallbackBlueRateSell = 1540;
const exampleSnapshotCsv = `sku,name,expansion,number,language,condition,finish,gradingCompany,grade,gradingCert,location,quantityOnHand,quantityReserved,priceArs,priceUsd
UT-CSV-HORSEA-AQ-EN-NM,Horsea,Aquapolis,85,EN,NM,normal,,,,Caja agua C,2,0,4500,3.6
,Flareon EX,Generations,RC28,EN,NM,normal,,,,Caja fuego A,1,0,180000,117
,Team Rocket's Mewtwo Ex,Ascended Heroes,281,EN,GRADED,normal,PSA,10,12345678,Vitrina PSA,1,0,850000,535.5
,ピカチュウ,Promo Demo,025,JA,NM,holo,,,,Caja promos,1,0,9000,7.2
UT-CSV-DUPLICADO,Eevee,Set Demo,133,EN,NM,normal,,,,Caja A,1,0,2500,2
UT-CSV-DUPLICADO,Eevee,Set Demo,133,EN,NM,normal,,,,Caja A,1,0,2500,2
UT-CSV-INVALIDA,,Sin expansion,,EN,NM,normal,,,,,0,0,-10,`;

function App() {
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessKeyDraft, setAccessKeyDraft] = useState(() => getStoredAccessKey());
  const [accessChecking, setAccessChecking] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [userName, setUserName] = useState("");
  const [environment, setEnvironment] = useState<AppEnvironment>({ dataProfile: "EJEMPLOS", allowExamples: true });
  const [blueRate, setBlueRate] = useState<BlueExchangeRate>(() => fallbackBlueRate());
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mobile") === "1" || window.location.hash === "#mobile" ? "mobile-intake" : "dashboard";
  });
  const [stock, setStock] = useState<{ summary: StockSummary; items: StockRow[] }>({ summary: emptySummary(), items: [] });
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [importRuns, setImportRuns] = useState<ImportRunRow[]>([]);
  const [mobileEntries, setMobileEntries] = useState<MobileInventoryEntry[]>([]);
  const [claims, setClaims] = useState<ClaimsWorkspace>(() => emptyClaimsWorkspace());
  const [priceChartingCache, setPriceChartingCache] = useState<{ entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus }>({ entries: [], status: emptyPriceChartingStatus() });
  const [priceChartingAutoRefresh, setPriceChartingAutoRefresh] = useState<PriceChartingAutoRefreshStatus>(() => emptyPriceChartingAutoRefreshStatus());
  const [tcgplayerPrices, setTcgplayerPrices] = useState<TcgplayerPriceCacheStatus>(() => emptyTcgplayerPriceStatus());
  const [tcgplayerPriceAutoRefresh, setTcgplayerPriceAutoRefresh] = useState<TcgplayerPriceAutoRefreshStatus>(() => emptyTcgplayerPriceAutoRefreshStatus());
  const [tcgplayerPriceSyncing, setTcgplayerPriceSyncing] = useState(false);
  const [priceChartingImages, setPriceChartingImages] = useState<PriceChartingImageCacheStatus>(() => emptyPriceChartingImageStatus());
  const [cardIndexStatus, setCardIndexStatus] = useState<CardIndexStatus>(() => emptyCardIndexStatus());
  const [cardIndexEntries, setCardIndexEntries] = useState<CardIndexEntry[]>([]);
  const [cardIndexSyncing, setCardIndexSyncing] = useState(false);
  const [cardIndexNextGroupOffset, setCardIndexNextGroupOffset] = useState<number | null>(0);
  const [cardIndexRebuildAfterId, setCardIndexRebuildAfterId] = useState("");
  const [priceChartingSyncing, setPriceChartingSyncing] = useState(false);
  const [priceChartingImageProcessing, setPriceChartingImageProcessing] = useState(false);
  const [claimImageSearching, setClaimImageSearching] = useState(false);
  const [claimCardImageSearching, setClaimCardImageSearching] = useState("");
  const [claimPriceRefreshing, setClaimPriceRefreshing] = useState(false);
  const [priceChartingImageBackfillRunning, setPriceChartingImageBackfillRunning] = useState(false);
  const [priceChartingImageResumeAt, setPriceChartingImageResumeAt] = useState("");
  const [priceChartingImageLastBatch, setPriceChartingImageLastBatch] = useState<ImageBatchResult | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartMode, setCartMode] = useState<"sale" | "reservation">("sale");
  const [customerName, setCustomerName] = useState("");
  const [saleChannel, setSaleChannel] = useState("mostrador");
  const [cartFocusNonce, setCartFocusNonce] = useState(0);
  const [purchaseCart, setPurchaseCart] = useState<PurchaseCartLine[]>([]);
  const [purchaseSeller, setPurchaseSeller] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [importResolutions, setImportResolutions] = useState<Record<number, ImportResolution>>({});
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [expansion, setExpansion] = useState("all");
  const [language, setLanguage] = useState("all");
  const [languageGroup, setLanguageGroup] = useState<LanguageGroupFilter>("all");
  const [condition, setCondition] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [inventoryPriceSource, setInventoryPriceSource] = useState<InventoryPriceSource>("sale");
  const [inventoryDensity, setInventoryDensity] = useState<InventoryDensity>("comfortable");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [issue, setIssue] = useState<IssueFilter>("all");
  const [form, setForm] = useState<InventoryFormState>(() => blankForm());
  const [editingId, setEditingId] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [productImageForcing, setProductImageForcing] = useState<"" | "auto" | "manual">("");
  const [adjustment, setAdjustment] = useState({ quantityDelta: 1, note: "" });
  const [csvText, setCsvText] = useState(() => readImportDraft().csvText);
  const [previewRows, setPreviewRows] = useState<SnapshotPreviewRow[]>([]);
  const [importBatch, setImportBatch] = useState(() => readImportDraft().batch);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [initialExamplesChecked, setInitialExamplesChecked] = useState(false);
  const [showStockImageReview, setShowStockImageReview] = useState(false);
  const [stockImageReview, setStockImageReview] = useState<{ items: StockImageReviewItem[]; total: number }>({ items: [], total: 0 });
  const [stockImageReviewLoading, setStockImageReviewLoading] = useState(false);
  const [stockRestoring, setStockRestoring] = useState(false);
  const [showImageCatalog, setShowImageCatalog] = useState(false);
  const [imageCatalog, setImageCatalog] = useState<{ entries: ImageCatalogEntry[]; total: number }>({ entries: [], total: 0 });
  const [imageCatalogLoading, setImageCatalogLoading] = useState(false);
  const [imageCatalogFilter, setImageCatalogFilter] = useState<"all" | "downloaded" | "url_found" | "failed" | "pending">("all");
  const [imageCatalogSearch, setImageCatalogSearch] = useState("");
  const [catalogLanguageGroup, setCatalogLanguageGroup] = useState<LanguageGroupFilter>("all");

  async function fetchOperationalData() {
    const [stockData, movementData, auditData, me] = await Promise.all([
      api<{ summary: StockSummary; items: StockRow[] }>("/stock"),
      api<{ movements: MovementRow[] }>("/movements"),
      api<{ audit: AuditRow[] }>("/audit"),
      api<{ user: { displayName: string }; environment?: AppEnvironment }>("/auth/me")
    ]);
    const [salesData, purchasesData, importData, mobileEntryData, claimsData, priceChartingData, priceChartingAutoRefreshData, tcgplayerPriceData, tcgplayerPriceAutoRefreshData, cardIndexData, cardIndexListData, blueRateData] = await Promise.all([
      api<{ sales: SaleRecord[] }>("/sales").catch(() => ({ sales: [] })),
      api<{ purchases: PurchaseRecord[] }>("/purchases").catch(() => ({ purchases: [] })),
      api<{ imports: ImportRunRow[] }>("/imports").catch(() => ({ imports: [] })),
      api<{ entries: MobileInventoryEntry[] }>("/mobile-intake/entries?status=all&limit=20000").catch(() => ({ entries: [] })),
      api<ClaimsWorkspace>("/claims"),
      api<{ entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus }>("/pricecharting-cache?limit=30")
        .catch(() => ({ entries: [], status: emptyPriceChartingStatus() })),
      api<PriceChartingAutoRefreshStatus>("/pricecharting-cache/auto-refresh/status").catch(() => emptyPriceChartingAutoRefreshStatus()),
      api<TcgplayerPriceCacheStatus>("/tcgplayer-prices/status").catch(() => emptyTcgplayerPriceStatus()),
      api<TcgplayerPriceAutoRefreshStatus>("/tcgplayer-prices/auto-refresh/status").catch(() => emptyTcgplayerPriceAutoRefreshStatus()),
      api<CardIndexStatus>("/card-index/status").catch(() => emptyCardIndexStatus()),
      api<{ entries: CardIndexEntry[]; status: CardIndexStatus }>("/card-index?limit=60").catch(() => ({ entries: [], status: emptyCardIndexStatus() })),
      api<BlueExchangeRate>("/exchange-rate/blue").catch(() => fallbackBlueRate())
    ]);
    const priceChartingImageData = emptyPriceChartingImageStatus();
    return { stockData, movementData, auditData, salesData, purchasesData, importData, mobileEntryData, claimsData, priceChartingData, priceChartingAutoRefreshData, tcgplayerPriceData, tcgplayerPriceAutoRefreshData, priceChartingImageData, cardIndexData, cardIndexListData, blueRateData, me };
  }

  async function refresh(seedExamplesIfEmpty = false) {
    let { stockData, movementData, auditData, salesData, purchasesData, importData, mobileEntryData, claimsData, priceChartingData, priceChartingAutoRefreshData, tcgplayerPriceData, tcgplayerPriceAutoRefreshData, priceChartingImageData, cardIndexData, cardIndexListData, blueRateData, me } = await fetchOperationalData();
    if (seedExamplesIfEmpty && stockData.items.length === 0 && me.environment?.allowExamples !== false) {
      const result = await api<{ created: number; skipped: number }>("/examples/inventory", { method: "POST" });
      ({ stockData, movementData, auditData, salesData, purchasesData, importData, mobileEntryData, claimsData, priceChartingData, priceChartingAutoRefreshData, tcgplayerPriceData, tcgplayerPriceAutoRefreshData, priceChartingImageData, cardIndexData, cardIndexListData, blueRateData, me } = await fetchOperationalData());
      if (result.created > 0) showMessage(`Cargue ${result.created} ejemplos para que puedas revisar el flujo.`);
    }
    setStock(stockData);
    setMovements(movementData.movements);
    setAudit(auditData.audit);
    setSales(salesData.sales);
    setPurchases(purchasesData.purchases);
    setImportRuns(importData.imports);
    setMobileEntries(mobileEntryData.entries);
    setClaims(claimsData);
    setPriceChartingCache(priceChartingData);
    setPriceChartingAutoRefresh(priceChartingAutoRefreshData);
    setTcgplayerPrices(tcgplayerPriceData);
    setTcgplayerPriceAutoRefresh(tcgplayerPriceAutoRefreshData);
    setPriceChartingImages(priceChartingImageData);
    setCardIndexStatus(cardIndexListData.status.totalEntries || cardIndexListData.entries.length ? cardIndexListData.status : cardIndexData);
    setCardIndexEntries(cardIndexListData.entries);
    setBlueRate(blueRateData);
    setUserName(me.user.displayName);
    setEnvironment(me.environment || { dataProfile: "EJEMPLOS", allowExamples: true });
    setSelectedId((current) => current || stockData.items[0]?.id || "");
  }

  async function refreshPriceChartingImageStatus() {
    setPriceChartingImages(await api<PriceChartingImageCacheStatus>("/pricecharting-images/status"));
  }

  async function submitAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKey = accessKeyDraft.trim();
    if (!nextKey) {
      setError("Ingresa la clave de acceso.");
      return;
    }
    setAccessChecking(true);
    setStoredAccessKey(nextKey);
    try {
      await refresh();
      setInitialLoadComplete(true);
      setAccessRequired(false);
      setError("");
      showMessage("Acceso habilitado.");
    } catch (nextError) {
      clearStoredAccessKey();
      setAccessRequired(true);
      setError(errorMessage(nextError));
    } finally {
      setAccessChecking(false);
    }
  }

  useEffect(() => {
    if (initialExamplesChecked) return;
    setInitialExamplesChecked(true);
    refresh(true)
      .catch((nextError) => {
        if (isAccessError(nextError)) setAccessRequired(true);
        else setError(errorMessage(nextError));
      })
      .finally(() => setInitialLoadComplete(true));
  }, [initialExamplesChecked]);

  useEffect(() => {
    if (!["catalog", "admin"].includes(view) || priceChartingImages.totalEntries) return;
    refreshPriceChartingImageStatus().catch(() => undefined);
  }, [priceChartingImages.totalEntries, view]);

  useEffect(() => {
    if (!message || error) return;
    const timeout = window.setTimeout(() => {
      setMessage("");
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [error, message]);

  useEffect(() => {
    writeLocalStorage(importDraftStorageKey, JSON.stringify({ csvText, batch: importBatch }));
  }, [csvText, importBatch]);

  useEffect(() => {
    if (!priceChartingImageBackfillRunning || priceChartingImageProcessing) return;
    const resumeAt = priceChartingImageResumeAt ? new Date(priceChartingImageResumeAt).getTime() : 0;
    const delay = Math.max(500, resumeAt - Date.now());
    const timeout = window.setTimeout(() => {
      setPriceChartingImageResumeAt("");
      processPriceChartingImages(true, "external-index").catch((nextError) => {
        setPriceChartingImageBackfillRunning(false);
        showError(nextError);
      });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [priceChartingImageBackfillRunning, priceChartingImageProcessing, priceChartingImageResumeAt, priceChartingImages.downloadedEntries, priceChartingImages.pendingEntries]);

  const selected = stock.items.find((item) => item.id === selectedId) || stock.items[0];
  const selectedMovements = selected ? movements.filter((movement) => movement.inventoryItemId === selected.id) : [];
  const duplicateKeys = useMemo(() => buildDuplicateIdentityKeys(stock.items), [stock.items]);
  const quality = useMemo(() => summarizeStockQuality(stock.items, duplicateKeys), [duplicateKeys, stock.items]);
  const options = useMemo(() => ({
    expansions: unique(stock.items.map((item) => item.product.expansion)),
    languages: unique(stock.items.map((item) => item.variant.language)),
    conditions: unique(stock.items.map((item) => item.variant.condition)),
    locations: unique(stock.items.map((item) => item.location).filter(Boolean)),
    intakeBatches: unique(stock.items.map((item) => item.intakeBatch).filter(Boolean)),
    inventoryStatuses: unique(stock.items.map((item) => item.inventoryStatus || "available")),
    tags: unique(stock.items.flatMap((item) => inventoryTags(item.tags)))
  }), [stock.items]);
  const visibleItems = useMemo(() => {
    const parsedSearch = parseUiSearchQuery(query);
    return stock.items
      .map((item) => ({ item, searchScore: scoreStockSearch(item, parsedSearch) }))
      .filter(({ item, searchScore }) => {
        return (!parsedSearch.tokens.length || searchScore > 0) &&
          (expansion === "all" || item.product.expansion === expansion) &&
          (language === "all" || item.variant.language === language) &&
          (languageGroup === "all" || inventoryLanguageGroup(item.variant.language) === languageGroup) &&
          (condition === "all" || item.variant.condition === condition) &&
          (locationFilter === "all" || item.location === locationFilter) &&
          (batchFilter === "all" || item.intakeBatch === batchFilter) &&
          (inventoryStatusFilter === "all" || (item.inventoryStatus || "available") === inventoryStatusFilter) &&
          (tagFilter === "all" || inventoryTags(item.tags).includes(tagFilter)) &&
          (issue === "all" || stockItemIssues(item, duplicateKeys).includes(issue)) &&
          (availability === "all" ||
            (availability === "available" && item.availableQuantity > 0) ||
            (availability === "reserved" && item.quantityReserved > 0) ||
            (availability === "out" && item.availableQuantity === 0));
      })
      .sort((left, right) => {
        if (parsedSearch.tokens.length && left.searchScore !== right.searchScore) return right.searchScore - left.searchScore;
        const leftItem = left.item;
        const rightItem = right.item;
        if (sortMode === "price") return inventoryPriceSortValue(rightItem, inventoryPriceSource, blueRate) - inventoryPriceSortValue(leftItem, inventoryPriceSource, blueRate);
        if (sortMode === "quantity") return rightItem.availableQuantity - leftItem.availableQuantity;
        if (sortMode === "expansion") return `${leftItem.product.expansion} ${leftItem.product.number || ""}`.localeCompare(`${rightItem.product.expansion} ${rightItem.product.number || ""}`, "es", { numeric: true });
        if (sortMode === "number") return (leftItem.product.number || "").localeCompare(rightItem.product.number || "", "es", { numeric: true });
        return leftItem.product.name.localeCompare(rightItem.product.name, "es");
      })
      .map(({ item }) => item);
  }, [availability, batchFilter, blueRate, condition, duplicateKeys, expansion, inventoryPriceSource, inventoryStatusFilter, issue, language, languageGroup, locationFilter, query, sortMode, stock.items, tagFilter]);

  function showMessage(text: string) {
    setMessage(text);
    setError("");
  }

  function showError(nextError: unknown) {
    setError(errorMessage(nextError));
    setMessage("");
  }

  function startCreate() {
    setProductReceipt("");
    setEditingId("");
    setForm({ ...blankForm(), quantityOnHand: 1 });
    setView("inventory");
    setProductModalOpen(true);
  }

  function startRestock(item: StockRow) {
    setEditingId("");
    setProductReceipt("");
    setForm({ ...formFromItem(item), quantityOnHand: 1, quantityReserved: 0 });
    setProductModalOpen(true);
  }

  function startEdit(item: StockRow) {
    setEditingId(item.id);
    setSelectedId(item.id);
    setForm(formFromItem(item));
    setView("inventory");
    setProductModalOpen(true);
  }

  function closeProductModal() {
    if (productRequest.current) return;
    setProductModalOpen(false);
    setEditingId("");
    setProductSaving(false);
    setProductImageForcing("");
    setForm(blankForm());
  }

  const productRequest = useRef(false);
  const [productReceipt, setProductReceipt] = useState("");
  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    if (productRequest.current) return;
    productRequest.current = true;
    setProductSaving(true);
    try {
      const result = await api<{ item: StockRow }>(editingId ? `/inventory/${editingId}` : "/inventory/intake", {
        method: editingId ? "PUT" : "POST",
        body: form
      });
      setStock((current) => {
        const exists = current.items.some((item) => item.id === result.item.id);
        const items = exists
          ? current.items.map((item) => item.id === result.item.id ? result.item : item)
          : [result.item, ...current.items];
        return { summary: summarizeStockRows(items), items };
      });
      setSelectedId(result.item.id);
      const receipt = editingId ? "Carta actualizada." : `${result.item.product.name}: +${form.quantityOnHand} unidad(es). Stock actual: ${result.item.quantityOnHand}.`;
      showMessage(receipt);
      setProductReceipt(receipt);
      if (editingId) { setEditingId(""); setProductModalOpen(false); }
      else { setForm({ ...blankForm(), quantityOnHand: 1 }); setProductModalOpen(true); }
      void refresh().catch(() => undefined);
    } catch (nextError) {
      showError(nextError);
    } finally {
      productRequest.current = false;
      setProductSaving(false);
    }
  }

  async function updateInventoryBatch(items: StockRow[], patch: InventoryBatchPatch) {
    if (!items.length) {
      showError(new Error("Selecciona al menos una carta."));
      return;
    }
    let updated = 0;
    let skipped = 0;
    const updatedItems = new Map<string, StockRow>();
    try {
      for (const item of items) {
        const body = formFromItem(item);
        if (patch.location !== undefined) body.location = patch.location;
        if (patch.intakeBatch !== undefined) body.intakeBatch = patch.intakeBatch;
        if (patch.inventoryStatus !== undefined) body.inventoryStatus = patch.inventoryStatus;
        if (patch.tags !== undefined) body.tags = inventoryTagsText([...inventoryTags(body.tags), ...inventoryTags(patch.tags)]);
        if (patch.priceSource && patch.priceSource !== "sale") {
          const price = inventoryPriceDisplay(item, patch.priceSource, blueRate);
          if (!price.hasPrice || !price.ars) {
            skipped++;
            continue;
          }
          body.priceArs = Math.round(price.ars);
          body.priceUsd = price.usd;
        }
        const result = await api<{ item: StockRow }>(`/inventory/${item.id}`, { method: "PUT", body });
        updatedItems.set(result.item.id, result.item);
        updated++;
      }
      setStock((current) => {
        const nextItems = current.items.map((item) => updatedItems.get(item.id) || item);
        return { summary: summarizeStockRows(nextItems), items: nextItems };
      });
      showMessage(`Lote actualizado: ${updated} carta(s)${skipped ? `, ${skipped} sin precio de fuente` : ""}.`);
      void refresh().catch(() => undefined);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function updateInventoryTags(item: StockRow, tags: string) {
    try {
      const result = await api<{ item: StockRow }>(`/inventory/${item.id}/tags`, { method: "PUT", body: { tags } });
      setStock((current) => {
        const items = current.items.map((stockItem) => stockItem.id === result.item.id ? result.item : stockItem);
        return { summary: summarizeStockRows(items), items };
      });
      setSelectedId(result.item.id);
      showMessage(result.item.tags ? `Categorias: ${result.item.tags}` : "Categorias limpiadas.");
      void refresh().catch(() => undefined);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function resetInventoryStockFromAdmin() {
    const confirmation = window.prompt(`Esto pone en cero TODO el stock disponible y reservado del inventario actual (${stock.summary.totalSkus.toLocaleString("es-AR")} SKUs / ${stock.summary.totalUnits.toLocaleString("es-AR")} unidades).\n\nNo borra cartas, precios, imagenes ni categorias.\n\nEscribi RESET INVENTARIO para confirmar:`);
    if (confirmation === null) return;
    if (confirmation !== "RESET INVENTARIO") {
      showError(new Error("Reset cancelado: confirmacion incorrecta."));
      return;
    }
    try {
      const { result } = await api<{ result: InventoryResetResult }>("/inventory/reset-stock", {
        method: "POST",
        body: { confirmation }
      });
      showMessage(`Inventario en cero: ${result.unitsCleared.toLocaleString("es-AR")} unidad(es), ${result.reservationsCleared.toLocaleString("es-AR")} reserva(s), ${result.touchedSkus.toLocaleString("es-AR")} SKU(s).`);
      await refresh();
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function forceProductImage(manualUrl?: string) {
    if (!editingId || productImageForcing) return;
    const mode = manualUrl === undefined ? "auto" : "manual";
    setProductImageForcing(mode);
    try {
      const result = await api<{ item: StockRow; imageUrl: string; source: string; message: string }>(`/inventory/${editingId}/image/force`, {
        method: "POST",
        body: manualUrl === undefined ? {} : { manualUrl }
      });
      setStock((current) => {
        const items = current.items.map((item) => item.id === result.item.id ? result.item : item);
        return { summary: summarizeStockRows(items), items };
      });
      setSelectedId(result.item.id);
      setForm((current) => ({ ...current, imageUrl: result.imageUrl }));
      setPriceChartingImages(await api<PriceChartingImageCacheStatus>("/pricecharting-images/status").catch(() => priceChartingImages));
      showMessage(result.message || "Imagen actualizada.");
      void refresh().catch(() => undefined);
    } catch (nextError) {
      showError(nextError);
    } finally {
      setProductImageForcing("");
    }
  }

  function forceProductImageManual() {
    if (!editingId) return;
    const manualUrl = window.prompt("Pega una URL directa de imagen o un link de PriceCharting:", form.imageUrl || "");
    if (manualUrl === null) return;
    void forceProductImage(manualUrl.trim());
  }

  async function saveAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      await api("/inventory-adjustments", {
        method: "POST",
        body: {
          inventoryItemId: selected.id,
          quantityDelta: Number(adjustment.quantityDelta),
          note: adjustment.note
        }
      });
      showMessage("Ajuste registrado y stock actualizado.");
      setAdjustment({ quantityDelta: 1, note: "" });
      await refresh();
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function setAvailableQuantity(item: StockRow, targetAvailable: number) {
    const nextAvailable = Math.max(0, Math.floor(Number(targetAvailable)));
    if (!Number.isFinite(nextAvailable)) return showError(new Error("La cantidad disponible no es valida."));
    const quantityDelta = nextAvailable - item.availableQuantity;
    if (quantityDelta === 0) return showMessage("El disponible ya tiene esa cantidad.");
    try {
      await api("/inventory-adjustments", {
        method: "POST",
        body: {
          inventoryItemId: item.id,
          quantityDelta,
          note: `Correccion rapida de disponible: ${item.availableQuantity} -> ${nextAvailable}`
        }
      });
      showMessage(`Disponible actualizado a ${nextAvailable}.`);
      setSelectedId(item.id);
      await refresh();
    } catch (nextError) {
      showError(nextError);
    }
  }

  function addToCart(item: StockRow) {
    if (item.availableQuantity <= 0) return showError(new Error("Esta carta no tiene unidades disponibles."));
    setCart((current) => {
      const existing = current.find((line) => line.inventoryItemId === item.id);
      if (existing) {
        if (existing.quantity >= item.availableQuantity) return current;
        return current.map((line) => line.inventoryItemId === item.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...current, { inventoryItemId: item.id, quantity: 1, unitPriceArs: item.priceArs }];
    });
    showMessage(`${item.product.name} agregada al carrito.`);
  }

  async function submitCart() {
    try {
      await api("/sales", {
        method: "POST",
        body: { customerName, saleType: cartMode, channel: saleChannel, lines: cart }
      });
      showMessage(cartMode === "reservation" ? "Reserva creada y enviada a Ordenes." : "Venta registrada y stock descontado.");
      setCart([]);
      setCustomerName("");
      await refresh();
      setView(cartMode === "reservation" ? "orders" : "sales");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function updateOrder(id: string, action: "complete" | "cancel" | "packed" | "delivered") {
    try {
      const result = await api<{ sale: SaleRecord }>(`/sales/${id}/${action}`, { method: "POST" });
      showMessage(action === "complete" ? "Reserva cobrada y stock descontado." : action === "packed" ? "Orden marcada como embalada." : action === "delivered" ? "Orden entregada y archivada." : "Reserva cancelada y stock liberado.");
      if (action === "packed" || action === "delivered") {
        setSales((current) => current.map((sale) => sale.id === result.sale.id ? result.sale : sale));
      } else {
        await refresh();
      }
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function updateOrderPayment(id: string, amountPaidArs: number, paymentDueAt?: string) {
    try {
      const result = await api<{ sale: SaleRecord }>(`/sales/${id}/payment`, { method: "PUT", body: { amountPaidArs, paymentDueAt } });
      setSales((current) => current.map((sale) => sale.id === result.sale.id ? result.sale : sale));
      showMessage("Pago y fecha de la orden actualizados.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function updateOrderNote(id: string, internalNote: string) {
    try {
      const result = await api<{ sale: SaleRecord }>(`/sales/${id}/note`, { method: "PUT", body: { internalNote } });
      setSales((current) => current.map((sale) => sale.id === result.sale.id ? result.sale : sale));
      showMessage(internalNote.trim() ? "Nota de la orden guardada." : "Nota de la orden eliminada.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function updateOrderMessageSent(id: string, sent: boolean) {
    try {
      const result = await api<{ sale: SaleRecord }>(`/sales/${id}/message-sent`, { method: "PUT", body: { sent } });
      setSales((current) => current.map((sale) => sale.id === result.sale.id ? result.sale : sale));
      showMessage(sent ? "Orden marcada con mensaje enviado." : "Orden marcada sin mensaje enviado.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function updateClaimSettings(patch: { paymentDueAt?: string }) {
    try {
      const result = await api<ClaimsWorkspace>("/claims/settings", { method: "PUT", body: patch });
      setClaims(result);
      showMessage("Configuracion del claim guardada.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function updateOrderLinePacked(saleItemId: string, packed: boolean) {
    const previousSales = sales;
    setSales((current) => current.map((sale) => {
      if (!sale.lines.some((line) => line.saleItemId === saleItemId)) return sale;
      return {
        ...sale,
        status: !packed && sale.status === "packed" ? "pending" : sale.status,
        lines: sale.lines.map((line) => line.saleItemId === saleItemId ? { ...line, packed, packedAt: packed ? (line.packedAt || new Date().toISOString()) : undefined } : line)
      };
    }));
    try {
      const result = await api<{ sale: SaleRecord }>(`/sale-items/${saleItemId}/packed`, { method: "PUT", body: { packed } });
      setSales((current) => current.map((sale) => sale.id === result.sale.id ? result.sale : sale));
    } catch (nextError) {
      setSales(previousSales);
      showError(nextError);
    }
  }

  function addToPurchase(item: StockRow) {
    setPurchaseCart((current) => {
      const existing = current.find((line) => line.inventoryItemId === item.id);
      return existing
        ? current.map((line) => line.inventoryItemId === item.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { inventoryItemId: item.id, quantity: 1, unitCostArs: item.lastPurchaseArs ?? Math.round(item.priceArs * 0.6), name: stockDisplayLabel(item), expansion: item.product.expansion, number: item.product.number, imageUrl: item.product.imageUrl }];
    });
    showMessage(`${item.product.name} agregada a la compra.`);
  }

  async function toggleStockImageReview() {
    if (showStockImageReview) {
      setShowStockImageReview(false);
      setStockImageReview({ items: [], total: 0 });
      return;
    }
    setStockImageReviewLoading(true);
    try {
      const data = await api<{ items: StockImageReviewItem[]; total: number }>("/stock-images/review");
      setStockImageReview(data);
      setShowStockImageReview(true);
    } catch (nextError) {
      showError(nextError);
    } finally {
      setStockImageReviewLoading(false);
    }
  }

  async function toggleImageCatalog() {
    if (showImageCatalog) {
      setShowImageCatalog(false);
      setImageCatalog({ entries: [], total: 0 });
      setImageCatalogFilter("all");
      setImageCatalogSearch("");
      return;
    }
    setImageCatalogLoading(true);
    try {
      const data = await api<{ entries: ImageCatalogEntry[]; total: number }>("/pricecharting-images/catalog");
      setImageCatalog(data);
      setShowImageCatalog(true);
    } catch (nextError) {
      showError(nextError);
    } finally {
      setImageCatalogLoading(false);
    }
  }

  async function submitPurchase() {
    if (purchaseSaving) return;
    setPurchaseSaving(true);
    try {
      const result = await api<{ purchase: PurchaseRecord }>("/purchases", {
        method: "POST",
        body: { sellerName: purchaseSeller, note: purchaseNote, lines: purchaseCart }
      });
      setPurchases((current) => [result.purchase, ...current]);
      showMessage("Compra registrada y unidades ingresadas al inventario.");
      setPurchaseCart([]);
      setPurchaseSeller("");
      setPurchaseNote("");
      void refresh().catch(() => undefined);
    } catch (nextError) {
      showError(nextError);
    } finally {
      setPurchaseSaving(false);
    }
  }

  async function createClaim(name: string) {
    try {
      const result = await api<ClaimsWorkspace>("/claims", { method: "POST", body: { name } });
      setClaims(result);
      showMessage("Claim creado.");
    } catch (nextError) {
      if (errorMessage(nextError).includes("Ya hay un claim activo")) {
        try {
          setClaims(await api<ClaimsWorkspace>("/claims"));
        } catch {
          // Keep the original creation error visible if the recovery fetch also fails.
        }
      }
      showError(nextError);
    }
  }

  async function addClaimCards(priceChartingIds: string[], sectionId = "") {
    try {
      const result = await api<ClaimsWorkspace>("/claims/cards/from-pricecharting", { method: "POST", body: { priceChartingIds, sectionId } });
      setClaims(result);
      showMessage(`${priceChartingIds.length} carta(s) agregada(s) al claim.`);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function updateClaimCard(cardId: string, patch: Partial<Pick<ClaimCard, "sectionId" | "finalPriceArs" | "finalPriceUsd" | "finalName" | "imageUrl" | "buyer" | "quantity" | "tags" | "status">>) {
    try {
      const result = await api<ClaimsWorkspace>(`/claims/cards/${cardId}`, { method: "PUT", body: patch });
      setClaims(result);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function deleteClaimCard(cardId: string) {
    try {
      const result = await api<ClaimsWorkspace>(`/claims/cards/${cardId}`, { method: "DELETE" });
      setClaims(result);
      showMessage("Carta eliminada del claim.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function createClaimSection(name: string) {
    try {
      const result = await api<ClaimsWorkspace>("/claims/sections", { method: "POST", body: { name } });
      setClaims(result);
      showMessage("Seccion creada.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function updateClaimSection(sectionId: string, patch: { name?: string; direction?: "up" | "down" }) {
    try {
      const result = await api<ClaimsWorkspace>(`/claims/sections/${sectionId}`, { method: "PUT", body: patch });
      setClaims(result);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function deleteClaimSection(sectionId: string) {
    try {
      const result = await api<ClaimsWorkspace>(`/claims/sections/${sectionId}`, { method: "DELETE" });
      setClaims(result);
      showMessage("Seccion eliminada. Sus cartas quedaron sin seccion.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function addClaimFree(input: Partial<ClaimFree> & { quantity: number }) {
    try {
      const result = await api<ClaimsWorkspace>("/claims/frees", { method: "POST", body: input });
      setClaims(result);
      showMessage("Free agregado al claim.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function closeClaim() {
    try {
      const result = await api<ClaimsWorkspace>("/claims/close", { method: "POST" });
      setClaims(result);
      showMessage("Claim cerrado. Las ordenes quedaron pendientes en Ordenes.");
      await refresh();
      setView("orders");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function exportClaimOrdersPreview() {
    try {
      const preview = await api<ClaimOrderPreview>("/claims/orders/preview");
      exportClaimOrdersPreviewCsv(preview);
      showMessage(`Ordenes previstas exportadas: ${preview.totals.buyers} compradores, ${preview.totals.units} unidades.`);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function archiveClaim() {
    if (!window.confirm("Cancelar este claim activo? No se crean ordenes y queda archivado en el historial.")) return;
    try {
      const result = await api<ClaimsWorkspace>("/claims/archive", { method: "POST" });
      setClaims(result);
      showMessage("Claim cancelado y archivado.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function generateClaimGrid() {
    try {
      const files = await generateClaimGridImages(claims);
      showMessage(files === 1 ? "Grilla 5x6 descargada." : `${files} grillas 5x6 descargadas.`);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function searchClaimImages() {
    setClaimImageSearching(true);
    try {
      const result = await api<{
        queued: number;
        missing?: number;
        batchSize?: number;
        processed: number;
        urlFound?: number;
        downloaded?: number;
        skipped?: number;
        failed: number;
        rateLimited?: boolean;
        cooldownUntil?: string;
        items?: ImageBatchResult["items"];
        workspace: ClaimsWorkspace;
        status: PriceChartingImageCacheStatus;
      }>("/claims/images/search", { method: "POST", body: { batchSize: Math.max(1, claims.summary.missingImages) } });
      setClaims(result.workspace);
      setPriceChartingImages(result.status);
      setPriceChartingImageLastBatch({
        mode: "external-index",
        includeAll: false,
        processed: result.processed,
        urlFound: result.urlFound || 0,
        downloaded: result.downloaded || 0,
        skipped: result.skipped || 0,
        failed: result.failed,
        completedAt: new Date().toISOString(),
        items: result.items || []
      });
      if (result.rateLimited) {
        showMessage(`Claim: ${result.missing ?? claims.summary.missingImages} sin imagen revisadas. ${result.urlFound || 0} URL(s), ${result.downloaded || 0} guardadas. PriceCharting pidio pausa hasta ${result.cooldownUntil ? formatShortDate(result.cooldownUntil) : "mas tarde"}.`);
      } else {
        showMessage(`Claim: ${result.missing ?? claims.summary.missingImages} sin imagen revisadas. ${result.urlFound || 0} URL(s), ${result.downloaded || 0} guardadas, ${result.failed || 0} fallidas.`);
      }
    } catch (nextError) {
      showError(nextError);
    } finally {
      setClaimImageSearching(false);
    }
  }

  async function searchClaimCardImage(cardId: string) {
    setClaimCardImageSearching(cardId);
    try {
      const result = await api<{
        ok: boolean;
        downloaded: number;
        failed: number;
        item?: { priceChartingId: string; status: "downloaded" | "failed"; source?: string; error?: string };
        workspace: ClaimsWorkspace;
        status: PriceChartingImageCacheStatus;
      }>(`/claims/cards/${cardId}/image/search`, { method: "POST" });
      setClaims(result.workspace);
      setPriceChartingImages(result.status);
      if (result.downloaded > 0) {
        showMessage(`Imagen guardada desde ${result.item?.source || "PriceCharting"}.`);
      } else {
        showError(new Error(result.item?.error || "No se pudo encontrar imagen para esta carta."));
      }
    } catch (nextError) {
      showError(nextError);
    } finally {
      setClaimCardImageSearching("");
    }
  }

  async function refreshClaimPrices() {
    setClaimPriceRefreshing(true);
    try {
      const cacheResult = await api<{ status: PriceChartingCacheStatus }>("/pricecharting-cache/refresh", { method: "POST" });
      const result = await api<{ workspace: ClaimsWorkspace; updated: number; unchanged: number; missing: number }>("/claims/prices/refresh", { method: "POST" });
      setClaims(result.workspace);
      await searchPriceChartingCache("");
      showMessage(`Precios del claim actualizados: ${result.updated} carta(s). Sin cambios: ${result.unchanged}. Sin cache: ${result.missing}. Cache: ${cacheResult.status.totalEntries.toLocaleString("es-AR")} cartas.`);
    } catch (nextError) {
      showError(nextError);
    } finally {
      setClaimPriceRefreshing(false);
    }
  }

  async function searchPriceChartingCache(search: string, nextLanguageGroup: LanguageGroupFilter = catalogLanguageGroup) {
    try {
      const result = await api<{ entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus }>(`/pricecharting-cache?query=${encodeURIComponent(search)}&languageGroup=${encodeURIComponent(nextLanguageGroup)}&limit=60`);
      setPriceChartingCache(result);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function searchCardIndex(search: string, filter: CardIndexFilter = "all", nextLanguageGroup: LanguageGroupFilter = catalogLanguageGroup) {
    try {
      const result = await api<{ entries: CardIndexEntry[]; status: CardIndexStatus }>(`/card-index?query=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&languageGroup=${encodeURIComponent(nextLanguageGroup)}&limit=120`);
      setCardIndexEntries(result.entries);
      setCardIndexStatus(result.status);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function reviewCardIndex(cardIndexId: string, input: {
    action: "approve" | "reject" | "manual";
    tcgplayerProductId?: string;
    tcgplayerUrl?: string;
    imageUrl?: string;
    note?: string;
  }) {
    try {
      const result = await api<{ entry: CardIndexEntry }>(`/card-index/${cardIndexId}/review`, { method: "PUT", body: input });
      setCardIndexEntries((current) => current.map((entry) => entry.id === cardIndexId ? result.entry : entry));
      showMessage(input.action === "approve" ? "Match aprobado." : input.action === "reject" ? "Match marcado como incorrecto." : "Match manual guardado.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function approveCardIndexByConfidence(minimumConfidence: number, search: string, filter: CardIndexFilter) {
    try {
      const result = await api<{ approved: number; status: CardIndexStatus }>("/card-index/approve-by-confidence", {
        method: "POST",
        body: { minimumConfidence }
      });
      setCardIndexStatus(result.status);
      showMessage(`Aprobados automaticamente: ${result.approved.toLocaleString("es-AR")} matches con ${minimumConfidence}% o mas.`);
      await searchCardIndex(search, filter);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function syncPriceChartingCache() {
    setPriceChartingSyncing(true);
    try {
      const result = await api<{ status: PriceChartingCacheStatus }>("/pricecharting-cache/refresh", { method: "POST" });
      showMessage(`Cache actualizado: ${result.status.totalEntries.toLocaleString("es-AR")} cartas disponibles.`);
      setCardIndexRebuildAfterId("");
      await searchPriceChartingCache("");
      await searchCardIndex("");
    } catch (nextError) {
      showError(nextError);
    } finally {
      setPriceChartingSyncing(false);
    }
  }

  async function syncTcgplayerPriceCache() {
    setTcgplayerPriceSyncing(true);
    try {
      const result = await api<{ status: TcgplayerPriceCacheStatus }>("/tcgplayer-prices/refresh", { method: "POST", body: { force: true } });
      setTcgplayerPrices(result.status);
      setTcgplayerPriceAutoRefresh(await api<TcgplayerPriceAutoRefreshStatus>("/tcgplayer-prices/auto-refresh/status").catch(() => emptyTcgplayerPriceAutoRefreshStatus()));
      showMessage(`Precios TCGplayer actualizados: ${result.status.totalEntries.toLocaleString("es-AR")} filas, ${result.status.linkedProductEntries.toLocaleString("es-AR")} productos cruzados.`);
    } catch (nextError) {
      showError(nextError);
    } finally {
      setTcgplayerPriceSyncing(false);
    }
  }

  async function rebuildCardIndex() {
    setCardIndexSyncing(true);
    try {
      const result = await api<CardIndexPriceChartingBatchResult>("/card-index/rebuild-pricecharting-batch", {
        method: "POST",
        body: { afterId: cardIndexRebuildAfterId, limit: 2000 }
      });
      setCardIndexStatus(result.status);
      setCardIndexRebuildAfterId(result.nextAfterId || "");
      await searchCardIndex("");
      showMessage(
        result.complete
          ? `Indice maestro completo: ${result.status.totalEntries.toLocaleString("es-AR")} cartas.`
          : `Indice maestro: ${result.processed.toLocaleString("es-AR")} procesadas en esta tanda.`
      );
    } catch (nextError) {
      showError(nextError);
    } finally {
      setCardIndexSyncing(false);
    }
  }

  async function syncCardIndexTcgCsv() {
    setCardIndexSyncing(true);
    try {
      const result = await api<CardIndexTcgCsvBatchResult>("/card-index/sync-tcgcsv", {
        method: "POST",
        body: { groupOffset: cardIndexNextGroupOffset || 0, groupLimit: 5 }
      });
      setCardIndexStatus(result.status);
      setCardIndexNextGroupOffset(result.nextGroupOffset);
      showMessage(
        result.complete
          ? `TCGCSV completo: ${result.rowsMatched.toLocaleString("es-AR")} fuertes, ${result.rowsWeak.toLocaleString("es-AR")} debiles, ${result.rowsConflict.toLocaleString("es-AR")} conflictos.`
          : `TCGCSV tanda ${result.groupOffset + 1}-${result.groupOffset + result.groupsProcessed}/${result.totalGroups}: ${result.rowsMatched.toLocaleString("es-AR")} fuertes, ${result.rowsWeak.toLocaleString("es-AR")} debiles.`
      );
      await searchCardIndex("");
    } catch (nextError) {
      showError(nextError);
    } finally {
      setCardIndexSyncing(false);
    }
  }

  async function processPriceChartingImages(includeAll: boolean, mode: ImageResolverMode = "external-index") {
    setPriceChartingImageProcessing(true);
    try {
      const endpoint = mode === "external-index" ? "/pricecharting-images/external-index" : "/pricecharting-images/process";
      const result = await api<{ processed: number; urlFound?: number; downloaded?: number; skipped?: number; failed: number; mode?: ImageResolverMode; rateLimited?: boolean; cooldownUntil?: string; items?: ImageBatchResult["items"]; status: PriceChartingImageCacheStatus }>(endpoint, {
        method: "POST",
        body: mode === "external-index"
          ? { includeAll, batchSize: includeAll ? 1000 : 300 }
          : {
            includeAll,
            mode,
            onlyWithSourceImageUrl: mode === "auto",
            batchSize: mode === "pokemon-tcg" ? 60 : mode === "auto" ? 100 : includeAll ? 40 : 20,
            concurrency: mode === "pokemon-tcg" ? 5 : includeAll ? 4 : 3
          }
      });
      const batchResult: ImageBatchResult = {
        mode: result.mode || mode,
        includeAll,
        processed: result.processed,
        urlFound: result.urlFound || 0,
        downloaded: result.downloaded || 0,
        skipped: result.skipped || 0,
        failed: result.failed,
        rateLimited: result.rateLimited,
        cooldownUntil: result.cooldownUntil,
        completedAt: new Date().toISOString(),
        items: result.items || []
      };
      setPriceChartingImageLastBatch(batchResult);
      setPriceChartingImages(result.status);
      const nextCache = await api<{ entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus }>("/pricecharting-cache?limit=30").catch(() => priceChartingCache);
      setPriceChartingCache(nextCache);
      await searchCardIndex("");
      if (result.rateLimited) {
        setPriceChartingImageResumeAt(result.cooldownUntil || new Date(Date.now() + 10 * 60 * 1000).toISOString());
        showMessage(`PriceCharting pidio pausa. La app reintenta sola despues de ${result.cooldownUntil ? formatShortDate(result.cooldownUntil) : "unos minutos"}.`);
      } else if (result.processed === 0 && includeAll) {
        setPriceChartingImageBackfillRunning(false);
        showMessage("No hay imagenes pendientes listas para procesar ahora.");
      } else if (mode === "external-index") {
        showMessage(`URLs masivas: ${result.urlFound || 0} encontradas, ${result.skipped || 0} sin match fuerte en esta tanda.`);
      } else {
        showMessage(`Imagenes${mode === "pokemon-tcg" ? " Pokemon TCG" : ""}: ${result.downloaded || 0} guardadas, ${result.failed} fallidas en esta tanda.`);
      }
    } catch (nextError) {
      setPriceChartingImageBackfillRunning(false);
      showError(nextError);
    } finally {
      setPriceChartingImageProcessing(false);
    }
  }

  async function reindexLocalPriceChartingImages() {
    setPriceChartingImageProcessing(true);
    try {
      const result = await api<{ indexed: number; skipped: number; scanned: number; status: PriceChartingImageCacheStatus }>("/pricecharting-images/reindex-local", {
        method: "POST",
        body: { limit: 1000 }
      });
      setPriceChartingImages(result.status);
      await searchCardIndex("");
      showMessage(`Imagenes locales: ${result.indexed.toLocaleString("es-AR")} reindexadas, ${result.skipped.toLocaleString("es-AR")} ya estaban listas.`);
    } catch (nextError) {
      showError(nextError);
    } finally {
      setPriceChartingImageProcessing(false);
    }
  }

  async function previewSnapshot(nextCsvText = csvText) {
    if (importRequest.current) return;
    try {
      const result = await api<{ rows: SnapshotPreviewRow[] }>("/imports/snapshot/preview", {
        method: "POST",
        body: { csvText: nextCsvText }
      });
      setCsvText(nextCsvText);
      setPreviewRows(result.rows);
      setImportResolutions({});
      showMessage("Vista previa generada. Revisala antes de aplicar.");
    } catch (nextError) {
      showError(nextError);
    }
  }

  const importRequest = useRef(false);
  const [importApplying, setImportApplying] = useState(false);
  const [importFeedback, setImportFeedback] = useState("");
  const mobileRequest = useRef(false);
  const [mobileApplying, setMobileApplying] = useState(false);
  const [mobileFeedback, setMobileFeedback] = useState("");
  async function applySnapshot() {
    if (importRequest.current) return;
    importRequest.current = true;
    setImportApplying(true);
    setImportFeedback("Procesando el lote. Espera la confirmacion.");
    try {
      const result = await api<{ applied: number; skipped: number; alreadyApplied?: boolean }>("/imports/snapshot/apply", {
        method: "POST",
        body: {
          csvText,
          confirm: true,
          batchName: importBatch.name,
          defaultLocation: importBatch.defaultLocation,
          defaultInventoryStatus: importBatch.defaultInventoryStatus,
          note: importBatch.note,
          resolutions: Object.entries(importResolutions).map(([rowNumber, resolution]) => ({ rowNumber: Number(rowNumber), ...resolution }))
        }
      });
      setPreviewRows([]);
      setCsvText("");
      setImportResolutions({});
      setImportBatch(defaultImportBatch());
      removeLocalStorage(importDraftStorageKey);
      const receipt = `${result.alreadyApplied ? "Este lote ya estaba cargado" : "Lote cargado"}: ${result.applied} fila(s), ${result.skipped} omitida(s).`;
      setImportFeedback(receipt);
      showMessage(receipt);
      await refresh().catch(() => undefined);
    } catch (nextError) {
      setImportFeedback(errorMessage(nextError));
      showError(nextError);
    } finally { importRequest.current = false; setImportApplying(false); }
  }

  async function searchMobileInventory(query: string) {
    return api<{ candidates: MobileInventoryCandidate[] }>(`/mobile-intake/search?q=${encodeURIComponent(query)}&limit=12`);
  }

  async function saveMobileInventoryEntry(input: Partial<MobileInventoryEntry>) {
    const result = await api<{ entry: MobileInventoryEntry }>("/mobile-intake/entries", {
      method: "POST",
      body: input
    });
    setMobileEntries((current) => [result.entry, ...current]);
    showMessage(`Pre-base: ${result.entry.name} guardada por ${result.entry.helperName || "ayudante"}.`);
    return result.entry;
  }

  async function setMobileInventoryEntryStatus(id: string, status: MobileInventoryEntry["status"]) {
    const result = await api<{ entry: MobileInventoryEntry }>(`/mobile-intake/entries/${id}/status`, {
      method: "PUT",
      body: { status }
    });
    setMobileEntries((current) => current.map((entry) => entry.id === id ? result.entry : entry));
    showMessage(status === "pending" ? "Entrada devuelta a pendientes." : status === "reviewed" ? "Entrada marcada como revisada." : "Entrada rechazada.");
  }

  async function applyMobileInventoryEntries(ids?: string[]) {
    if (mobileRequest.current) return;
    const idSet = new Set(ids || []);
    const selectedPending = mobileEntries.filter((entry) => entry.status === "pending" && (!idSet.size || idSet.has(entry.id)));
    if (!selectedPending.length) {
      showError(new Error("No hay capturas pendientes para cargar."));
      return;
    }
    mobileRequest.current = true;
    setMobileApplying(true);
    setMobileFeedback("Cargando al inventario...");
    try {
      const response = await api<{ result: MobileInventoryApplyResult }>("/mobile-intake/apply", {
        method: "POST",
        body: { ids: selectedPending.map((entry) => entry.id) }
      });
      const { result } = response;
      const failedIds = new Set(result.errors.map((entry) => entry.id));
      const completedIds = new Set(selectedPending.filter((entry) => !failedIds.has(entry.id)).map((entry) => entry.id));
      setMobileEntries((current) => current.map((entry) => completedIds.has(entry.id) ? { ...entry, status: "reviewed" } : entry));
      setMobileFeedback(result.appliedEntries ? `Cargado: ${result.unitsApplied} unidad(es), ${result.appliedEntries} captura(s).` : "Las capturas seleccionadas ya no estan pendientes. Se actualizo la lista.");
      if (result.errors.length) {
        showError(new Error(`Se cargaron ${result.appliedEntries} captura(s), pero ${result.errors.length} quedaron pendientes por error.`));
      } else {
        showMessage(`Inventario cargado: ${result.unitsApplied} unidad(es) en ${result.appliedGroups} carta(s).`);
      }
      await refresh().catch(() => undefined);
    } catch (nextError) {
      setMobileFeedback(errorMessage(nextError));
      showError(nextError);
    } finally { mobileRequest.current = false; setMobileApplying(false); }
  }

  async function deleteMobileInventoryEntry(id: string) {
    const result = await api<{ deleted: boolean }>(`/mobile-intake/entries/${id}`, { method: "DELETE" });
    if (!result.deleted) throw new Error("No se pudo borrar la entrada movil.");
    setMobileEntries((current) => current.filter((entry) => entry.id !== id));
    showMessage("Ultima captura borrada de la pre-base.");
  }

  async function loadMobileStagingIntoImport() {
    const pending = mobileEntries.filter((entry) => entry.status === "pending");
    if (!pending.length) {
      showError(new Error("No hay capturas moviles pendientes para revisar."));
      return;
    }
    const csv = mobileEntriesToSnapshotCsv(pending);
    const batch = {
      ...importBatch,
      name: importBatch.name || `Pre-base movil ${new Date().toLocaleDateString("es-AR")}`,
      note: importBatch.note || `Capturas moviles: ${pending.length} fila(s)`
    };
    setImportBatch(batch);
    setCsvText(csv);
    setView("import");
    await previewSnapshot(csv);
  }

  async function loadExamples() {
    if (!environment.allowExamples) {
      showError(new Error("Este perfil es PILOTO REAL: no carga ejemplos."));
      return;
    }
    try {
      const result = await api<{ created: number; skipped: number }>("/examples/inventory", { method: "POST" });
      showMessage(`Ejemplos cargados: ${result.created} creados, ${result.skipped} ya existian.`);
      await refresh();
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function restorePilotStockFromManifest() {
    if (stockRestoring) return;
    setStockRestoring(true);
    try {
      const dryRun = await api<{ preview: { manifestRows: number; manifestUnits: number; manifestReservedUnits: number; matchedRows: number; currentUnits: number; currentReservedUnits: number } }>("/inventory/restore-pilot-stock", {
        method: "POST",
        body: {}
      });
      const confirmation = window.prompt(`Se van a restaurar ${dryRun.preview.manifestUnits} unidades (${dryRun.preview.manifestReservedUnits} reservadas) en ${dryRun.preview.matchedRows}/${dryRun.preview.manifestRows} SKUs. Escribi RESTAURAR STOCK PILOTO para aplicar.`);
      if (confirmation !== "RESTAURAR STOCK PILOTO") {
        showError(new Error("Restauracion cancelada."));
        return;
      }
      const result = await api<{ result: { updatedRows: number; totalUnits: number; reservedUnits: number } }>("/inventory/restore-pilot-stock", {
        method: "POST",
        body: { apply: true, confirmation }
      });
      showMessage(`Stock restaurado: ${result.result.updatedRows} SKUs, ${result.result.totalUnits} unidades, ${result.result.reservedUnits} reservadas.`);
      await refresh();
    } catch (nextError) {
      showError(nextError);
    } finally {
      setStockRestoring(false);
    }
  }

  const activeReservations = sales.filter((sale) => sale.saleType === "reservation" && sale.status !== "cancelled" && sale.status !== "delivered");
  const paidSales = sales.filter((sale) => sale.status === "paid" || sale.status === "delivered");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const pendingDebtArs = activeReservations.reduce((sum, sale) => sum + Math.max(0, sale.totalArs - (sale.amountPaidArs || 0)), 0);
  const overdueDebtCount = activeReservations.filter((sale) => sale.paymentDueAt && new Date(sale.paymentDueAt) < todayStart && (sale.amountPaidArs || 0) < sale.totalArs).length;
  const ordersWithoutMessage = activeReservations.filter((sale) => !sale.messageSentAt).length;
  const ordersToDeliver = activeReservations.filter((sale) => sale.status === "paid").length;
  const collectedTodayArs = paidSales
    .filter((sale) => new Date(sale.completedAt || sale.createdAt).getTime() >= todayStart.getTime())
    .reduce((sum, sale) => sum + (sale.amountPaidArs || sale.totalArs), 0);
  const openPurchaseArs = purchases.filter((purchase) => purchase.status !== "cancelled").reduce((sum, purchase) => sum + purchase.totalArs, 0);
  const startQuickOrder = (mode: "sale" | "reservation") => {
    setCartMode(mode);
    setSaleChannel("mostrador");
    setQuery("");
    setExpansion("all");
    setLanguage("all");
    setCondition("all");
    setLocationFilter("all");
    setBatchFilter("all");
    setInventoryStatusFilter("all");
    setAvailability("available");
    setInventoryPriceSource("sale");
    setSortMode("name");
    setIssue("all");
    setView("inventory");
    setCartFocusNonce((value) => value + 1);
    showMessage(mode === "reservation" ? "Orden suelta lista: agrega cartas y crea la reserva." : "Venta directa lista: agrega cartas y confirma el cobro.");
  };

  if (!initialLoadComplete && !accessRequired) return <BootScreen />;

  if (accessRequired) {
    return (
      <AccessGate
        value={accessKeyDraft}
        error={error}
        checking={accessChecking}
        onChange={setAccessKeyDraft}
        onSubmit={submitAccess}
      />
    );
  }

  return (
    <main className={`shell ${view === "mobile-intake" ? "mobile-mode" : ""}`}>
      <header className="app-header">
        <div className="brand-lockup">
          <img className="brand-mark" src="/brand/ultimo-turno-logo.jpeg" alt="UltimoTurno" />
          <div>
            <h1>UltimoTurno</h1>
            <p className="subtitle">Inventario operativo {userName ? `- ${userName}` : ""}</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="header-badges">
            <span className={`profile-badge ${environment.allowExamples ? "examples" : "pilot"}`}>{environment.dataProfile}</span>
            <span className={`profile-badge blue-rate-badge ${blueRate.fallback ? "fallback" : ""}`}>Blue {formatArs(blueRate.sell)}</span>
          </div>
          <button className="secondary-action header-refresh" onClick={() => void refresh()}><Icon name="refresh" />Actualizar</button>
        </div>
      </header>

      <nav className="nav" aria-label="Navegacion principal">
        <NavButton icon="home" active={view === "dashboard"} onClick={() => setView("dashboard")}>Inicio</NavButton>
        <NavButton icon="inventory" active={view === "inventory"} onClick={() => setView("inventory")}>Inventario</NavButton>
        <NavButton icon="orders" active={view === "orders"} onClick={() => setView("orders")}>Ordenes</NavButton>
        <NavButton icon="sales" active={view === "sales"} onClick={() => setView("sales")}>Caja</NavButton>
        <NavButton icon="claims" active={view === "claims"} onClick={() => setView("claims")}>Claims</NavButton>
        <details className="more-nav">
          <summary>Mas</summary>
          <div>
            <NavButton icon="purchases" active={view === "purchases"} onClick={() => setView("purchases")}>Compras</NavButton>
            <NavButton icon="play" active={view === "claim-live"} onClick={() => setView("claim-live")}>Claim en vivo</NavButton>
            <NavButton icon="import" active={view === "import"} onClick={() => setView("import")}>Importar</NavButton>
            <NavButton icon="cart" active={view === "mobile-intake"} onClick={() => setView("mobile-intake")}>Carga movil</NavButton>
            <NavButton icon="palette" active={view === "catalog"} onClick={() => setView("catalog")}>Calidad</NavButton>
            <NavButton icon="activity" active={view === "movements"} onClick={() => setView("movements")}>Movimientos</NavButton>
            <NavButton icon="settings" active={view === "admin"} onClick={() => setView("admin")}>Admin</NavButton>
          </div>
        </details>
      </nav>

      <OperationsDock
        collectedTodayArs={collectedTodayArs}
        pendingDebtArs={pendingDebtArs}
        overdueDebtCount={overdueDebtCount}
        ordersWithoutMessage={ordersWithoutMessage}
        ordersToDeliver={ordersToDeliver}
        openPurchaseArs={openPurchaseArs}
        activeOrderCount={activeReservations.length}
        cartCount={cart.length}
        onNewSale={() => startQuickOrder("sale")}
        onNewOrder={() => startQuickOrder("reservation")}
        onGoOrders={() => setView("orders")}
        onGoCash={() => setView("sales")}
      />

      <div className="toast-stack" aria-live="polite">
        {message ? <div className="feedback ok"><span>{message}</span><button aria-label="Cerrar mensaje" onClick={() => setMessage("")}><Icon name="close" /></button></div> : null}
        {error ? <div className="feedback error"><span>{error}</span><button aria-label="Cerrar error" onClick={() => setError("")}><Icon name="close" /></button></div> : null}
      </div>

      {view === "dashboard" ? (
        <Dashboard
          summary={stock.summary}
          items={stock.items}
          movements={movements}
          audit={audit}
          sales={sales}
          quality={quality}
          pendingReview={previewRows.filter((row) => row.action === "invalid" || row.action === "review").length}
          onCreate={startCreate}
          onImport={() => setView("import")}
          onLoadExamples={environment.allowExamples ? loadExamples : undefined}
          onRestorePilotStock={!environment.allowExamples && stock.items.length > 0 && stock.summary.totalUnits === 0 ? restorePilotStockFromManifest : undefined}
          stockRestoring={stockRestoring}
          onQuickOrder={() => startQuickOrder("reservation")}
          onGoInventory={() => setView("inventory")}
          onGoOrders={() => setView("orders")}
          onGoSales={() => setView("sales")}
          onOpenInventoryIssue={(nextIssue) => {
            setQuery("");
            setExpansion("all");
            setLanguage("all");
            setLanguageGroup("all");
            setCondition("all");
            setLocationFilter("all");
            setBatchFilter("all");
            setInventoryStatusFilter("all");
            setAvailability("all");
            setInventoryPriceSource("sale");
            setSortMode("name");
            setIssue(nextIssue);
            setView("inventory");
          }}
          onSelectItem={(item) => {
            setSelectedId(item.id);
            setView("inventory");
          }}
          blueRate={blueRate}
        />
      ) : null}

      {view === "inventory" ? (
        <InventoryView
          items={visibleItems}
          allItems={stock.items}
          selected={selected}
          selectedMovements={selectedMovements}
          options={options}
          filters={{ query, expansion, language, languageGroup, condition, location: locationFilter, intakeBatch: batchFilter, inventoryStatus: inventoryStatusFilter, tag: tagFilter, availability, priceSource: inventoryPriceSource, sortMode, issue }}
          density={inventoryDensity}
          quality={quality}
          adjustment={adjustment}
          cart={cart}
          cartMode={cartMode}
          customerName={customerName}
          saleChannel={saleChannel}
          cartFocusNonce={cartFocusNonce}
          onFilterChange={(patch) => {
            if (patch.query !== undefined) setQuery(patch.query);
            if (patch.expansion !== undefined) setExpansion(patch.expansion);
            if (patch.language !== undefined) setLanguage(patch.language);
            if (patch.languageGroup !== undefined) setLanguageGroup(patch.languageGroup);
            if (patch.condition !== undefined) setCondition(patch.condition);
            if (patch.location !== undefined) setLocationFilter(patch.location);
            if (patch.intakeBatch !== undefined) setBatchFilter(patch.intakeBatch);
            if (patch.inventoryStatus !== undefined) setInventoryStatusFilter(patch.inventoryStatus);
            if (patch.tag !== undefined) setTagFilter(patch.tag);
            if (patch.availability !== undefined) setAvailability(patch.availability);
            if (patch.priceSource !== undefined) setInventoryPriceSource(patch.priceSource);
            if (patch.sortMode !== undefined) setSortMode(patch.sortMode);
            if (patch.issue !== undefined) setIssue(patch.issue);
          }}
          onClearFilters={() => {
            setQuery("");
            setExpansion("all");
            setLanguage("all");
            setLanguageGroup("all");
            setCondition("all");
            setLocationFilter("all");
            setBatchFilter("all");
            setInventoryStatusFilter("all");
            setTagFilter("all");
            setAvailability("all");
            setInventoryPriceSource("sale");
            setSortMode("name");
            setIssue("all");
          }}
          onDensityChange={setInventoryDensity}
          onBatchUpdate={(items, patch) => void updateInventoryBatch(items, patch)}
          onSelect={(item) => setSelectedId(item.id)}
          onStockSaved={(saved) => {
            setStock((current) => { const items = current.items.map((item) => item.id === saved.id ? saved : item); return { items, summary: summarizeStockRows(items) }; });
          }}
          onRestock={startRestock}
          onEdit={startEdit}
          onCreate={startCreate}
          onAdjustmentChange={setAdjustment}
          onAdjustmentSubmit={saveAdjustment}
          onAvailableQuantitySet={setAvailableQuantity}
          onTagsChange={(item, tags) => void updateInventoryTags(item, tags)}
          onAddToCart={addToCart}
          onCartChange={setCart}
          onCartModeChange={setCartMode}
          onCustomerNameChange={setCustomerName}
          onSaleChannelChange={setSaleChannel}
          onSubmitCart={submitCart}
          blueRate={blueRate}
        />
      ) : null}

      {view === "claims" ? <ClaimsView workspace={claims} priceChartingCache={priceChartingCache} blueRate={blueRate} claimImageSearching={claimImageSearching} claimCardImageSearching={claimCardImageSearching} claimPriceRefreshing={claimPriceRefreshing} onCreateClaim={(name) => void createClaim(name)} onUpdateClaimSettings={(patch) => void updateClaimSettings(patch)} onSearchPriceCharting={(search) => void searchPriceChartingCache(search)} onAddCards={(ids, sectionId) => void addClaimCards(ids, sectionId)} onUpdateCard={(cardId, patch) => void updateClaimCard(cardId, patch)} onDeleteCard={(cardId) => void deleteClaimCard(cardId)} onSearchCardImage={(cardId) => void searchClaimCardImage(cardId)} onCreateSection={(name) => void createClaimSection(name)} onUpdateSection={(sectionId, patch) => void updateClaimSection(sectionId, patch)} onDeleteSection={(sectionId) => void deleteClaimSection(sectionId)} onAddFree={(input) => void addClaimFree(input)} onExportClaimCsv={() => exportClaimWorkspaceCsv(claims)} onExportOrders={() => void exportClaimOrdersPreview()} onGenerateGrid={() => void generateClaimGrid()} onSearchClaimImages={() => void searchClaimImages()} onRefreshClaimPrices={() => void refreshClaimPrices()} onStartLive={() => setView("claim-live")} onCloseClaim={() => void closeClaim()} onArchiveClaim={() => void archiveClaim()} /> : null}
      {view === "claim-live" ? <ClaimLiveView workspace={claims} blueRate={blueRate} onGoClaims={() => setView("claims")} /> : null}
      {view === "orders" ? <OrdersView sales={sales} claims={claims} blueRate={blueRate} onComplete={(id) => updateOrder(id, "complete")} onCancel={(id) => updateOrder(id, "cancel")} onPacked={(id) => updateOrder(id, "packed")} onDelivered={(id) => updateOrder(id, "delivered")} onPayment={updateOrderPayment} onNote={updateOrderNote} onMessageSent={updateOrderMessageSent} onLinePacked={updateOrderLinePacked} /> : null}
      {view === "sales" ? <SalesView sales={sales} purchases={purchases} items={stock.items} blueRate={blueRate} /> : null}
      {view === "purchases" ? (
        <PurchasesView
          items={stock.items}
          purchases={purchases}
          cart={purchaseCart}
          seller={purchaseSeller}
          note={purchaseNote}
          blueRate={blueRate}
          onAdd={addToPurchase}
          onCartChange={setPurchaseCart}
          onSellerChange={setPurchaseSeller}
          onNoteChange={setPurchaseNote}
          onSubmit={() => void submitPurchase()}
          saving={purchaseSaving}
        />
      ) : null}
      {view === "catalog" ? (
        <CatalogView
          priceChartingCache={priceChartingCache}
          priceChartingImages={priceChartingImages}
          cardIndexStatus={cardIndexStatus}
          cardIndexEntries={cardIndexEntries}
          cardIndexSyncing={cardIndexSyncing}
          priceChartingSyncing={priceChartingSyncing}
          priceChartingImageProcessing={priceChartingImageProcessing}
          priceChartingImageBackfillRunning={priceChartingImageBackfillRunning}
          priceChartingImageResumeAt={priceChartingImageResumeAt}
          priceChartingImageLastBatch={priceChartingImageLastBatch}
          cardIndexRebuildAfterId={cardIndexRebuildAfterId}
          cardIndexNextGroupOffset={cardIndexNextGroupOffset}
          blueRate={blueRate}
          languageGroup={catalogLanguageGroup}
          onLanguageGroupChange={(nextLanguageGroup) => {
            setCatalogLanguageGroup(nextLanguageGroup);
            void searchPriceChartingCache("", nextLanguageGroup);
            void searchCardIndex("", "all", nextLanguageGroup);
          }}
          onPriceChartingSearch={(search) => void searchPriceChartingCache(search)}
          onCardIndexSearch={(search, filter) => void searchCardIndex(search, filter)}
          onCardIndexReview={(cardIndexId, input) => void reviewCardIndex(cardIndexId, input)}
          onCardIndexApproveByConfidence={(minimumConfidence, search, filter) => void approveCardIndexByConfidence(minimumConfidence, search, filter)}
          onPriceChartingSync={() => void syncPriceChartingCache()}
          onCardIndexRebuild={() => void rebuildCardIndex()}
          onCardIndexTcgCsvSync={() => void syncCardIndexTcgCsv()}
          onPriceChartingImageReindexLocal={() => void reindexLocalPriceChartingImages()}
          onPriceChartingImageBatch={(includeAll, mode) => void processPriceChartingImages(includeAll, mode)}
          onPriceChartingBackfillChange={(running) => { setPriceChartingImageBackfillRunning(running); if (!running) setPriceChartingImageResumeAt(""); }}
          showImageReview={showStockImageReview}
          onToggleImageReview={() => void toggleStockImageReview()}
          stockImageReview={stockImageReview}
          stockImageReviewLoading={stockImageReviewLoading}
          showImageCatalog={showImageCatalog}
          onToggleImageCatalog={() => void toggleImageCatalog()}
          imageCatalog={imageCatalog}
          imageCatalogLoading={imageCatalogLoading}
          imageCatalogFilter={imageCatalogFilter}
          onImageCatalogFilterChange={setImageCatalogFilter}
          imageCatalogSearch={imageCatalogSearch}
          onImageCatalogSearchChange={setImageCatalogSearch}
        />
      ) : null}
      {view === "mobile-intake" ? (
        <MobileIntakeView
          applying={mobileApplying}
          feedback={mobileFeedback}
          entries={mobileEntries}
          blueRate={blueRate}
          onSearch={(search) => searchMobileInventory(search)}
          onSave={(input) => saveMobileInventoryEntry(input)}
          onStatus={(id, status) => void setMobileInventoryEntryStatus(id, status)}
          onApplyEntry={(id) => void applyMobileInventoryEntries([id])}
          onApplyPending={() => void applyMobileInventoryEntries()}
          onDelete={(id) => void deleteMobileInventoryEntry(id)}
          onRefresh={() => void refresh()}
          onLoadToImport={() => void loadMobileStagingIntoImport()}
          onExit={() => setView("dashboard")}
        />
      ) : null}
      {view === "admin" ? (
        <AdminView
          environment={environment}
          blueRate={blueRate}
          stockSummary={stock.summary}
          quality={quality}
          priceChartingCache={priceChartingCache}
          priceChartingAutoRefresh={priceChartingAutoRefresh}
          tcgplayerPrices={tcgplayerPrices}
          tcgplayerPriceAutoRefresh={tcgplayerPriceAutoRefresh}
          priceChartingImages={priceChartingImages}
          cardIndexStatus={cardIndexStatus}
          priceChartingSyncing={priceChartingSyncing}
          tcgplayerPriceSyncing={tcgplayerPriceSyncing}
          cardIndexSyncing={cardIndexSyncing}
          priceChartingImageProcessing={priceChartingImageProcessing}
          priceChartingImageBackfillRunning={priceChartingImageBackfillRunning}
          priceChartingImageResumeAt={priceChartingImageResumeAt}
          lastBatch={priceChartingImageLastBatch}
          onRefresh={() => void refresh()}
          onGoImport={() => setView("import")}
          onGoCatalog={() => setView("catalog")}
          onPriceChartingSync={() => void syncPriceChartingCache()}
          onTcgplayerPriceSync={() => void syncTcgplayerPriceCache()}
          onCardIndexRebuild={() => void rebuildCardIndex()}
          onCardIndexTcgCsvSync={() => void syncCardIndexTcgCsv()}
          onPriceChartingImageBatch={(includeAll, mode) => void processPriceChartingImages(includeAll, mode)}
          onPriceChartingBackfillChange={setPriceChartingImageBackfillRunning}
          onResetInventoryStock={() => void resetInventoryStockFromAdmin()}
        />
      ) : null}
      {view === "movements" ? <MovementsView movements={movements} audit={audit} /> : null}
      {view === "import" ? (
        <ImportView applying={importApplying} feedback={importFeedback} csvText={csvText} rows={previewRows} resolutions={importResolutions} importBatch={importBatch} importRuns={importRuns} blueRate={blueRate} onTextChange={(text) => { if (importRequest.current) return; setCsvText(text); setPreviewRows([]); setImportFeedback(""); }} onBatchChange={setImportBatch} onPreview={() => void previewSnapshot()} onPreviewText={(text) => void previewSnapshot(text)} onApply={applySnapshot} onLoadExampleCsv={environment.allowExamples ? () => setCsvText(exampleSnapshotCsv) : undefined} onResolve={(rowNumber, resolution) => setImportResolutions((current) => ({ ...current, [rowNumber]: resolution }))} onResolveMany={(nextResolutions) => setImportResolutions((current) => ({ ...current, ...nextResolutions }))} />
      ) : null}
      {productModalOpen ? (
        <ProductModal
          form={form}
          editing={Boolean(editingId)}
          onChange={setForm}
          receipt={productReceipt}
          onSubmit={saveProduct}
          onClose={closeProductModal}
          blueRate={blueRate}
          saving={productSaving}
          imageForcing={productImageForcing}
          onForceImage={() => void forceProductImage()}
          onForceManualImage={forceProductImageManual}
          priceChartingCache={priceChartingCache}
          allItems={stock.items}
          onSearchPriceCharting={(search) => void searchPriceChartingCache(search)}
        />
      ) : null}
    </main>
  );
}

function Dashboard({
  summary,
  items,
  movements,
  audit,
  sales,
  quality,
  pendingReview,
  onCreate,
  onImport,
  onLoadExamples,
  onRestorePilotStock,
  stockRestoring,
  onQuickOrder,
  onGoInventory,
  onGoOrders,
  onGoSales,
  onOpenInventoryIssue,
  onSelectItem,
  blueRate
}: {
  summary: StockSummary;
  items: StockRow[];
  movements: MovementRow[];
  audit: AuditRow[];
  sales: SaleRecord[];
  quality: StockQualitySummary;
  pendingReview: number;
  onCreate: () => void;
  onImport: () => void;
  onLoadExamples?: () => void;
  onRestorePilotStock?: () => void;
  stockRestoring: boolean;
  onQuickOrder: () => void;
  onGoInventory: () => void;
  onGoOrders: () => void;
  onGoSales: () => void;
  onOpenInventoryIssue: (issue: IssueFilter) => void;
  onSelectItem: (item: StockRow) => void;
  blueRate: BlueExchangeRate;
}) {
  const [featuredMode, setFeaturedMode] = useState<"value" | "recent" | "low" | "missingImage">("value");
  const recentMovements = movements.slice(0, 4);
  const recentAudit = audit.slice(0, 4);
  const paidSales = sales.filter((sale) => sale.status === "paid" || sale.status === "delivered");
  const activeReservations = sales.filter((sale) => sale.saleType === "reservation" && sale.status !== "cancelled" && sale.status !== "delivered");
  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekSales = paidSales.filter((sale) => new Date(sale.completedAt || sale.createdAt).getTime() >= weekStart).reduce((sum, sale) => sum + sale.totalArs, 0);
  const monthSales = paidSales.filter((sale) => new Date(sale.completedAt || sale.createdAt).getTime() >= monthStart.getTime()).reduce((sum, sale) => sum + sale.totalArs, 0);
  const pendingOrders = activeReservations.filter((sale) => sale.status === "pending").length;
  const ordersWithoutMessage = activeReservations.filter((sale) => !sale.messageSentAt).length;
  const readyToDeliver = activeReservations.filter((sale) => sale.status === "paid").length;
  const overdueOrders = activeReservations.filter((sale) => sale.paymentDueAt && new Date(sale.paymentDueAt) < todayStart && (sale.amountPaidArs || 0) < sale.totalArs);
  const pendingDebt = activeReservations.reduce((sum, sale) => sum + Math.max(0, sale.totalArs - (sale.amountPaidArs || 0)), 0);
  const stockItemValueArs = (item: StockRow) => (item.priceArs || toBlueArs(item.priceUsd, blueRate)) * Math.max(1, item.availableQuantity);
  const featuredSets = {
    value: items.filter((item) => item.availableQuantity > 0).sort((left, right) => stockItemValueArs(right) - stockItemValueArs(left)).slice(0, 4),
    recent: items.filter((item) => item.quantityOnHand > 0).sort((left, right) => new Date(right.lastPurchaseAt || 0).getTime() - new Date(left.lastPurchaseAt || 0).getTime()).slice(0, 4),
    low: items.filter((item) => item.availableQuantity <= 1).sort((left, right) => stockItemValueArs(right) - stockItemValueArs(left)).slice(0, 4),
    missingImage: items.filter((item) => !item.product.imageUrl).sort((left, right) => stockItemValueArs(right) - stockItemValueArs(left)).slice(0, 4)
  };
  const featured = featuredSets[featuredMode];
  const featuredLabels = {
    value: "Mayor valor disponible",
    recent: "Ultimas cargadas",
    low: "Stock bajo",
    missingImage: "Sin imagen"
  };

  return (
    <section className="view dashboard-view">
      <div className="metrics">
        <Metric label="SKUs" value={summary.totalSkus} helper="productos/variantes" />
        <Metric label="Unidades" value={summary.totalUnits} helper="stock total" />
        <Metric label="Reservadas" value={summary.reservedUnits} helper="no disponibles" />
        <Metric label="Disponibles" value={summary.availableUnits} helper="listas para vender" />
        <Metric label="Valor stock" value={formatArs(summary.stockValueArs)} helper={`${formatUsd(fromBlueArs(summary.stockValueArs, blueRate))} blue`} />
        <Metric label="Ventas semana" value={formatArs(weekSales)} helper={`${formatUsd(fromBlueArs(weekSales, blueRate))} blue`} />
        <Metric label="Ventas mes" value={formatArs(monthSales)} helper={`${formatUsd(fromBlueArs(monthSales, blueRate))} blue`} />
        <Metric label="Pendientes" value={pendingOrders + pendingReview} helper={`${pendingOrders} ordenes / ${pendingReview} importaciones`} />
      </div>
      <section className="panel business-chart-panel">
        <div className="section-heading">
          <div>
            <h2>Panel diario</h2>
            <p>Atajos para cargar stock, cobrar, entregar y corregir datos que frenan ventas.</p>
          </div>
          <div className="dashboard-actions">
            <button className="primary-action" onClick={onQuickOrder}><Icon name="orders" />Nueva orden</button>
            <button className="primary-action" onClick={onCreate}><Icon name="plus" />Crear producto</button>
            {onLoadExamples ? <button className="secondary-action" onClick={onLoadExamples}>Cargar ejemplos</button> : null}
            {onRestorePilotStock ? <button className="secondary-action warning-action" disabled={stockRestoring} onClick={onRestorePilotStock}><Icon name="refresh" />{stockRestoring ? "Restaurando..." : "Restaurar stock"}</button> : null}
            <button className="secondary-action" onClick={onImport}><Icon name="import" />Importar stock</button>
          </div>
        </div>
        <div className="daily-action-grid">
          <button className="daily-action-card urgent" onClick={onGoOrders}><span>Sin mensaje</span><strong>{ordersWithoutMessage}</strong><small>ordenes para contactar</small></button>
          <button className="daily-action-card ready" onClick={onGoOrders}><span>Para entregar</span><strong>{readyToDeliver}</strong><small>pagadas esperando retiro</small></button>
          <button className="daily-action-card debt" onClick={onGoOrders}><span>Deuda pendiente</span><strong>{formatArs(pendingDebt)}</strong><small>{overdueOrders.length} vencida(s)</small></button>
          <button className="daily-action-card import" onClick={onImport}><span>Carga de stock</span><strong>{pendingReview}</strong><small>filas a revisar/importar</small></button>
        </div>
        <InventoryBar summary={summary} />
        <StockQualityPanel quality={quality} onIssue={onOpenInventoryIssue} />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="section-heading">
            <div>
              <h3>Inventario para revisar</h3>
              <p>{featuredLabels[featuredMode]} con carta completa y criterio operativo.</p>
            </div>
            <button className="secondary-action" onClick={onGoInventory}><Icon name="inventory" />Ver todo</button>
          </div>
          <div className="dashboard-feature-tabs">
            <button className={featuredMode === "value" ? "active" : ""} onClick={() => setFeaturedMode("value")}>Mayor valor</button>
            <button className={featuredMode === "recent" ? "active" : ""} onClick={() => setFeaturedMode("recent")}>Ultimas</button>
            <button className={featuredMode === "low" ? "active" : ""} onClick={() => setFeaturedMode("low")}>Stock bajo</button>
            <button className={featuredMode === "missingImage" ? "active" : ""} onClick={() => setFeaturedMode("missingImage")}>Sin imagen</button>
          </div>
          {featured.length ? (
            <div className="dashboard-card-grid">
              {featured.map((item) => (
                <button className="dashboard-product-card" key={item.id} onClick={() => onSelectItem(item)}>
                  <CardArt src={item.product.imageUrl} alt={item.product.name} label={item.product.name} className="dashboard-card-art" fallbackClassName="dashboard-card-art image-placeholder" />
                  <strong>{item.product.name}</strong>
                  <span>{item.product.expansion} #{item.product.number || "-"}</span>
                  <small>{inventoryVariantLabel(item)}</small>
                  <b>{item.availableQuantity} disp.</b>
                  <MoneyStack ars={item.priceArs} usd={item.priceUsd} blueRate={blueRate} compact />
                </button>
              ))}
            </div>
          ) : <EmptyState title="Sin productos" body="Carga ejemplos, crea un producto o importa un snapshot para empezar." />}
        </div>

        <aside className="panel dashboard-side">
          <div className="section-heading compact-heading"><div><h3>Actividad</h3><p>Ultimos movimientos claros.</p></div><button className="secondary-action" onClick={onGoSales}><Icon name="sales" />Ventas</button></div>
          {recentMovements.length ? recentMovements.map((movement) => (
            <div className="compact-activity-row" key={movement.id}>
              <strong>{movement.itemName || movement.sku}</strong>
              <span>{movementLabel(movement.type)} {formatDelta(movement.quantityDelta)}</span>
            </div>
          )) : <EmptyState title="Sin movimientos" body="Los ajustes y cargas aparecen aca." />}
          <h3>Auditoria</h3>
          {recentAudit.length ? recentAudit.map((row) => (
            <div className="compact-activity-row" key={row.id}>
              <strong>{auditLabel(row.action)}</strong>
              <span>{formatDate(row.createdAt)}</span>
            </div>
          )) : <p className="muted">Sin cambios registrados.</p>}
        </aside>
      </section>
    </section>
  );
}

function OperationsDock({
  collectedTodayArs,
  pendingDebtArs,
  overdueDebtCount,
  ordersWithoutMessage,
  ordersToDeliver,
  openPurchaseArs,
  activeOrderCount,
  cartCount,
  onNewSale,
  onNewOrder,
  onGoOrders,
  onGoCash
}: {
  collectedTodayArs: number;
  pendingDebtArs: number;
  overdueDebtCount: number;
  ordersWithoutMessage: number;
  ordersToDeliver: number;
  openPurchaseArs: number;
  activeOrderCount: number;
  cartCount: number;
  onNewSale: () => void;
  onNewOrder: () => void;
  onGoOrders: () => void;
  onGoCash: () => void;
}) {
  return (
    <section className="operations-dock" aria-label="Acciones operativas">
      <button className="operation-action primary" type="button" onClick={onNewSale}>
        <Icon name="sales" />
        <span>Venta directa</span>
        <strong>{cartCount ? `${cartCount} en carrito` : "Cobrar ahora"}</strong>
      </button>
      <button className="operation-action primary" type="button" onClick={onNewOrder}>
        <Icon name="orders" />
        <span>Nueva orden</span>
        <strong>Sin claim</strong>
      </button>
      <button className="operation-action alert" type="button" onClick={onGoOrders}>
        <Icon name="claims" />
        <span>Ordenes pendientes</span>
        <strong>{activeOrderCount} activas / {ordersWithoutMessage} sin mensaje / {ordersToDeliver} para entregar</strong>
      </button>
      <button className="operation-action cash" type="button" onClick={onGoCash}>
        <Icon name="sales" />
        <span>Caja y deudas</span>
        <strong>{formatArs(collectedTodayArs)} hoy / {formatArs(pendingDebtArs)} a cobrar / {formatArs(openPurchaseArs)} compras</strong>
        {overdueDebtCount ? <em>{overdueDebtCount} vencida(s)</em> : null}
      </button>
    </section>
  );
}

function InventoryBar({ summary }: { summary: StockSummary }) {
  const total = Math.max(1, summary.totalUnits);
  const available = Math.round((summary.availableUnits / total) * 100);
  const reserved = Math.round((summary.reservedUnits / total) * 100);
  return (
    <div className="inventory-bar-panel">
      <div className="inventory-bar">
        <span style={{ width: `${available}%` }} />
        <b style={{ width: `${reserved}%` }} />
      </div>
      <div className="chart-legend">
        <span><b className="stock-dot" />Disponible {available}%</span>
        <span><b className="sales-dot" />Reservado {reserved}%</span>
      </div>
    </div>
  );
}

function CardArt({ src, alt, label, className, fallbackClassName }: { src?: string; alt: string; label: string; className: string; fallbackClassName: string }) {
  const [failed, setFailed] = useState(false);
  const resolved = src ? assetUrl(src) : "";
  useEffect(() => {
    setFailed(false);
  }, [resolved]);
  if (!resolved || failed) return <span className={fallbackClassName}>{label.slice(0, 2).toUpperCase()}</span>;
  return <img className={className} src={resolved} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

function StockQualityPanel({ quality, onIssue }: { quality: StockQualitySummary; onIssue?: (issue: IssueFilter) => void }) {
  const totalIssues = quality.missingImage + quality.missingPriceCharting + quality.zeroPrice + quality.lowStock + quality.duplicates;
  const qualityItems: Array<{ issue: IssueFilter; label: string; value: number; helper: string }> = [
    { issue: "all", label: "Calidad de datos", value: totalIssues, helper: "alertas operativas" },
    { issue: "missingImage", label: "Sin imagen", value: quality.missingImage, helper: "requieren cache" },
    { issue: "missingPriceCharting", label: "Sin PriceCharting", value: quality.missingPriceCharting, helper: "sin identidad externa" },
    { issue: "zeroPrice", label: "Precio cero", value: quality.zeroPrice, helper: "revisar venta" },
    { issue: "lowStock", label: "Stock bajo", value: quality.lowStock, helper: "0 o 1 disponible" },
    { issue: "duplicates", label: "Duplicados", value: quality.duplicates, helper: "misma identidad" }
  ];
  return (
    <div className="quality-panel">
      {qualityItems.map((item) => (
        <button key={item.issue} type="button" onClick={() => onIssue?.(item.issue)}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.helper}</small>
        </button>
      ))}
    </div>
  );
}

function InventorySearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => { React.startTransition(() => changeRef.current(draft)); }, 120);
    return () => window.clearTimeout(timer);
  }, [draft, value]);
  return <label className="inventory-search"><span className="visually-hidden">Buscar en el inventario</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Buscar carta, expansion, numero..." /></label>;
}

function InventoryQuickIntake({ item, onSaved, onClose }: { item: StockRow; onSaved: (item: StockRow) => void; onClose: () => void }) {
  const [quantity, setQuantity] = useState("1");
  const [currency, setCurrency] = useState("ARS");
  const [priceArs, setPriceArs] = useState(String(item.priceArs || ""));
  const [priceUsd, setPriceUsd] = useState(item.priceUsd == null ? "" : String(item.priceUsd));
  const [costOpen, setCostOpen] = useState(false);
  const [cost, setCost] = useState("");
  const [costCurrency, setCostCurrency] = useState(item.purchaseCurrency || "ARS");
  const [saving, setSaving] = useState(false);
  const request = useRef(false);
  const [feedback, setFeedback] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (request.current) return;
    request.current = true;
    setSaving(true);
    setFeedback("");
    try {
      const response = await api<{ item: StockRow }>("/inventory/intake", { method: "POST", body: {
        ...formFromItem(item), quantityOnHand: Number(quantity), quantityReserved: 0,
        priceArs: priceArs === "" ? item.priceArs : Number(priceArs), priceUsd: priceUsd === "" ? item.priceUsd : Number(priceUsd),
        purchaseCost: cost === "" ? undefined : Number(cost), purchaseCurrency: costCurrency
      }});
      onSaved(response.item);
      setFeedback(`Agregadas ${quantity}. Stock actual: ${response.item.quantityOnHand}.`);
      setQuantity("1");
    } catch (error) { setFeedback(errorMessage(error)); }
    finally { request.current = false; setSaving(false); }
  }
  return <form className="inventory-inline-intake" aria-label={`Agregar stock de ${item.product.name}`} onSubmit={save}>
    <div className="inline-intake-fields">
      <label>Cantidad<input autoFocus required type="number" min="1" step="1" disabled={saving} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      <label>Precio de venta<input type="number" min="0" step="0.01" disabled={saving} value={currency === "ARS" ? priceArs : priceUsd} onChange={(event) => currency === "ARS" ? setPriceArs(event.target.value) : setPriceUsd(event.target.value)} placeholder="Sin cambiar" /></label>
      <label>Moneda<select disabled={saving} value={currency} onChange={(event) => setCurrency(event.target.value)}><option>ARS</option><option>USD</option></select></label>
    </div>
    <button className="inline-cost-toggle" type="button" disabled={saving} onClick={() => setCostOpen(!costOpen)}>Costo de compra (opcional)</button>
    {costOpen ? <div className="inline-cost-fields"><label>Costo por unidad<input type="number" min="0" step="0.01" value={cost} disabled={saving} onChange={(event) => setCost(event.target.value)} placeholder="Sin registrar" /></label><label>Moneda del costo<select value={costCurrency} disabled={saving} onChange={(event) => setCostCurrency(event.target.value)}><option>ARS</option><option>USD</option></select></label></div> : null}
    {feedback ? <p role="status" className="inline-intake-feedback">{feedback}</p> : null}
    <div className="inline-intake-actions"><button className="secondary-action" type="button" disabled={saving} onClick={onClose}>Cerrar</button><button className="primary-action" disabled={saving}>{saving ? "Guardando..." : "Guardar stock"}</button></div>
  </form>;
}

function InventoryView(props: {
  items: StockRow[];
  allItems: StockRow[];
  selected?: StockRow;
  selectedMovements: MovementRow[];
  options: { expansions: string[]; languages: string[]; conditions: string[]; locations: string[]; intakeBatches: string[]; inventoryStatuses: string[]; tags: string[] };
  filters: InventoryFilters;
  density: InventoryDensity;
  quality: StockQualitySummary;
  adjustment: { quantityDelta: number; note: string };
  cart: CartLine[];
  cartMode: "sale" | "reservation";
  customerName: string;
  saleChannel: string;
  cartFocusNonce: number;
  onFilterChange: (patch: Partial<InventoryFilters>) => void;
  onClearFilters: () => void;
  onDensityChange: (density: InventoryDensity) => void;
  onBatchUpdate: (items: StockRow[], patch: InventoryBatchPatch) => void;
  onSelect: (item: StockRow) => void;
  onEdit: (item: StockRow) => void;
  onCreate: () => void;
  onRestock: (item: StockRow) => void;
  onStockSaved: (item: StockRow) => void;
  onAdjustmentChange: (adjustment: { quantityDelta: number; note: string }) => void;
  onAdjustmentSubmit: (event: React.FormEvent) => void;
  onAvailableQuantitySet: (item: StockRow, targetAvailable: number) => Promise<void>;
  onTagsChange: (item: StockRow, tags: string) => void;
  onAddToCart: (item: StockRow) => void;
  onCartChange: (cart: CartLine[]) => void;
  onCartModeChange: (mode: "sale" | "reservation") => void;
  onCustomerNameChange: (value: string) => void;
  onSaleChannelChange: (value: string) => void;
  onSubmitCart: () => void;
  blueRate: BlueExchangeRate;
}) {
  const { items, allItems, selected, selectedMovements, options, filters } = props;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sideTab, setSideTab] = useState<"detail" | "cart" | null>(null);
  const [intakeId, setIntakeId] = useState("");
  const [renderLimit, setRenderLimit] = useState(48);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const filterKey = JSON.stringify(filters);
  useEffect(() => { setRenderLimit(48); }, [filterKey]);
  useEffect(() => {
    if (!loadMoreRef.current || renderLimit >= items.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setRenderLimit((limit) => Math.min(items.length, limit + 48));
    }, { rootMargin: "300px" });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [items.length, renderLimit]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setSideTab(null); setIntakeId(""); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const [quickStockOpen, setQuickStockOpen] = useState(false);
  const [quickStockDraft, setQuickStockDraft] = useState("");
  const [quickStockSaving, setQuickStockSaving] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const [batchSelection, setBatchSelection] = useState<string[]>([]);
  const [batchLocation, setBatchLocation] = useState("");
  const [batchIntakeBatch, setBatchIntakeBatch] = useState("");
  const [batchInventoryStatus, setBatchInventoryStatus] = useState("");
  const [batchTags, setBatchTags] = useState("");
  const [batchPriceSource, setBatchPriceSource] = useState<"none" | InventoryPriceSource>("none");
  const activeFilters = [filters.expansion, filters.languageGroup, filters.language, filters.condition, filters.location, filters.intakeBatch, filters.inventoryStatus, filters.tag, filters.availability, filters.issue].filter((value) => value !== "all").length
    + (filters.priceSource !== "sale" ? 1 : 0);
  const availabilityCounts = useMemo(() => ({
    all: allItems.length,
    available: allItems.filter((item) => item.availableQuantity > 0).length,
    reserved: allItems.filter((item) => item.quantityReserved > 0).length,
    out: allItems.filter((item) => item.availableQuantity === 0).length
  }), [allItems]);
  const priceSourceCounts = useMemo(() => ({
    sale: allItems.filter((item) => inventoryPriceDisplay(item, "sale", props.blueRate).hasPrice).length,
    pricecharting: allItems.filter((item) => inventoryPriceDisplay(item, "pricecharting", props.blueRate).hasPrice).length,
    tcgplayer: allItems.filter((item) => inventoryPriceDisplay(item, "tcgplayer", props.blueRate).hasPrice).length,
    coolstuff: allItems.filter((item) => inventoryPriceDisplay(item, "coolstuff", props.blueRate).hasPrice).length
  }), [allItems, props.blueRate]);
  const selectedBatchItems = items.filter((item) => batchSelection.includes(item.id));
  const allVisibleSelected = items.length > 0 && selectedBatchItems.length === items.length;
  const handleSelect = (item: StockRow) => {
    props.onSelect(item);
    setSideTab("detail");
  };
  const handleAdd = (item: StockRow) => {
    props.onAddToCart(item);
    setSideTab("cart");
  };
  const selectedTags = selected ? inventoryTags(selected.tags) : [];
  const suggestedTags = unique([...inventoryTagSuggestions, ...options.tags]);
  const saveSelectedTags = (tags: string) => {
    if (!selected) return;
    props.onTagsChange(selected, tags);
  };
  const addSelectedTag = () => {
    if (!selected || !newTagDraft.trim()) return;
    saveSelectedTags(inventoryTagsText([...selectedTags, ...inventoryTags(newTagDraft)]));
    setNewTagDraft("");
  };
  useEffect(() => {
    if (props.cartFocusNonce > 0) setSideTab("cart");
  }, [props.cartFocusNonce]);
  useEffect(() => {
    setQuickStockOpen(false);
    setQuickStockDraft(selected ? String(selected.availableQuantity) : "");
  }, [selected?.id, selected?.availableQuantity]);
  const quickStockTarget = Math.max(0, Math.floor(Number(quickStockDraft) || 0));
  const quickStockDelta = selected ? quickStockTarget - selected.availableQuantity : 0;
  const submitQuickStock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || quickStockSaving) return;
    setQuickStockSaving(true);
    try {
      await props.onAvailableQuantitySet(selected, quickStockTarget);
      setQuickStockOpen(false);
    } finally {
      setQuickStockSaving(false);
    }
  };
  const toggleBatchItem = (itemId: string) => {
    setBatchSelection((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);
  };
  const applyBatchUpdate = () => {
    const patch: InventoryBatchPatch = {};
    if (batchLocation.trim()) patch.location = batchLocation.trim();
    if (batchIntakeBatch.trim()) patch.intakeBatch = batchIntakeBatch.trim();
    if (batchInventoryStatus) patch.inventoryStatus = batchInventoryStatus;
    if (batchTags.trim()) patch.tags = batchTags.trim();
    if (batchPriceSource !== "none") patch.priceSource = batchPriceSource;
    if (!Object.keys(patch).length) {
      window.alert("Elegí al menos una accion para aplicar al lote.");
      return;
    }
    props.onBatchUpdate(selectedBatchItems, patch);
    setBatchSelection([]);
    setBatchTags("");
  };
  return (
    <section className="view stock-layout">
      <datalist id="inventory-tag-suggestions">
        {inventoryTagSuggestions.map((tag) => <option value={tag} key={tag} />)}
      </datalist>
      <div className="panel inventory-toolbar compact-inventory-toolbar">
        <div className="inventory-command-row">
          <InventorySearchField value={filters.query} onChange={(query) => props.onFilterChange({ query })} />
          <span className="inventory-result-count" title={`${items.length} de ${allItems.length} cartas`}>{items.length}<span> cartas</span></span>
          <label className="sort-control">Ordenar<select value={filters.sortMode} onChange={(event) => props.onFilterChange({ sortMode: event.target.value as SortMode })}><option value="name">Nombre</option><option value="expansion">Expansion</option><option value="number">Numero</option><option value="price">Mayor precio</option><option value="quantity">Mayor cantidad</option></select></label>
          <button className={`secondary-action filter-toggle ${filtersOpen ? "active" : ""}`} aria-expanded={filtersOpen} aria-controls="inventory-filter-options" onClick={() => setFiltersOpen((open) => !open)}><Icon name="filter" />Filtros{activeFilters ? ` (${activeFilters})` : ""}</button>
          <button className="primary-action" onClick={props.onCreate}><Icon name="plus" />Agregar stock</button>
        </div>
        {filtersOpen ? <div id="inventory-filter-options" className="inventory-filter-options">
          <div className="inventory-display-options">
            <div className="density-toggle" aria-label="Densidad de inventario">
              <button className={props.density === "comfortable" ? "active" : ""} type="button" onClick={() => props.onDensityChange("comfortable")}>Grande</button>
              <button className={props.density === "compact" ? "active" : ""} type="button" onClick={() => props.onDensityChange("compact")}>Compacta</button>
            </div>

            <button className="secondary-action" disabled={!items.length} onClick={() => exportInventoryCsv(items)}><Icon name="download" />Exportar vista</button>
          </div>
        <div className="issue-filter-row">
          {([
            ["all", "Todo", allItems.length],
            ["missingImage", "Sin imagen", props.quality.missingImage],
            ["missingPriceCharting", "Sin PriceCharting", props.quality.missingPriceCharting],
            ["zeroPrice", "Precio cero", props.quality.zeroPrice],
            ["lowStock", "Stock bajo", props.quality.lowStock],
            ["duplicates", "Duplicados", props.quality.duplicates]
          ] as const).map(([value, label, count]) => (
            <button className={filters.issue === value ? "active" : ""} key={value} onClick={() => props.onFilterChange({ issue: value })}>{label}<span>{count}</span></button>
          ))}
        </div>
        <div className="availability-filter-row">
          {([
            ["all", "Todo", availabilityCounts.all],
            ["available", "Con stock", availabilityCounts.available],
            ["reserved", "Reservadas", availabilityCounts.reserved],
            ["out", "Sin stock", availabilityCounts.out]
          ] as const).map(([value, label, count]) => (
            <button className={filters.availability === value ? "active" : ""} key={value} onClick={() => props.onFilterChange({ availability: value })}>{label}<span>{count}</span></button>
          ))}
        </div>
        <LanguageGroupSelector value={filters.languageGroup} onChange={(value) => props.onFilterChange({ languageGroup: value })} />
        <div className="price-source-filter-row">
          <span>Precios</span>
          {([
            ["sale", "Venta", priceSourceCounts.sale],
            ["pricecharting", "PriceCharting", priceSourceCounts.pricecharting],
            ["tcgplayer", "TCGplayer", priceSourceCounts.tcgplayer],
            ["coolstuff", "CoolStuff", priceSourceCounts.coolstuff]
          ] as const).map(([value, label, count]) => (
            <button className={filters.priceSource === value ? "active" : ""} key={value} onClick={() => props.onFilterChange({ priceSource: value })}>{label}<small>{count}</small></button>
          ))}
        </div>
        {filtersOpen ? <div className="advanced-filters">
          <label>Expansion<select value={filters.expansion} onChange={(event) => props.onFilterChange({ expansion: event.target.value })}><option value="all">Todas</option>{options.expansions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Idioma<select value={filters.language} onChange={(event) => props.onFilterChange({ language: event.target.value })}><option value="all">Todos</option>{options.languages.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Condicion<select value={filters.condition} onChange={(event) => props.onFilterChange({ condition: event.target.value })}><option value="all">Todas</option>{options.conditions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Lote<select value={filters.intakeBatch} onChange={(event) => props.onFilterChange({ intakeBatch: event.target.value })}><option value="all">Todos</option>{options.intakeBatches.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Ubicacion<select value={filters.location} onChange={(event) => props.onFilterChange({ location: event.target.value })}><option value="all">Todas</option>{options.locations.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Estado<select value={filters.inventoryStatus} onChange={(event) => props.onFilterChange({ inventoryStatus: event.target.value })}><option value="all">Todos</option>{options.inventoryStatuses.map((value) => <option value={value} key={value}>{inventoryStatusLabel(value)}</option>)}</select></label>
          <label>Categoria<select value={filters.tag} onChange={(event) => props.onFilterChange({ tag: event.target.value })}><option value="all">Todas</option>{options.tags.map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
          <label>Disponibilidad<select value={filters.availability} onChange={(event) => props.onFilterChange({ availability: event.target.value as AvailabilityFilter })}><option value="all">Todas</option><option value="available">Con disponible</option><option value="reserved">Con reserva</option><option value="out">Sin disponible</option></select></label>
          <button className="clear-action" onClick={props.onClearFilters}>Limpiar filtros</button>
        </div> : null}
        </div> : null}
      </div>

      <div className="stock-content inventory-workspace inventory-browse-workspace">
        <section className="panel product-list-panel">
          <div className="section-heading">
            <div><h3>Cartas</h3></div><button className="secondary-action" onClick={() => setSideTab("cart")}><Icon name="cart" />Carrito ({props.cart.length})</button>
            <div className="inventory-selection-tools">
              <button className="secondary-action" disabled={!items.length} onClick={() => setBatchSelection(allVisibleSelected ? [] : items.map((item) => item.id))}>
                <Icon name={allVisibleSelected ? "close" : "check"} />{allVisibleSelected ? "Limpiar seleccion" : "Seleccionar vista"}
              </button>
            </div>
          </div>
          {selectedBatchItems.length ? (
            <div className="inventory-batch-bar">
              <strong>{selectedBatchItems.length} seleccionada(s)</strong>
              <input value={batchLocation} onChange={(event) => setBatchLocation(event.target.value)} placeholder="Ubicacion" />
              <input value={batchIntakeBatch} onChange={(event) => setBatchIntakeBatch(event.target.value)} placeholder="Lote" />
              <select value={batchInventoryStatus} onChange={(event) => setBatchInventoryStatus(event.target.value)}>
                <option value="">Estado: sin cambio</option>
                {inventoryStatusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
              <input value={batchTags} onChange={(event) => setBatchTags(event.target.value)} placeholder="Categoria a sumar" list="inventory-tag-suggestions" />
              <select value={batchPriceSource} onChange={(event) => setBatchPriceSource(event.target.value as "none" | InventoryPriceSource)}>
                <option value="none">Precio: sin cambio</option>
                <option value="pricecharting">Usar PriceCharting</option>
                <option value="tcgplayer">Usar TCGplayer</option>
                <option value="coolstuff">Usar CoolStuff</option>
              </select>
              <button className="primary-action" onClick={applyBatchUpdate}><Icon name="check" />Aplicar</button>
            </div>
          ) : null}
          {items.length ? (
            <div className={`inventory-card-grid ${props.density === "compact" ? "compact" : ""}`}>
              {items.slice(0, renderLimit).map((item) => {
                const displayPrice = inventoryPriceDisplay(item, filters.priceSource, props.blueRate);
                return (
                  <article className={`inventory-card ${selected?.id === item.id ? "selected" : ""} ${item.availableQuantity <= 0 ? "sold-out" : ""}`} key={item.id}>
                    <button className="inventory-card-main" onClick={() => setIntakeId(item.id)}>
                      <div className="inventory-card-image-wrap">
                        <CardArt src={item.product.imageUrl} alt={item.product.name} label={item.product.name} className="inventory-card-image" fallbackClassName="inventory-card-image placeholder" />
                        <span className={`inventory-stock-badge ${item.availableQuantity > 0 ? "" : "out-of-stock"}`}>{item.availableQuantity} disp.</span>
                      </div>
                      <div className="inventory-card-body">
                        <strong>{item.product.name}</strong>
                        <span>{item.product.expansion} #{item.product.number || "-"}</span>
                        <small>{inventoryVariantLabel(item)}</small>
                        {inventoryTags(item.tags).length ? <div className="inventory-tag-list compact">{inventoryTags(item.tags).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
                        <div className={`inventory-big-price ${displayPrice.hasPrice ? "" : "missing"}`}>
                          <span>{displayPrice.label}</span>
                          <strong>{displayPrice.hasPrice ? formatArs(displayPrice.ars || 0) : "Sin precio"}</strong>
                          <small>{displayPrice.helper}</small>
                        </div>
                      </div>
                    </button>
                    <div className="inventory-card-actions">
                      <button className="primary-action" onClick={() => setIntakeId(intakeId === item.id ? "" : item.id)}><Icon name="plus" />Stock</button>
                      <button className="secondary-action" onClick={() => handleSelect(item)}>Detalles</button>
                      <button className="secondary-action" aria-label={`Agregar ${item.product.name} al carrito`} disabled={item.availableQuantity <= 0} onClick={() => handleAdd(item)}><Icon name="cart" /></button>
                    </div>
                    {intakeId === item.id ? <InventoryQuickIntake key={item.id} item={item} onSaved={props.onStockSaved} onClose={() => setIntakeId("")} /> : null}
                  </article>
                );
              })}
            </div>
          ) : <EmptyState title="Sin coincidencias" body="Proba otro nombre, expansion o numero, o revisa los filtros." />}
          {renderLimit < items.length ? <div className="inventory-load-more" ref={loadMoreRef}><button className="secondary-action" onClick={() => setRenderLimit((limit) => limit + 48)}>Ver mas cartas ({Math.min(renderLimit, items.length)} de {items.length})</button></div> : null}
        </section>

        {sideTab ? <aside className="workspace-side inventory-detail-drawer" role="dialog" aria-label={sideTab === "detail" ? "Detalles de la carta" : "Carrito"}>
          <button className="secondary-action drawer-close" onClick={() => setSideTab(null)}><Icon name="close" />Cerrar</button>
          <div className="side-tabs" role="tablist" aria-label="Panel de inventario">
            <button className={sideTab === "detail" ? "active" : ""} onClick={() => setSideTab("detail")}>Detalle</button>
            <button className={sideTab === "cart" ? "active" : ""} onClick={() => setSideTab("cart")}>Carrito <span>{props.cart.length}</span></button>
          </div>
          {sideTab === "detail" ? <div className="stock-side">
          <section className="panel detail-panel compact-detail-panel">
            {selected ? (
              <>
                {selected.product.imageUrl ? (
                  <CardArt src={selected.product.imageUrl} alt={selected.product.name} label={selected.product.name} className="detail-image" fallbackClassName="detail-image detail-image-fallback" />
                ) : (
                  <div className="detail-image-missing">
                    <span>{selected.product.name.slice(0, 2).toUpperCase()}</span>
                    <strong>Sin imagen</strong>
                    <button className="secondary-action" onClick={() => props.onEdit(selected)}><Icon name="image" />Cargar imagen</button>
                  </div>
                )}
                <div className="detail-title"><h3>{selected.product.name}</h3><span>{selected.sku}</span></div>
                <section className="inventory-tags-panel">
                  <div className="inventory-tags-head">
                    <strong>Categorias</strong>
                    {selectedTags.length ? <button type="button" className="mini-icon-action" aria-label="Limpiar categorias" title="Limpiar categorias" onClick={() => saveSelectedTags("")}><Icon name="close" /></button> : null}
                  </div>
                  <div className="inventory-tag-list">
                    {suggestedTags.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return <button type="button" className={active ? "active" : ""} key={tag} onClick={() => saveSelectedTags(toggleInventoryTag(selected.tags, tag))}>{tag}</button>;
                    })}
                  </div>
                  <div className="inventory-tag-adder">
                    <input value={newTagDraft} onChange={(event) => setNewTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSelectedTag(); } }} placeholder="Nueva categoria..." list="inventory-tag-suggestions" />
                    <button type="button" className="secondary-action" onClick={addSelectedTag}><Icon name="plus" />Agregar</button>
                  </div>
                </section>
                <dl className="detail-grid">
                  <div><dt>Expansion</dt><dd>{selected.product.expansion}</dd></div>
                  <div><dt>Numero</dt><dd>{selected.product.number || "-"}</dd></div>
                  <div><dt>Idioma</dt><dd>{selected.variant.language}</dd></div>
                  <div><dt>Presentacion</dt><dd>{inventoryPresentationLabel(selected)}</dd></div>
                  <div><dt>Condicion</dt><dd>{selected.variant.gradingCompany ? "No aplica" : selected.variant.condition}</dd></div>
                  {selected.variant.gradingCompany || selected.variant.grade ? <div><dt>Grading</dt><dd>{inventoryGradingLabel(selected)}</dd></div> : null}
                  {selected.variant.gradingCert ? <div><dt>Certificado</dt><dd>{selected.variant.gradingCert}</dd></div> : null}
                  <div><dt>Total</dt><dd>{selected.quantityOnHand}</dd></div>
                  <div><dt>Reservadas</dt><dd>{selected.quantityReserved}</dd></div>
                  <div><dt>Lote</dt><dd>{selected.intakeBatch || "-"}</dd></div>
                  <div><dt>Estado</dt><dd>{inventoryStatusLabel(selected.inventoryStatus)}</dd></div>
                  <div className={`important-number quick-stock-card ${quickStockOpen ? "editing" : ""}`}>
                    <dt><span>Disponible</span><button type="button" className="mini-icon-action" aria-label="Editar disponible" title="Editar disponible" onClick={() => { setQuickStockDraft(String(selected.availableQuantity)); setQuickStockOpen((open) => !open); }}><Icon name="edit" /></button></dt>
                    <dd>{selected.availableQuantity}</dd>
                    {quickStockOpen ? (
                      <form className="quick-stock-editor" onSubmit={submitQuickStock}>
                        <label>Nuevo disponible<input type="number" min={0} autoFocus value={quickStockDraft} onChange={(event) => setQuickStockDraft(event.target.value)} /></label>
                        <small>{quickStockDelta === 0 ? "Sin cambios" : `Ajuste ${formatDelta(quickStockDelta)} / total ${selected.quantityReserved + quickStockTarget}`}</small>
                        <div>
                          <button type="button" className="secondary-action" disabled={quickStockSaving} onClick={() => setQuickStockOpen(false)}><Icon name="close" />Cancelar</button>
                          <button className="primary-action" disabled={quickStockSaving || quickStockDelta === 0}><Icon name="check" />Guardar</button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                  <div><dt>Precio venta</dt><dd><MoneyStack ars={selected.priceArs} usd={selected.priceUsd} blueRate={props.blueRate} /></dd></div>
                  <div><dt>Costo registrado por unidad</dt><dd>{selected.purchaseCost != null ? (selected.purchaseCurrency === "USD" ? formatUsd(selected.purchaseCost) : formatArs(selected.purchaseCost)) : "Sin registrar"}</dd></div>
                  <div><dt>Ultima compra</dt><dd>{selected.lastPurchaseArs ? <><MoneyStack ars={selected.lastPurchaseArs} blueRate={props.blueRate} compact />{selected.lastPurchaseAt ? <span className="muted inline-date">{formatShortDate(selected.lastPurchaseAt)}</span> : null}</> : "Sin compras"}</dd></div>
                </dl>
                <div className="price-reference-grid">
                  {(["sale", "pricecharting", "tcgplayer", "coolstuff"] as const).map((source) => {
                    const price = inventoryPriceDisplay(selected, source, props.blueRate);
                    return (
                      <button className={filters.priceSource === source ? "active" : ""} key={source} type="button" onClick={() => props.onFilterChange({ priceSource: source })}>
                        <span>{price.label}</span>
                        <strong>{price.hasPrice ? formatArs(price.ars || 0) : "-"}</strong>
                        <small>{price.helper}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="identifier-list">
                  {selected.product.identifiers.length ? selected.product.identifiers.map((identifier) => (
                    <a key={`${identifier.source}-${identifier.externalId}`} href={identifier.url || "#"} target="_blank" rel="noreferrer">
                      <span>{identifier.source}</span>
                      <strong>{identifier.externalId}</strong>
                    </a>
                  )) : <div className="quality-warning"><span>Sin identificadores externos</span><strong>Revisar PriceCharting</strong></div>}
                  {!selected.product.imageUrl ? <div className="quality-warning"><span>Sin imagen</span><strong>Prioridad de cache</strong></div> : null}
                  {!selected.priceArs ? <div className="quality-warning"><span>Precio cero</span><strong>Revisar antes de vender</strong></div> : null}
                </div>
                <div className="detail-actions"><button className="secondary-action" onClick={() => props.onRestock(selected)}><Icon name="plus" />Agregar existencias</button><button className="secondary-action" onClick={() => props.onEdit(selected)}><Icon name="edit" />Editar</button><button className="primary-action" disabled={selected.availableQuantity <= 0} onClick={() => handleAdd(selected)}><Icon name="cart" />Agregar al carrito</button></div>
              </>
            ) : <EmptyState title="Sin seleccion" body="Selecciona un producto para ver el detalle." />}
          </section>

          {selected ? (
            <section className="panel compact-adjustment-panel">
              <h3>Ajuste de cantidad</h3>
              <form className="form-grid" onSubmit={props.onAdjustmentSubmit}>
                <label>Cambio<input type="number" value={props.adjustment.quantityDelta} onChange={(event) => props.onAdjustmentChange({ ...props.adjustment, quantityDelta: Number(event.target.value) })} /></label>
                <label>Motivo<input value={props.adjustment.note} onChange={(event) => props.onAdjustmentChange({ ...props.adjustment, note: event.target.value })} placeholder="Ej: conteo, perdida, correccion..." /></label>
                <button className="primary-action"><Icon name="check" />Registrar ajuste</button>
              </form>
            </section>
          ) : null}
          {selected ? <section className="panel compact-history"><h3>Ultimos movimientos</h3>{selectedMovements.length ? selectedMovements.slice(0, 4).map((movement) => <div className="compact-activity-row" key={movement.id}><strong>{movementLabel(movement.type)} {formatDelta(movement.quantityDelta)}</strong><span>{formatDate(movement.createdAt)}</span><small>{movement.note || "Sin nota"}</small></div>) : <p className="muted">Sin movimientos para esta carta.</p>}</section> : null}
          </div> : <CartPanel
            compact
            items={allItems}
            cart={props.cart}
            mode={props.cartMode}
            customerName={props.customerName}
            channel={props.saleChannel}
            onCartChange={props.onCartChange}
            onModeChange={props.onCartModeChange}
            onCustomerNameChange={props.onCustomerNameChange}
            onChannelChange={props.onSaleChannelChange}
            onSubmit={props.onSubmitCart}
            blueRate={props.blueRate}
          />}
        </aside> : null}
      </div>
    </section>
  );
}

function CartPanel(props: {
  compact?: boolean;
  items: StockRow[];
  cart: CartLine[];
  mode: "sale" | "reservation";
  customerName: string;
  channel: string;
  onCartChange: (cart: CartLine[]) => void;
  onModeChange: (mode: "sale" | "reservation") => void;
  onCustomerNameChange: (value: string) => void;
  onChannelChange: (value: string) => void;
  onSubmit: () => void;
  blueRate: BlueExchangeRate;
}) {
  const total = props.cart.reduce((sum, line) => sum + line.quantity * line.unitPriceArs, 0);
  const update = (id: string, patch: Partial<CartLine>) => props.onCartChange(props.cart.map((line) => line.inventoryItemId === id ? { ...line, ...patch } : line));
  return (
    <section className={`panel cart-panel ${props.compact ? "compact-cart-panel" : ""} ${props.cart.length ? "active-cart-panel" : ""}`}>
      <div className="section-heading">
        <div><h3>Carrito</h3><p>{props.cart.length ? `${props.cart.length} cartas listas para registrar` : "Agrega cartas desde el inventario"}</p></div>
        {props.cart.length ? <span className="cart-total-badge"><MoneyStack ars={total} blueRate={props.blueRate} compact /></span> : null}
      </div>
      {props.cart.length ? (
        <div className="cart-panel-content">
          <div className="cart-controls">
            <div className="mode-toggle">
              <button className={props.mode === "sale" ? "active" : ""} onClick={() => props.onModeChange("sale")}>Venta cobrada</button>
              <button className={props.mode === "reservation" ? "active" : ""} onClick={() => props.onModeChange("reservation")}>Reserva</button>
            </div>
            <label>Cliente<input value={props.customerName} onChange={(event) => props.onCustomerNameChange(event.target.value)} placeholder="Nombre o usuario" /></label>
            <label>Lugar / canal<select value={props.channel} onChange={(event) => props.onChannelChange(event.target.value)}><option value="mostrador">Mostrador</option><option value="mesa">Mesa / feria</option><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option><option value="web">Web</option></select></label>
          </div>
          <div className="cart-lines">
            {props.cart.map((line) => {
              const item = props.items.find((row) => row.id === line.inventoryItemId);
              if (!item) return null;
              return (
                <div className="cart-line editable-cart-line" key={line.inventoryItemId}>
                  <div><strong>{item.product.name}</strong><span>{item.product.expansion} - {inventoryVariantLabel(item)}</span></div>
                  <label>Cant.<input type="number" min={1} max={item.availableQuantity} value={line.quantity} onChange={(event) => update(line.inventoryItemId, { quantity: Math.max(1, Math.min(item.availableQuantity, Number(event.target.value))) })} /></label>
                  <label>Precio<input type="number" min={0} value={line.unitPriceArs} onChange={(event) => update(line.inventoryItemId, { unitPriceArs: Math.max(0, Number(event.target.value)) })} /></label>
                  <button className="remove-action" aria-label={`Quitar ${item.product.name}`} title="Quitar" onClick={() => props.onCartChange(props.cart.filter((row) => row.inventoryItemId !== line.inventoryItemId))}><Icon name="close" /></button>
                </div>
              );
            })}
          </div>
          <div className="cart-summary-panel">
            <dl className="sale-total"><div><dt>Total</dt><dd><MoneyStack ars={total} blueRate={props.blueRate} /></dd></div><div><dt>Destino</dt><dd>{props.mode === "sale" ? "Ventas" : "Ordenes"}</dd></div></dl>
            <p className="cart-notice">{props.mode === "sale" ? "Descuenta el stock al confirmar." : "Separa el stock y queda pendiente de cobro."}</p>
            <button className="primary-action checkout-action" onClick={props.onSubmit}><Icon name="check" />{props.mode === "sale" ? "Confirmar venta" : "Crear reserva"}</button>
          </div>
        </div>
      ) : <EmptyState title="Carrito vacio" body="Usa Agregar en cualquier carta para armar una venta o reserva multiple." />}
    </section>
  );
}

function ProductModal({ receipt, form, editing, onChange, onSubmit, onClose, blueRate, saving, imageForcing, onForceImage, onForceManualImage, priceChartingCache, allItems, onSearchPriceCharting }: {
  receipt: string;
  form: InventoryFormState;
  editing: boolean;
  onChange: (form: InventoryFormState) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
  blueRate: BlueExchangeRate;
  saving: boolean;
  imageForcing: "" | "auto" | "manual";
  onForceImage: () => void;
  onForceManualImage: () => void;
  priceChartingCache: { entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus };
  allItems: StockRow[];
  onSearchPriceCharting: (search: string) => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <header className="modal-header">
          <div><span className="eyebrow">Inventario</span><h2 id="product-modal-title">{editing ? "Editar carta" : "Agregar stock"}</h2><p>{editing ? "Actualiza la informacion y guarda los cambios." : "Busca la carta, indica la cantidad y guarda. Podes completar el costo despues."}</p></div>
          <button className="modal-close" aria-label="Cerrar formulario" title="Cerrar" onClick={onClose}><Icon name="close" /></button>
        </header>
        {receipt ? <p className="intake-feedback" role="status">{receipt} Podes buscar la siguiente carta.</p> : null}
        <InventoryForm form={form} onChange={onChange} onSubmit={onSubmit} onCancel={onClose} submitLabel={editing ? "Guardar cambios" : "Agregar stock y seguir"} blueRate={blueRate} saving={saving} editing={editing} imageForcing={imageForcing} onForceImage={onForceImage} onForceManualImage={onForceManualImage} priceChartingCache={priceChartingCache} allItems={allItems} onSearchPriceCharting={onSearchPriceCharting} />
      </section>
    </div>
  );
}

function InventoryForm({ form, onChange, onSubmit, onCancel, submitLabel, blueRate, saving, editing, imageForcing, onForceImage, onForceManualImage, priceChartingCache, allItems, onSearchPriceCharting }: {
  form: InventoryFormState;
  onChange: (form: InventoryFormState) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  blueRate: BlueExchangeRate;
  saving: boolean;
  editing: boolean;
  imageForcing: "" | "auto" | "manual";
  onForceImage: () => void;
  onForceManualImage: () => void;
  priceChartingCache: { entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus };
  allItems: StockRow[];
  onSearchPriceCharting: (search: string) => void;
}) {
  const [catalogSearch, setCatalogSearch] = useState("");
  const [pickerLanguageGroup, setPickerLanguageGroup] = useState<LanguageGroupFilter>("all");
  const [pickerEntries, setPickerEntries] = useState<PriceChartingCacheEntry[]>([]);
  const [pickerCatalogTotal, setPickerCatalogTotal] = useState(priceChartingCache.status.totalEntries);
  const [pickerSearching, setPickerSearching] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [pickerCurrency, setPickerCurrency] = useState<"USD" | "ARS">("USD");
  const pickerSequence = useRef(0);
  async function searchPicker(search: string) {
    const sequence = ++pickerSequence.current;
    setPickerSearching(true);
    setPickerError("");
    try {
      const result = await api<{ entries: PriceChartingCacheEntry[]; status?: PriceChartingCacheStatus }>(`/pricecharting-cache?query=${encodeURIComponent(search)}&languageGroup=${encodeURIComponent(pickerLanguageGroup)}&limit=60`);
      const fallbackEntries = searchInventoryCatalogEntries(allItems, search, pickerLanguageGroup, 60);
      if (sequence === pickerSequence.current) {
        setPickerCatalogTotal(result.status?.totalEntries ?? priceChartingCache.status.totalEntries);
        setPickerEntries(mergeCatalogPickerEntries(result.entries, fallbackEntries, 60));
      }
    } catch (error) {
      const fallbackEntries = searchInventoryCatalogEntries(allItems, search, pickerLanguageGroup, 60);
      if (sequence === pickerSequence.current) {
        setPickerEntries(fallbackEntries);
        setPickerError(fallbackEntries.length ? "" : errorMessage(error));
      }
    } finally { if (sequence === pickerSequence.current) setPickerSearching(false); }
  }
  useEffect(() => {
    ++pickerSequence.current;
    if (!catalogSearch.trim()) { setPickerEntries([]); setPickerSearching(false); return; }
    setPickerSearching(true);
    const timer = window.setTimeout(() => void searchPicker(catalogSearch), 300);
    return () => { window.clearTimeout(timer); ++pickerSequence.current; };
  }, [allItems, catalogSearch, pickerLanguageGroup]);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(!editing && !form.name);
  const [showDetails, setShowDetails] = useState(editing);
  useEffect(() => { if (!editing && !form.name) setCatalogPickerOpen(true); }, [editing, form.name]);
  const set = (patch: Partial<InventoryFormState>) => onChange({ ...form, ...patch });
  const isGraded = Boolean(form.gradingCompany || form.grade || form.condition === "GRADED");
  const available = Math.max(0, form.quantityOnHand - form.quantityReserved);
  const convertedArs = form.priceUsd ? Math.round(toBlueArs(form.priceUsd, blueRate)) : 0;
  const setSalePriceArs = (value: string) => {
    if (value === "") {
      set({ priceArs: 0, priceUsd: null });
      return;
    }
    const priceArs = Math.max(0, Number(value || 0));
    set({ priceArs, priceUsd: priceArs ? roundUsd(fromBlueArs(priceArs, blueRate)) : null });
  };
  const setSalePriceUsd = (value: string) => {
    if (value === "") {
      set({ priceUsd: null, priceArs: 0 });
      return;
    }
    const priceUsd = Math.max(0, Number(value || 0));
    set({ priceUsd, priceArs: priceUsd ? Math.round(toBlueArs(priceUsd, blueRate)) : 0 });
  };
  const setPresentation = (presentation: "RAW" | "GRADED") => {
    if (presentation === "GRADED") set({ condition: "GRADED", gradingCompany: form.gradingCompany || "PSA", grade: form.grade || "10" });
    else set({ condition: form.condition === "GRADED" ? "NM" : form.condition, gradingCompany: "", grade: "", gradingCert: "" });
  };
  const selectCatalogCard = (entry: PriceChartingCacheEntry) => {
    const priceUsd = entry.loosePriceUsd ?? null;
    set({
      sku: "",
      name: entry.productName,
      expansion: entry.expansionName,
      number: entry.cardNumber,
      imageUrl: entry.imageUrl,
      priceChartingId: entry.priceChartingId,
      priceChartingUrl: entry.canonicalUrl,
      language: entry.language || form.language,
      finish: entry.finish || form.finish,
      priceUsd,
      priceArs: priceUsd ? Math.round(toBlueArs(priceUsd, blueRate)) : form.priceArs
    });
    setCatalogPickerOpen(false);
  };
  const choosingCatalogCard = !editing && catalogPickerOpen;
  return (
    <form className="modal-form-shell" onSubmit={onSubmit}>
      <div className={`inventory-edit-layout ${choosingCatalogCard ? "catalog-choosing" : ""}`}>
        <aside className="inventory-edit-preview">
          <CardArt src={form.imageUrl} alt={form.name || "Carta"} label={form.name || "Sin nombre"} className="inventory-edit-art" fallbackClassName="inventory-edit-art image-placeholder" />
          <div className="inventory-edit-preview-copy">
            <span className="eyebrow">{isGraded ? "Graded" : "RAW"}</span>
            <h3>{form.name || "Sin nombre"}</h3>
            <p>{form.expansion || "Sin expansion"} {form.number ? `#${form.number}` : ""}</p>
            <div className="inventory-edit-badges">
              <span>{form.language || "EN"}</span>
              <span>{isGraded ? [form.gradingCompany, form.grade].filter(Boolean).join(" ") || "Graded" : form.condition || "NM"}</span>
              <span>{editing ? `${available} disp.` : `+${form.quantityOnHand} a agregar`}</span>
            </div>
            <MoneyStack ars={form.priceArs || convertedArs || null} usd={form.priceUsd} blueRate={blueRate} compact />
            {editing ? (
              <div className="image-force-box">
                <button type="button" className="secondary-action" disabled={saving || Boolean(imageForcing)} onClick={onForceImage}>
                  <Icon name="refresh" />{imageForcing === "auto" ? "Buscando..." : "Forzar imagen"}
                </button>
                <button type="button" className="secondary-action" disabled={saving || Boolean(imageForcing)} onClick={onForceManualImage}>
                  <Icon name="edit" />{imageForcing === "manual" ? "Guardando..." : "Pegar URL"}
                </button>
                <small>Prueba PriceCharting, fuentes externas o una URL manual.</small>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="inventory-edit-sections">
          {choosingCatalogCard ? <section className="edit-section catalog-picker">
            <div className="edit-section-heading"><div><h3>Buscar carta</h3><span>Elegi una carta de la base para agregar existencias al inventario.</span></div><strong>{Math.max(pickerCatalogTotal, priceChartingCache.status.totalEntries, allItems.length).toLocaleString("es-AR")} cartas</strong></div>
            <div className="catalog-picker-tools">
              <LanguageGroupSelector value={pickerLanguageGroup} onChange={setPickerLanguageGroup} />
              <CurrencyToggle value={pickerCurrency} onChange={setPickerCurrency} />
            </div>
            <div className="catalog-picker-search">
              <input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchPicker(catalogSearch); } }} placeholder="Nombre, expansion, numero o ID" autoFocus />
              <button className="primary-action" type="button" onClick={() => void searchPicker(catalogSearch)}><Icon name="search" />Buscar</button>
            </div>
            {!pickerSearching && pickerEntries.length ? <div className="catalog-picker-results">
              {pickerEntries.map((entry) => <button type="button" className={`catalog-picker-row ${form.priceChartingId === entry.priceChartingId ? "selected" : ""}`} key={entry.priceChartingId} onClick={() => selectCatalogCard(entry)}>
                {entry.imageUrl ? <img src={assetUrl(entry.imageUrl)} alt="" /> : <div className="image-placeholder compact-placeholder">PC</div>}
                <div className="catalog-picker-card-copy">
                  <strong>{cleanCatalogPickerName(entry)}</strong>
                  <span>{cleanCatalogPickerExpansion(entry) || "Sin expansion"}{entry.cardNumber ? ` #${entry.cardNumber}` : ""}</span>
                  <small>{entry.canonicalUrl ? catalogSourceLabel(entry) : "Inventario local"}</small>
                </div>
                <div className="catalog-picker-meta">
                  <div className="catalog-picker-badges">
                    {entry.finish && entry.finish !== "normal" ? <span className="badge">{finishLabel(entry.finish)}</span> : null}
                    {entry.language ? <span className="badge">{entry.language}</span> : null}
                  </div>
                  <CatalogPickerPrices entry={entry} blueRate={blueRate} currency={pickerCurrency} />
                </div>
              </button>)}
            </div> : <p className="muted">{pickerSearching ? "Buscando cartas..." : pickerError || (catalogSearch.trim() ? "No se encontraron cartas. Proba con nombre, expansion o numero." : "Escribi para buscar una carta.")}</p>}
          </section> : null}
          {!editing && !catalogPickerOpen ? <section className="selected-catalog-card">
            <div><span className="eyebrow">Carta elegida</span><strong>{form.name}</strong><span>{form.expansion}{form.number ? ` #${form.number}` : ""}</span></div>
            <button className="secondary-action" type="button" onClick={() => setCatalogPickerOpen(true)}><Icon name="search" />Cambiar carta</button>
          </section> : null}
          {!choosingCatalogCard ? <>
          {!editing ? <section className="edit-section quick-stock-fields">
            <div className="edit-section-heading"><h3>Agregar existencias</h3><span>El costo es opcional</span></div>
            <div className="edit-field-grid">
              <label>Cantidad a agregar<input autoFocus required type="number" min={1} step={1} value={form.quantityOnHand} onChange={(event) => set({ quantityOnHand: Number(event.target.value) })} /></label>
              <label>Precio de venta ARS<input type="number" min={0} step={0.01} value={form.priceArs || ""} onChange={(event) => setSalePriceArs(event.target.value)} placeholder="Opcional" /></label>
              <label>Precio de venta USD<input type="number" min={0} step={0.01} value={form.priceUsd ?? ""} onChange={(event) => setSalePriceUsd(event.target.value)} placeholder="Opcional" /></label>
              <label>Costo de compra por unidad<input type="number" min={0} step={0.01} value={form.purchaseCost ?? ""} onChange={(event) => set({ purchaseCost: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Sin registrar" /></label>
              <label>Moneda del costo<select value={form.purchaseCurrency} onChange={(event) => set({ purchaseCurrency: event.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option></select></label>
              <label>Idioma<input required value={form.language} onChange={(event) => set({ language: event.target.value.toUpperCase() })} /></label>
              <label>Condicion<input required value={form.condition} onChange={(event) => set({ condition: event.target.value.toUpperCase() })} /></label>
              <label>Acabado<input required value={form.finish} onChange={(event) => set({ finish: event.target.value })} /></label>
            </div>
            <button type="button" className="secondary-action" onClick={() => setShowDetails(!showDetails)}>{showDetails ? "Ocultar detalles" : "Mas datos: ubicacion, graded, notas"}</button>
          </section> : null}
          {showDetails ? <>
          <section className="edit-section">
            <div className="edit-section-heading"><h3>Identidad</h3><span>Que carta es</span></div>
            <div className="edit-field-grid">
              <label>Nombre<input required value={form.name} onChange={(event) => set({ name: event.target.value })} /></label>
              <label>Expansion<input required value={form.expansion} onChange={(event) => set({ expansion: event.target.value })} /></label>
              <label>Numero<input value={form.number} onChange={(event) => set({ number: event.target.value })} /></label>
              <label>Idioma<input required value={form.language} onChange={(event) => set({ language: event.target.value.toUpperCase() })} /></label>
            </div>
          </section>

          <section className="edit-section">
            <div className="edit-section-heading"><h3>Presentacion</h3><span>Como la tenes fisicamente</span></div>
            <div className="edit-field-grid">
              <label>Presentacion<select value={isGraded ? "GRADED" : "RAW"} onChange={(event) => setPresentation(event.target.value as "RAW" | "GRADED")}><option value="RAW">RAW</option><option value="GRADED">Graded</option></select></label>
              {isGraded ? (
                <>
                  <label>Empresa<input required value={form.gradingCompany} onChange={(event) => set({ gradingCompany: event.target.value.toUpperCase(), condition: "GRADED" })} placeholder="PSA, BGS, CGC" /></label>
                  <label>Nota<input required value={form.grade} onChange={(event) => set({ grade: event.target.value.toUpperCase(), condition: "GRADED" })} placeholder="10, 9.5, 9" /></label>
                  <label>Certificado<input value={form.gradingCert} onChange={(event) => set({ gradingCert: event.target.value, condition: "GRADED" })} placeholder="Opcional" /></label>
                </>
              ) : <label>Condicion<input required value={form.condition} onChange={(event) => set({ condition: event.target.value.toUpperCase() })} placeholder="NM, LP, MP..." /></label>}
              <label>Acabado<input required value={form.finish} onChange={(event) => set({ finish: event.target.value })} /></label>
            </div>
          </section>

          <section className="edit-section">
            <div className="edit-section-heading"><h3>Stock y precio</h3><span>{available} disponible(s)</span></div>
            <div className="edit-field-grid">
              <label>Total<input type="number" min={0} value={form.quantityOnHand} onChange={(event) => set({ quantityOnHand: Number(event.target.value) })} /></label>
              <label>Reservadas<input type="number" min={0} value={form.quantityReserved} onChange={(event) => set({ quantityReserved: Number(event.target.value) })} /></label>
              <label>Ubicacion<input value={form.location} onChange={(event) => set({ location: event.target.value })} /></label>
              <label>Lote<input value={form.intakeBatch} onChange={(event) => set({ intakeBatch: event.target.value })} placeholder="Caja 1, Binder EX..." /></label>
              <label>Categoria(s)<input value={form.tags} onChange={(event) => set({ tags: event.target.value })} placeholder="jugables, old, full art..." list="inventory-tag-suggestions" /></label>
              <label>Estado<select value={form.inventoryStatus} onChange={(event) => set({ inventoryStatus: event.target.value })}>{inventoryStatusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              {editing ? <><label>Costo de compra por unidad<input type="number" min={0} step={0.01} value={form.purchaseCost ?? ""} onChange={(event) => set({ purchaseCost: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Sin registrar" /></label><label>Moneda del costo<select value={form.purchaseCurrency} onChange={(event) => set({ purchaseCurrency: event.target.value })}><option value="ARS">ARS</option><option value="USD">USD</option></select></label></> : null}
              <label>Precio USD<input type="number" min={0} step={0.01} value={form.priceUsd ?? ""} onChange={(event) => setSalePriceUsd(event.target.value)} /></label>
              <label>Precio ARS<input type="number" min={0} value={form.priceArs || ""} onChange={(event) => setSalePriceArs(event.target.value)} /></label>
              <div className="price-helper"><span>Cotizacion actual</span><strong>{formatArs(blueRate.sell)}</strong>{convertedArs ? <button type="button" className="secondary-action" onClick={() => set({ priceArs: convertedArs })}>Usar {formatArs(convertedArs)}</button> : null}</div>
            </div>
          </section>

          <details className="edit-section advanced-edit-section">
            <summary>Avanzado</summary>
            <div className="edit-field-grid">
              <label>SKU<input value={form.sku} onChange={(event) => set({ sku: event.target.value })} placeholder="Si lo dejas vacio se genera" /></label>
              <label className="span-2">Imagen URL<input value={form.imageUrl} onChange={(event) => set({ imageUrl: event.target.value })} /></label>
              <label className="span-2">Notas<input value={form.notes} onChange={(event) => set({ notes: event.target.value })} /></label>
            </div>
          </details>
          </> : null}
          </> : null}
        </div>
      </div>
      <div className="modal-footer"><button type="button" className="secondary-action" disabled={saving} onClick={onCancel}><Icon name="close" />Cancelar</button><button className="primary-action" disabled={saving || choosingCatalogCard}><Icon name="check" />{saving ? "Guardando..." : choosingCatalogCard ? "Elegí una carta" : submitLabel}</button></div>
    </form>
  );
}

function MovementsView({ movements, audit }: { movements: MovementRow[]; audit: AuditRow[] }) {
  const [tab, setTab] = useState<"stock" | "system">("stock");
  return (
    <section className="view panel">
      <div className="section-heading">
        <div><h2>Movimientos</h2><p>Una sola seccion para seguir stock y cambios administrativos.</p></div>
        <div className="mode-toggle activity-toggle">
          <button className={tab === "stock" ? "active" : ""} onClick={() => setTab("stock")}>Stock</button>
          <button className={tab === "system" ? "active" : ""} onClick={() => setTab("system")}>Cambios del sistema</button>
        </div>
      </div>
      {tab === "stock" ? <MovementList movements={movements} /> : (
        audit.length ? <div className="movement-list">{audit.map((row) => (
          <article className="movement-row" key={row.id}>
            <div><strong>{auditLabel(row.action)}</strong><span>{row.entityType}</span></div>
            <div>{row.actorName || "Sistema"}</div>
            <div>{formatDate(row.createdAt)}</div>
            <p>{row.entityId}</p>
          </article>
        ))}</div> : <EmptyState title="Sin cambios administrativos" body="Las altas, ediciones y ajustes aparecen aca." />
      )}
    </section>
  );
}

function MovementList({ movements }: { movements: MovementRow[] }) {
  return movements.length ? (
    <div className="movement-list">
      {movements.map((movement) => (
        <article className="movement-row" key={movement.id}>
          <div><strong>{movementLabel(movement.type)}</strong><span>{movement.itemName || movement.sku}</span></div>
          <div>{formatDelta(movement.quantityDelta)}</div>
          <div>{formatDate(movement.createdAt)}</div>
          <p>{movement.note || "Sin nota"}</p>
        </article>
      ))}
    </div>
  ) : <EmptyState title="Sin movimientos" body="Los ajustes de inventario apareceran aca." />;
}

type OrderWorkspace = {
  boards: Array<{id:string;name:string}>;
  columns: Array<{id:string;boardId:string;name:string;position:number}>;
  cards: Array<{saleId:string;columnId:string;position:number}>;
};

function OrdersView(props: Parameters<typeof OrdersListView>[0]) {
  const [workspace,setWorkspace] = useState<OrderWorkspace | null>(null);
  const [boardId,setBoardId] = useState("");
  const [query,setQuery] = useState("");
  const [history,setHistory] = useState(false);
  const [list,setList] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const saving = useRef(false);
  const moveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [editor,setEditor] = useState<{action:string;id?:string;name:string} | null>(null);
  const [openId,setOpenId] = useState("");
  const [dragId,setDragId] = useState("");
  const [over,setOver] = useState("");
  const [destination,setDestination] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const load = () => { setError(""); void api<OrderWorkspace>("/order-boards").then(setWorkspace).catch(e=>setError(String(e.message || e))); };
  useEffect(load,[]);
  useEffect(()=>{
    if (openId && !dialog.current?.open) dialog.current?.showModal();
    if (!openId) dialog.current?.close();
  },[openId]);
  const mainBoard = workspace?.boards.find(b=>normalize(b.name)===normalize("Embalaje"));
  const selectedBoard = workspace?.boards.find(b=>b.id===boardId) || mainBoard || workspace?.boards[0];
  const columns = workspace?.columns.filter(c=>c.boardId===selectedBoard?.id) || [];
  const defaultColumn = workspace?.columns.find(c=>c.boardId===(mainBoard || workspace?.boards[0])?.id)?.id;
  const cardMap = new Map(workspace?.cards.map(c=>[c.saleId,c]));
  const columnOf = (id:string) => cardMap.get(id)?.columnId || defaultColumn;
  const isCompletedBoard = (board?: {name:string}) => normalize(board?.name || "") === normalize("Completas");
  const boardShowsSale = (board: {name:string} | undefined, sale: SaleRecord) => isCompletedBoard(board) ? ["delivered","cancelled"].includes(sale.status) : sale.status!=="cancelled" && (history || sale.status!=="delivered");
  const allOrders = props.sales.filter(s=>s.saleType==="reservation" && boardShowsSale(selectedBoard,s));
  const orders = allOrders.filter(s=>normalize([s.customerName,s.internalNote,...s.lines.map(l=>l.name+" "+l.sku)].join(" ")).includes(normalize(query)));
  const openOrder = props.sales.find(s=>s.id===openId);
  const refreshBoards = () => window.setTimeout(load, 120);
  function moveCardLocally(current: OrderWorkspace, saleId: string, columnId: string, beforeSaleId?: string): OrderWorkspace {
    const targetIds = current.cards
      .filter(card => card.columnId === columnId && card.saleId !== saleId)
      .sort((a,b) => a.position - b.position || a.saleId.localeCompare(b.saleId))
      .map(card => card.saleId);
    const before = beforeSaleId ? targetIds.indexOf(beforeSaleId) : -1;
    targetIds.splice(before < 0 ? targetIds.length : before, 0, saleId);
    return {
      ...current,
      cards: [
        ...current.cards.filter(card => card.saleId !== saleId && card.columnId !== columnId),
        ...targetIds.map((id, position) => ({ saleId: id, columnId, position }))
      ]
    };
  }
  async function change(body: Record<string,string>) {
    if (body.action === "move" && body.saleId && body.columnId) {
      const { saleId, columnId, beforeSaleId } = body;
      setError("");
      setNotice("Movida.");
      setWorkspace(current => current ? moveCardLocally(current, saleId, columnId, beforeSaleId) : current);
      moveQueue.current = moveQueue.current
        .catch(() => undefined)
        .then(async () => {
          await api<OrderWorkspace>("/order-boards",{method:"POST",body});
          setNotice("Guardada.");
        })
        .catch(e => {
          setError(e instanceof Error ? e.message : String(e));
          load();
        });
      return true;
    }
    if (saving.current) return false;
    saving.current=true;setBusy(true);setError("");setNotice("");
    try {
      const next=await api<OrderWorkspace>("/order-boards",{method:"POST",body});
      setWorkspace(next);
      if(body.action==="createBoard") setBoardId(next.boards.find(b=>!workspace?.boards.some(old=>old.id===b.id))?.id || "");
      setNotice(body.action==="move" ? "Tarjeta movida y guardada." : "Tablero guardado.");
      return true;
    } catch(e) {setError(e instanceof Error ? e.message : String(e));return false;}
    finally {saving.current=false;setBusy(false);}
  }
  function drop(event: React.DragEvent, columnId:string, beforeSaleId?:string) {
    event.preventDefault();event.stopPropagation();setOver("");
    const saleId=event.dataTransfer.getData("text/ultimoturno-order") || dragId;
    setDragId("");
    if(!saleId || saleId===beforeSaleId || !allOrders.some(s=>s.id===saleId))return;
    void change({action:"move",saleId,columnId,...(beforeSaleId?{beforeSaleId}:{})});
  }
  const open = (id:string) => {setDestination(columnOf(id) || "");setOpenId(id);};
  if(list) return <><button className="secondary-action" onClick={()=>setList(false)}>Volver a tableros</button><OrdersListView {...props}/></>;
  return <section className="view trello-orders">
    <header className="panel trello-toolbar">
      <div className="trello-heading"><h2>Ordenes</h2><input aria-label="Buscar ordenes" placeholder="Buscar comprador, carta o nota" value={query} onChange={e=>setQuery(e.target.value)}/><label className="trello-history"><input type="checkbox" checked={history} onChange={e=>setHistory(e.target.checked)}/>Entregadas</label><button className="secondary-action" onClick={()=>setList(true)}>Vista de lista</button></div>
      <nav className="trello-tabs" aria-label="Tableros de ordenes">{workspace?.boards.map(board=>{
        const first=workspace.columns.find(c=>c.boardId===board.id);
        const count=props.sales.filter(s=>s.saleType==="reservation" && boardShowsSale(board,s) && workspace.columns.some(c=>c.boardId===board.id && c.id===columnOf(s.id))).length;
        return <button key={board.id} className={selectedBoard?.id===board.id?"active":""} onClick={()=>setBoardId(board.id)} onDragEnter={e=>{e.preventDefault();}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";}} onDrop={e=>{if(first){drop(e,first.id);setBoardId(board.id);}}}>{board.name}<span>{count}</span></button>;
      })}<button onClick={()=>setEditor({action:"createBoard",name:""})}>+ Crear tablero</button></nav>
      <div className="trello-board-tools"><span>Arrastra una tarjeta a una columna o a otro tablero.</span>{selectedBoard && <><button className="secondary-action" onClick={()=>setEditor({action:"renameBoard",id:selectedBoard.id,name:selectedBoard.name})}>Renombrar tablero</button><button className="secondary-action" onClick={()=>setEditor({action:"createColumn",id:selectedBoard.id,name:""})}>+ Columna</button></>}</div>
      {editor && <form className="trello-name-form" onSubmit={async e=>{e.preventDefault();if(await change({action:editor.action,name:editor.name,...(editor.action==="renameColumn"?{columnId:editor.id!}:editor.id?{boardId:editor.id}:{})}))setEditor(null);}}><label>{editor.action==="createBoard"?"Nombre del nuevo tablero":editor.action==="createColumn"?"Nombre de la nueva columna":"Nuevo nombre"}<input autoFocus required maxLength={80} value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})}/></label><button className="primary-action" disabled={busy || !editor.name.trim()}>Guardar</button><button type="button" className="secondary-action" onClick={()=>setEditor(null)}>Cancelar</button></form>}
      {error && <div role="alert">{error}<button className="secondary-action" onClick={load}>Reintentar carga</button></div>}
      <span className="trello-save-status" role="status">{busy?"Guardando...":notice}</span>
    </header>
    {!workspace && !error && <p>Cargando tableros...</p>}
    <div className="trello-board" aria-label={selectedBoard?.name}>{columns.map(column=>{
      const cards=orders.filter(s=>columnOf(s.id)===column.id).sort((a,b)=>(cardMap.get(a.id)?.position ?? -1)-(cardMap.get(b.id)?.position ?? -1) || a.createdAt.localeCompare(b.createdAt));
      return <section key={column.id} className={`trello-column ${over===column.id?"drag-over":""}`} aria-label={column.name} onDragOver={e=>{if(!busy){e.preventDefault();setOver(column.id);}}} onDrop={e=>{if(!busy)drop(e,column.id);}}>
        <header><h3>{column.name} <span>{cards.length}</span></h3><button aria-label={`Renombrar columna ${column.name}`} onClick={()=>setEditor({action:"renameColumn",id:column.id,name:column.name})}>···</button></header>
        <div className="trello-cards">{cards.map(order=>{
          const total=order.lines.reduce((n,l)=>n+l.quantity,0),packed=order.lines.reduce((n,l)=>n+(l.packed?l.quantity:0),0);
          const debt=order.status==="paid" || order.status==="delivered" ? 0 : Math.max(0,order.totalArs-(order.amountPaidArs || 0));
          const overdue=debt>0 && order.paymentDueAt && new Date(order.paymentDueAt).getTime()<Date.now();
          return <button key={order.id} className={`trello-card ${dragId===order.id?"dragging":""}`} draggable={!busy} onDragStart={e=>{e.dataTransfer.setData("text/ultimoturno-order",order.id);e.dataTransfer.effectAllowed="move";setDragId(order.id);}} onDragEnd={()=>{setDragId("");setOver("");}} onDrop={e=>{if(!busy)drop(e,column.id,order.id);}} onClick={()=>open(order.id)}>
            <strong>{order.customerName || "Sin nombre"}</strong><span className="trello-card-total">{order.totalArs > 0 || !order.totalUsd ? formatArs(order.totalArs) : ""}{order.totalArs > 0 && order.totalUsd > 0 ? " + " : ""}{order.totalUsd > 0 ? `${formatUsd(order.totalUsd)} USD` : ""}</span><span className="trello-card-meta"><span>{packed}/{total} embaladas</span><span>{order.status === "paid" || order.status === "delivered" ? "Pagada" : debt > 0 ? `Resta ${formatArs(debt)}` : order.totalUsd > 0 ? "Pago pendiente" : "Sin saldo en pesos"}</span></span>{overdue && <span className="trello-overdue">Vencida · {formatShortDate(order.paymentDueAt!)}</span>}{order.internalNote && <span className="trello-note">Nota: {order.internalNote}</span>}
          </button>;
        })}{!cards.length && <p className="trello-empty">{query?"Sin coincidencias":"Arrastra ordenes aqui"}</p>}</div>
      </section>;
    })}</div>
    <dialog aria-label="Detalle de orden" className="trello-order-dialog" ref={dialog} onCancel={()=>setOpenId("")} onClose={()=>setOpenId("")}>
      {openOrder && <><header className="trello-dialog-heading"><h2>{openOrder.customerName}</h2><button autoFocus className="secondary-action" onClick={()=>setOpenId("")}>Cerrar</button></header><div className="trello-move"><label>Mover a<select value={destination} onChange={e=>setDestination(e.target.value)}>{workspace?.boards.map(b=><optgroup key={b.id} label={b.name}>{workspace.columns.filter(c=>c.boardId===b.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select></label><button className="secondary-action" disabled={busy || !destination || destination===columnOf(openId)} onClick={()=>void change({action:"move",saleId:openId,columnId:destination})}>Mover tarjeta</button><span role="status">{busy?"Guardando...":notice}</span>{error && <span role="alert">{error}</span>}</div>
        <OrderCard key={openId} order={openOrder} boardLabel={workspace?.columns.find(c=>c.id===columnOf(openId))?.name || "Orden"} blueRate={props.blueRate} open focused={false} selected={false} copied={false} onToggle={()=>{}} onSelectedChange={()=>{}} onComplete={async id=>{await props.onComplete(id);refreshBoards();}} onCancel={async id=>{await props.onCancel(id);refreshBoards();}} onPacked={async id=>{await props.onPacked(id);refreshBoards();}} onDelivered={async id=>{await props.onDelivered(id);refreshBoards();}} onPayment={async (id,amount,due)=>{await props.onPayment(id,amount,due);refreshBoards();}} onNote={async (id,note)=>{await props.onNote(id,note);}} onMessageSent={sent=>props.onMessageSent(openId,sent)} onLinePacked={async (id,packed)=>{await props.onLinePacked(id,packed);refreshBoards();}} onCopy={()=>void copyToClipboard(buildClaimOrderMessage(openOrder))}/></>}
    </dialog>
  </section>;
}

function OrdersListView({ sales, claims, blueRate, onComplete, onCancel, onPacked, onDelivered, onPayment, onNote, onMessageSent, onLinePacked }: { sales: SaleRecord[]; claims: ClaimsWorkspace; blueRate: BlueExchangeRate; onComplete: (id: string) => Promise<void>; onCancel: (id: string) => Promise<void>; onPacked: (id: string) => Promise<void>; onDelivered: (id: string) => Promise<void>; onPayment: (id: string, amount: number, paymentDueAt?: string) => Promise<void>; onNote: (id: string, note: string) => Promise<void>; onMessageSent: (id: string, sent: boolean) => Promise<void>; onLinePacked: (id: string, packed: boolean) => Promise<void> }) {
  const reservations = sales.filter((sale) => sale.saleType === "reservation");
  const activeOrders = reservations.filter((sale) => sale.status !== "delivered" && sale.status !== "cancelled");
  const deliveredOrders = reservations.filter((sale) => sale.status === "delivered");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [selectedBoard, setSelectedBoard] = useState("all");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [batchDueDate, setBatchDueDate] = useState("");
  const [copiedOrderId, setCopiedOrderId] = useState("");
  const [openOrderIds, setOpenOrderIds] = useState<string[]>([]);
  const [focusedOrderId, setFocusedOrderId] = useState("");
  const toggleOrder = (id: string) => {
    setFocusedOrderId(id);
    setOpenOrderIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };
  const claimBoardSaleIds = new Map<string, { id: string; label: string; saleIds: Set<string>; closedAt?: string }>();
  for (const claim of claims.history) {
    if (!claim.closedSaleIds?.length) continue;
    claimBoardSaleIds.set(claim.id, {
      id: `claim:${claim.id}`,
      label: claim.name || (claim.closedAt ? `Claim ${formatShortDate(claim.closedAt)}` : "Claim cerrado"),
      saleIds: new Set(claim.closedSaleIds),
      closedAt: claim.closedAt
    });
  }
  const saleIdToBoard = new Map<string, string>();
  for (const board of claimBoardSaleIds.values()) {
    for (const saleId of board.saleIds) saleIdToBoard.set(saleId, board.id);
  }
  const orderBoards = [
    { id: "all", label: "Activas", count: activeOrders.length },
    { id: "manual", label: "Pedidos", count: activeOrders.filter((order) => !saleIdToBoard.has(order.id)).length },
    ...[...claimBoardSaleIds.values()]
      .map((board) => ({ id: board.id, label: board.label, count: activeOrders.filter((order) => board.saleIds.has(order.id)).length, closedAt: board.closedAt }))
      .filter((board) => board.count > 0)
      .sort((left, right) => new Date(right.closedAt || 0).getTime() - new Date(left.closedAt || 0).getTime()),
    { id: "delivered", label: "Entregadas", count: deliveredOrders.length }
  ];
  useEffect(() => {
    if (!orderBoards.some((board) => board.id === selectedBoard)) setSelectedBoard("all");
  }, [orderBoards, selectedBoard]);
  const showingDelivered = selectedBoard === "delivered";
  const orders = showingDelivered ? deliveredOrders : activeOrders;
  const orderSearchText = normalize(orderSearch);
  const orderFilterOptions: Array<{ value: OrderFilter; label: string }> = [
    { value: "all", label: "Todas" },
    { value: "pending", label: "Pendientes" },
    { value: "packed", label: "Embaladas" },
    { value: "paid", label: "Pagadas" },
    { value: "debt", label: "Con deuda" },
    { value: "no_message", label: "Sin mensaje" },
    { value: "message", label: "Mensaje enviado" },
    { value: "note", label: "Nota" }
  ];
  const matchesOrderSearch = (order: SaleRecord) => !orderSearchText || normalize([
      order.customerName,
      order.channel,
      order.lines.map((line) => `${line.name} ${line.sku}`).join(" ")
    ].join(" ")).includes(orderSearchText);
  const matchesBoard = (order: SaleRecord) => {
    if (selectedBoard === "delivered") return order.status === "delivered";
    if (selectedBoard === "all") return true;
    if (selectedBoard === "manual") return !saleIdToBoard.has(order.id);
    return saleIdToBoard.get(order.id) === selectedBoard;
  };
  const matchesOrderFilter = (order: SaleRecord, filter: OrderFilter) => {
    const units = order.lines.reduce((sum, line) => sum + line.quantity, 0);
    const packedUnits = order.lines.filter((line) => line.packed).reduce((sum, line) => sum + line.quantity, 0);
    const allPacked = units > 0 && packedUnits === units;
    if (filter === "pending") return order.status === "pending";
    if (filter === "packed") return order.status === "packed" || (order.status !== "paid" && allPacked);
    if (filter === "paid") return order.status === "paid" || order.status === "delivered";
    if (filter === "debt") return order.status !== "cancelled" && (order.amountPaidArs || 0) < order.totalArs;
    if (filter === "no_message") return !order.messageSentAt;
    if (filter === "message") return Boolean(order.messageSentAt);
    if (filter === "note") return Boolean(order.internalNote);
    return true;
  };
  const boardOrders = orders.filter((order) => matchesBoard(order) && matchesOrderSearch(order));
  const visibleOrders = boardOrders.filter((order) => matchesOrderFilter(order, orderFilter));
  const visibleDebtArs = boardOrders.reduce((sum, order) => sum + Math.max(0, order.totalArs - (order.amountPaidArs || 0)), 0);
  const visibleMessagePending = boardOrders.filter((order) => !order.messageSentAt).length;
  const visiblePaidReady = boardOrders.filter((order) => order.status === "paid").length;
  const visiblePacked = boardOrders.filter((order) => order.status === "packed").length;
  const batchableVisibleOrders = visibleOrders.filter((order) => order.status !== "delivered" && order.status !== "cancelled");
  const visibleOrderIds = new Set(visibleOrders.map((order) => order.id));
  const visibleSelectedIds = selectedOrderIds.filter((id) => visibleOrderIds.has(id));
  const selectedOrders = activeOrders.filter((order) => selectedOrderIds.includes(order.id));
  const allVisibleSelected = batchableVisibleOrders.length > 0 && batchableVisibleOrders.every((order) => selectedOrderIds.includes(order.id));
  const filterCounts = new Map(orderFilterOptions.map((option) => [option.value, orders.filter((order) => matchesBoard(order) && matchesOrderSearch(order) && matchesOrderFilter(order, option.value)).length]));
  const boardLabel = (order: SaleRecord) => {
    const boardId = saleIdToBoard.get(order.id);
    if (!boardId) return "Pedidos";
    return orderBoards.find((board) => board.id === boardId)?.label || "Claim";
  };
  const toggleSelectedOrder = (id: string) => setSelectedOrderIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleVisibleSelection = () => setSelectedOrderIds((current) => {
    const currentSet = new Set(current);
    if (allVisibleSelected) {
      for (const order of batchableVisibleOrders) currentSet.delete(order.id);
    } else {
      for (const order of batchableVisibleOrders) currentSet.add(order.id);
    }
    return [...currentSet];
  });
  const applyBatchDueDate = async () => {
    if (!batchDueDate || !selectedOrders.length) return;
    await Promise.all(selectedOrders.map((order) => onPayment(order.id, order.amountPaidArs || 0, batchDueDate)));
    setBatchDueDate("");
  };
  const markBatchMessage = async () => {
    await Promise.all(selectedOrders.map((order) => onMessageSent(order.id, true)));
  };
  const markBatchPacked = async () => {
    await Promise.all(selectedOrders.filter((order) => order.status === "pending" || order.status === "packed").map((order) => onPacked(order.id)));
  };
  return (
    <section className="view orders-layout">
      <div className="panel orders-header-panel">
        <div className="orders-title"><h2>Ordenes</h2><p className="muted">Ejecucion diaria: contactar, cobrar, embalar y entregar sin saltar de pantalla.</p></div>
        <div className="orders-tools">
          <label className="orders-search"><Icon name="search" /><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Buscar comprador o carta" /></label>
          <div className="order-board-tabs">{orderBoards.map((board) => <button className={selectedBoard === board.id ? "active" : ""} key={board.id} onClick={() => setSelectedBoard(board.id)}>{board.label}<span>{board.count}</span></button>)}</div>
          <div className="orders-filters">{orderFilterOptions.map((option) => <button className={`secondary-action filter-toggle ${orderFilter === option.value ? "active" : ""}`} key={option.value} onClick={() => setOrderFilter(option.value)}>{option.label} <span>{filterCounts.get(option.value) || 0}</span></button>)}</div>
        </div>
        <div className="orders-side-info"><strong>{visibleOrders.length}/{orders.length} {showingDelivered ? "entregas" : "ordenes"}</strong><div className="orders-color-guide"><span><i className="guide-dot pending"></i>Pendiente</span><span><i className="guide-dot message"></i>Mensaje</span><span><i className="guide-dot packed"></i>Embalada</span><span><i className="guide-dot paid"></i>Pagada</span><span><i className="guide-dot delivered"></i>Entregada</span></div></div>
      </div>
      <div className="order-work-summary">
        <button type="button" onClick={() => setOrderFilter("no_message")} className={orderFilter === "no_message" ? "active" : ""}><span>Contactar</span><strong>{visibleMessagePending}</strong><small>sin mensaje</small></button>
        <button type="button" onClick={() => setOrderFilter("debt")} className={orderFilter === "debt" ? "active" : ""}><span>Cobrar</span><strong>{formatArs(visibleDebtArs)}</strong><small>saldo pendiente</small></button>
        <button type="button" onClick={() => setOrderFilter("packed")} className={orderFilter === "packed" ? "active" : ""}><span>Embaladas</span><strong>{visiblePacked}</strong><small>listas para pago/retiro</small></button>
        <button type="button" onClick={() => setOrderFilter("paid")} className={orderFilter === "paid" ? "active" : ""}><span>Entregar</span><strong>{visiblePaidReady}</strong><small>pagadas</small></button>
      </div>
      {selectedOrders.length ? (
        <section className="panel order-batch-bar">
          <div><strong>{selectedOrders.length} seleccionada(s)</strong><span>{visibleSelectedIds.length} visibles en este tablero/filtro</span></div>
          <label>Vencimiento<input type="date" value={batchDueDate} onChange={(event) => setBatchDueDate(event.target.value)} /></label>
          <button className="primary-action" disabled={!batchDueDate} onClick={() => void applyBatchDueDate()}><Icon name="check" />Fijar fecha</button>
          <button className="secondary-action" onClick={() => void markBatchMessage()}><Icon name="check" />Mensaje enviado</button>
          <button className="secondary-action" onClick={() => void markBatchPacked()}><Icon name="check" />Marcar embaladas</button>
          <button className="secondary-action" onClick={() => setSelectedOrderIds([])}><Icon name="close" />Limpiar</button>
        </section>
      ) : null}
      {visibleOrders.length ? <div className="order-list">
        <div className="order-list-header"><label><input type="checkbox" disabled={!batchableVisibleOrders.length} checked={allVisibleSelected} onChange={toggleVisibleSelection} /></label><span>Comprador</span><span>Cobro</span><span>Mensaje</span><span>Embalaje</span><span>Estado</span><span>Acciones</span></div>
        {visibleOrders.map((order) => (
          <OrderCard key={order.id} order={order} boardLabel={boardLabel(order)} blueRate={blueRate} open={openOrderIds.includes(order.id)} focused={focusedOrderId === order.id} selected={order.status !== "delivered" && selectedOrderIds.includes(order.id)} copied={copiedOrderId === order.id} onToggle={() => toggleOrder(order.id)} onSelectedChange={() => toggleSelectedOrder(order.id)} onComplete={onComplete} onCancel={onCancel} onPacked={onPacked} onDelivered={onDelivered} onPayment={onPayment} onNote={onNote} onMessageSent={(sent) => onMessageSent(order.id, sent)} onLinePacked={onLinePacked} onCopy={async () => { if (await copyToClipboard(buildClaimOrderMessage(order))) { setCopiedOrderId(order.id); if (!order.messageSentAt) await onMessageSent(order.id, true); window.setTimeout(() => setCopiedOrderId(""), 1200); } }} />
        ))}
      </div> : <EmptyState title={orders.length ? "Sin coincidencias" : showingDelivered ? "Sin entregas realizadas" : "Sin ordenes activas"} body={orders.length ? "No hay compradores ni cartas que coincidan con esa busqueda." : showingDelivered ? "Cuando marques una orden como entregada, va a quedar registrada aca como historial." : "Las reservas creadas desde Inventario / Venta aparecen aca."} />}
    </section>
  );
}

function OrderCard({ order, boardLabel, blueRate, open, focused, selected, copied, onToggle, onSelectedChange, onComplete, onCancel, onPacked, onDelivered, onPayment, onNote, onMessageSent, onLinePacked, onCopy }: { order: SaleRecord; boardLabel: string; blueRate: BlueExchangeRate; open: boolean; focused: boolean; selected: boolean; copied: boolean; onToggle: () => void; onSelectedChange: () => void; onComplete: (id: string) => Promise<void>; onCancel: (id: string) => Promise<void>; onPacked: (id: string) => Promise<void>; onDelivered: (id: string) => Promise<void>; onPayment: (id: string, amount: number, paymentDueAt?: string) => Promise<void>; onNote: (id: string, note: string) => Promise<void>; onMessageSent: (sent: boolean) => void; onLinePacked: (id: string, packed: boolean) => Promise<void>; onCopy: () => void }) {
  const [paymentDraft, setPaymentDraft] = useState("");
  const [quickPaymentOpen, setQuickPaymentOpen] = useState(false);
  const [quickPaymentMode, setQuickPaymentMode] = useState<"full" | "partial">("full");
  const [dueDraft, setDueDraft] = useState(order.paymentDueAt ? order.paymentDueAt.slice(0, 10) : "");
  const [noteDraft, setNoteDraft] = useState(order.internalNote || "");
  useEffect(() => setPaymentDraft(""), [order.id, order.amountPaidArs]);
  useEffect(() => setDueDraft(order.paymentDueAt ? order.paymentDueAt.slice(0, 10) : ""), [order.paymentDueAt]);
  useEffect(() => setNoteDraft(order.internalNote || ""), [order.id, order.internalNote]);
  const units = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const packedUnits = order.lines.filter((line) => line.packed).reduce((sum, line) => sum + line.quantity, 0);
  const allPacked = units > 0 && packedUnits === units;
  const isDelivered = order.status === "delivered";
  const canBatchSelect = order.status !== "cancelled" && !isDelivered;
  const canPack = order.status !== "cancelled" && !isDelivered;
  const canEdit = order.status !== "cancelled" && order.status !== "paid" && order.status !== "delivered";
  const paymentToAdd = Math.max(0, Number(paymentDraft) || 0);
  const nextPaid = Math.min(order.totalArs, (order.amountPaidArs || 0) + paymentToAdd);
  const remaining = Math.max(0, order.totalArs - (order.amountPaidArs || 0));
  const nextRemaining = Math.max(0, order.totalArs - nextPaid);
  const messageSent = Boolean(order.messageSentAt);
  const currentDue = order.paymentDueAt ? order.paymentDueAt.slice(0, 10) : "";
  const dueChanged = dueDraft !== currentDue;
  const statusPillClass = order.status === "pending" ? "warning" : isDelivered ? "delivered" : "ok";
  const stopClick = (event: React.MouseEvent) => event.stopPropagation();
  const requestDeleteOrder = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!canEdit) return;
    const confirmed = window.confirm(`Eliminar la orden de ${order.customerName}? Se cancela la reserva y se libera el stock.`);
    if (confirmed) void onCancel(order.id);
  };
  const openQuickPayment = (event: React.MouseEvent, mode: "full" | "partial" = "full") => {
    event.stopPropagation();
    setQuickPaymentMode(mode);
    setQuickPaymentOpen((current) => !current || quickPaymentMode !== mode);
  };
  const confirmQuickPayment = async () => {
    if (!canEdit) return;
    if (quickPaymentMode === "full") {
      await onPayment(order.id, order.totalArs, dueDraft);
      await onComplete(order.id);
    } else if (paymentToAdd > 0) {
      await onPayment(order.id, nextPaid, dueDraft);
      setPaymentDraft("");
    }
    setQuickPaymentOpen(false);
  };
  return (
    <article className={`order-card ${open ? "open" : ""} ${focused ? "focused" : ""} ${selected ? "selected" : ""} ${order.status === "cancelled" ? "cancelled" : ""} ${messageSent && order.status !== "paid" && !allPacked && !isDelivered ? "message-sent" : ""} ${order.status === "paid" ? "paid-complete" : ""} ${isDelivered ? "delivered-complete" : ""} ${order.status !== "paid" && !isDelivered && allPacked ? "packed-complete" : ""}`}>
      <div className="order-row-main" role="button" tabIndex={0} onClick={onToggle} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggle(); } }}>
        <label className="order-select-cell" onClick={stopClick}><input type="checkbox" disabled={!canBatchSelect} checked={selected} onChange={onSelectedChange} /></label>
        <div className="order-summary-main"><div className="order-title-line"><h3>{order.customerName}</h3>{open ? <span className="order-work-badge active">Abierta</span> : focused ? <span className="order-work-badge">Ultima trabajada</span> : null}</div><p>{boardLabel} - {formatDate(order.createdAt)} - {channelLabel(order.channel)}</p></div>
        <div className="order-summary-money"><MoneyStack ars={order.totalArs || null} usd={order.totalUsd || null} blueRate={blueRate} compact /><span>Pagado {formatArs(order.amountPaidArs || 0)}</span>{remaining > 0 ? <span>Resta {formatArs(remaining)}</span> : <span>Sin deuda</span>}</div>
        <div className="order-row-check-wrap" onClick={stopClick}>
          <label className={`order-row-check ${messageSent ? "checked" : ""}`}><input type="checkbox" disabled={order.status === "cancelled" || isDelivered} checked={messageSent} onChange={(event) => onMessageSent(event.target.checked)} /><span>{messageSent ? "Enviado" : "Pendiente"}</span></label>
        </div>
        <div className="order-pack-cell"><strong>{packedUnits}/{units}</strong><span>embaladas</span></div>
        <div className="order-summary-meta"><span className={`pill ${statusPillClass}`}>{saleStatusLabel(order.status)}</span>{order.paymentDueAt ? <span className="pill neutral">Vence {formatShortDate(order.paymentDueAt)}</span> : null}{order.internalNote ? <span className="pill neutral">Nota</span> : null}</div>
        <div className="order-row-actions" onClick={stopClick}>
          {!isDelivered ? <button className="secondary-action" disabled={order.status === "cancelled"} onClick={onCopy}><Icon name={copied ? "check" : "copy"} />{copied ? "Copiado" : "Mensaje"}</button> : null}
          {canEdit ? <button className="secondary-action" onClick={(event) => openQuickPayment(event, "full")}><Icon name="sales" />Pago</button> : null}
          {order.status === "paid" ? <button className="primary-action delivered-action" onClick={() => void onDelivered(order.id)}><Icon name="check" />Entrega</button> : isDelivered ? <button className="secondary-action" disabled><Icon name="check" />Entregada</button> : <button className="secondary-action" disabled title="Primero debe estar pagada"><Icon name="check" />Entrega</button>}
          {canEdit ? <button className="secondary-action danger-action order-delete-action" onClick={requestDeleteOrder}><Icon name="close" />Eliminar</button> : null}
        </div>
      </div>
      {quickPaymentOpen ? (
        <div className="quick-payment-panel">
          <div className="quick-payment-header"><strong>Registrar pago</strong><button className="remove-action" onClick={() => setQuickPaymentOpen(false)} aria-label="Cerrar pago"><Icon name="close" /></button></div>
          <div className="quick-payment-modes">
            <button className={quickPaymentMode === "full" ? "active" : ""} onClick={() => setQuickPaymentMode("full")}>Pago completo</button>
            <button className={quickPaymentMode === "partial" ? "active" : ""} onClick={() => setQuickPaymentMode("partial")}>Pago parcial</button>
          </div>
          <div className="quick-payment-fields">
            {quickPaymentMode === "partial" ? <label>Monto recibido<input type="number" min={0} value={paymentDraft} onChange={(event) => setPaymentDraft(event.target.value)} placeholder="Monto a sumar" /></label> : <div className="quick-full-total"><span>Total a cobrar</span><MoneyStack ars={order.totalArs || null} usd={order.totalUsd || null} blueRate={blueRate} compact /></div>}
            <label>Fecha limite<input type="date" value={dueDraft} onChange={(event) => setDueDraft(event.target.value)} /></label>
          </div>
          <button className="primary-action" disabled={quickPaymentMode === "partial" && paymentToAdd <= 0} onClick={() => void confirmQuickPayment()}><Icon name="check" />Confirmar {quickPaymentMode === "full" ? "pago completo" : "pago parcial"}</button>
        </div>
      ) : null}
      {open ? (
        <div className="order-detail">
          <div className="order-detail-strip">
            <div><strong>Seguimiento</strong><span>{messageSent ? "Mensaje enviado" : "Mensaje pendiente"} / {packedUnits}/{units} embaladas</span></div>
            <div className="order-detail-strip-actions">
              <label className={`order-message-check ${messageSent ? "checked" : ""}`}><input type="checkbox" disabled={order.status === "cancelled" || isDelivered} checked={messageSent} onChange={(event) => onMessageSent(event.target.checked)} /><span>Mensaje enviado</span></label>
              {canEdit ? <button className="secondary-action" onClick={onCopy}><Icon name={copied ? "check" : "copy"} />{copied ? "Copiado" : "Copiar mensaje"}</button> : null}
              {canPack ? <button className="secondary-action" onClick={() => onPacked(order.id)}><Icon name="check" />Marcar embalada</button> : null}
            </div>
          </div>
          <div className="order-work-grid">
            <section className="order-work-panel order-payment-panel">
              <div className="order-panel-heading"><h4>Pago</h4><div className="order-payment-badges"><span>Pagado <strong>{formatArs(order.amountPaidArs || 0)}</strong></span><span>Resta <strong>{formatArs(remaining)}</strong></span>{paymentToAdd > 0 ? <span>Quedaria <strong>{formatArs(nextRemaining)}</strong></span> : null}</div></div>
              <div className="order-payment-grid">
                <label className="order-payment-field"><span>Seña / pago recibido</span><input type="number" min={0} placeholder="Monto a sumar" value={paymentDraft} onChange={(event) => setPaymentDraft(event.target.value)} /></label>
                <label className="order-payment-field"><span>Fecha limite de pago</span><input type="date" value={dueDraft} onChange={(event) => setDueDraft(event.target.value)} /></label>
              </div>
              <div className="order-panel-footer payment-actions">
                <button className="secondary-action" disabled={!canEdit || !dueChanged} onClick={() => onPayment(order.id, order.amountPaidArs || 0, dueDraft)}><Icon name="check" />Fijar fecha</button>
                <button className="primary-action" disabled={!canEdit || paymentToAdd <= 0} onClick={() => { onPayment(order.id, nextPaid, dueDraft); setPaymentDraft(""); }}><Icon name="check" />Registrar pago</button>
              </div>
            </section>
            <section className="order-work-panel order-note-box">
              <div className="order-panel-heading"><h4>Nota interna</h4><span>Solo equipo</span></div>
              <label className="order-payment-field"><textarea rows={2} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Ej.: correo, retiro, entrega..." /></label>
              <div className="order-panel-footer"><button className="secondary-action" disabled={noteDraft === (order.internalNote || "")} onClick={() => onNote(order.id, noteDraft)}><Icon name="check" />Guardar nota</button></div>
            </section>
          </div>
          <section className="order-work-panel order-items-panel">
            <div className="order-panel-heading"><h4>Cartas</h4><span>{packedUnits}/{units} embaladas</span></div>
            <div className="order-lines">{order.lines.map((line) => <label className={`order-line ${line.packed ? "packed" : ""}`} key={line.saleItemId || `${order.id}-${line.inventoryItemId}-${line.name}`}><input type="checkbox" disabled={!canPack || !line.saleItemId} checked={line.packed} onChange={(event) => onLinePacked(line.saleItemId, event.target.checked)} /><CardArt src={line.imageUrl} alt={line.name} label={line.name} className="order-line-image" fallbackClassName="order-line-image order-line-image-placeholder" /><span>{line.quantity} x {line.name}</span><MoneyStack ars={line.lineTotalArs || null} usd={line.lineTotalUsd || null} blueRate={blueRate} compact /></label>)}</div>
          </section>
          <div className="order-actions">{canEdit ? <><button className="secondary-action danger-action" onClick={requestDeleteOrder}><Icon name="close" />Eliminar orden</button><button className="primary-action" onClick={() => onComplete(order.id)}><Icon name="check" />Marcar pagada</button></> : null}{order.status === "paid" ? <button className="primary-action delivered-action" onClick={() => onDelivered(order.id)}><Icon name="check" />Entregado</button> : null}</div>
        </div>
      ) : null}
    </article>
  );
}

function SalesView({ sales, purchases, items, blueRate }: { sales: SaleRecord[]; purchases: PurchaseRecord[]; items: StockRow[]; blueRate: BlueExchangeRate }) {
  const paid = sales.filter((sale) => sale.status === "paid" || sale.status === "delivered");
  const receivables = sales.filter((sale) => sale.status !== "cancelled" && Math.max(0, sale.totalArs - (sale.amountPaidArs || 0)) > 0);
  const totalCollected = paid.reduce((sum, sale) => sum + (sale.amountPaidArs || sale.totalArs), 0);
  const totalReceivable = receivables.reduce((sum, sale) => sum + Math.max(0, sale.totalArs - (sale.amountPaidArs || 0)), 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const overdueReceivables = receivables.filter((sale) => sale.paymentDueAt && new Date(sale.paymentDueAt) < todayStart);
  const purchaseTotal = purchases.filter((purchase) => purchase.status !== "cancelled").reduce((sum, purchase) => sum + purchase.totalArs, 0);
  const estimatedCash = totalCollected - purchaseTotal;
  const stockSaleValue = items.reduce((sum, item) => sum + (item.priceArs || toBlueArs(item.priceUsd, blueRate)) * Math.max(0, item.availableQuantity), 0);
  const reservedSaleValue = items.reduce((sum, item) => sum + (item.priceArs || toBlueArs(item.priceUsd, blueRate)) * Math.max(0, item.quantityReserved), 0);
  const stockCostValue = items.reduce((sum, item) => sum + (item.lastPurchaseArs || 0) * Math.max(0, item.quantityOnHand), 0);
  const stockUnits = items.reduce((sum, item) => sum + item.quantityOnHand, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthly = paid.filter((sale) => new Date(sale.completedAt || sale.createdAt) >= monthStart);
  const channelTotals = [...new Set(paid.map((sale) => sale.channel))].map((channel) => ({ channel, total: paid.filter((sale) => sale.channel === channel).reduce((sum, sale) => sum + sale.totalArs, 0), totalUsd: paid.filter((sale) => sale.channel === channel).reduce((sum, sale) => sum + sale.totalUsd, 0) })).sort((a, b) => (b.total + toBlueArs(b.totalUsd, blueRate)) - (a.total + toBlueArs(a.totalUsd, blueRate)));
  const recentLines = paid
    .flatMap((sale) => sale.lines.map((line) => ({ sale, line })))
    .sort((left, right) => new Date(right.sale.completedAt || right.sale.createdAt).getTime() - new Date(left.sale.completedAt || left.sale.createdAt).getTime())
    .slice(0, 12);
  return (
    <section className="view sales-dashboard">
      <section className="panel cash-hero">
        <div>
          <p className="eyebrow">Caja</p>
          <h2>Resumen financiero operativo</h2>
          <p>Cobros, deuda de clientes, compras registradas y stock valorizado sin mezclar conceptos.</p>
        </div>
        <div className="cash-hero-total"><span>Caja estimada</span><strong>{formatArs(estimatedCash)}</strong><small>cobrado - compras registradas</small></div>
      </section>
      <div className="cash-metrics">
        <Metric label="Balance operativo" value={formatArs(estimatedCash)} helper="cobros menos compras" />
        <Metric label="Cobrado total" value={formatArs(totalCollected)} helper={`${paid.length} venta(s) cobradas`} />
        <Metric label="A cobrar" value={formatArs(totalReceivable)} helper={`${receivables.length} orden(es), ${overdueReceivables.length} vencida(s)`} />
        <Metric label="Compras registradas" value={formatArs(purchaseTotal)} helper="salida/compromiso cargado" />
        <Metric label="Stock disponible" value={formatArs(stockSaleValue)} helper={`${stockUnits.toLocaleString("es-AR")} unidad(es) fisicas`} />
        <Metric label="Reservado" value={formatArs(reservedSaleValue)} helper="valor de cartas separadas" />
        <Metric label="Costo registrado" value={formatArs(stockCostValue)} helper="segun ultima compra cargada" />
      </div>
      <div className="cash-grid">
        <section className="panel cash-section">
          <div className="section-heading"><div><h2>Deudas a cobrar</h2><p>Ordenes abiertas con saldo pendiente.</p></div></div>
          {receivables.length ? <div className="cash-row-list">{receivables.slice(0, 10).map((sale) => {
            const remaining = Math.max(0, sale.totalArs - (sale.amountPaidArs || 0));
            return <article className="cash-row debt-row" key={sale.id}><div><strong>{sale.customerName}</strong><span>{sale.lines.reduce((sum, line) => sum + line.quantity, 0)} carta(s) - {channelLabel(sale.channel)}</span><small>{sale.paymentDueAt ? `Vence ${formatShortDate(sale.paymentDueAt)}` : "Sin fecha limite"}</small></div><MoneyStack ars={remaining} blueRate={blueRate} compact /></article>;
          })}</div> : <EmptyState title="Sin deuda a cobrar" body="No hay ordenes pendientes con saldo." />}
        </section>
        <section className="panel cash-section">
          <div className="section-heading"><div><h2>Deudas a pagar</h2><p>Por ahora se calcula sobre compras registradas. Falta seguimiento de pago a proveedores.</p></div></div>
          {purchases.length ? <div className="cash-row-list">{purchases.filter((purchase) => purchase.status !== "cancelled").slice(0, 10).map((purchase) => <article className="cash-row payable-row" key={purchase.id}><div><strong>{purchase.sellerName}</strong><span>{purchase.lines.reduce((sum, line) => sum + line.quantity, 0)} unidad(es) - {formatDate(purchase.createdAt)}</span><small>{purchase.note || "Sin nota"}</small></div><MoneyStack ars={purchase.totalArs} blueRate={blueRate} compact /></article>)}</div> : <EmptyState title="Sin compras" body="Registra compras para ver compromisos a pagar." />}
        </section>
      </div>
      <div className="sales-grid">
        <section className="panel"><div className="section-heading"><div><h2>Ultimas cartas vendidas</h2><p>Precios finales, cliente y lugar de venta.</p></div></div>{recentLines.length ? <div className="sold-card-list">{recentLines.map(({ sale, line }) => <article className="sold-card-row" key={`${sale.id}-${line.saleItemId || line.inventoryItemId}-${line.name}`}><CardArt src={line.imageUrl} alt={line.name} label={line.name} className="sold-card-thumb" fallbackClassName="sold-card-thumb image-placeholder" /><div><strong>{line.name}</strong><span>{sale.customerName} - {channelLabel(sale.channel)}</span><small>{formatDate(sale.completedAt || sale.createdAt)}</small></div><div><MoneyStack ars={line.lineTotalArs || null} usd={line.lineTotalUsd || null} blueRate={blueRate} compact /><span>{line.quantity} x {line.priceCurrency === "USD" ? formatUsd(line.unitPriceUsd) : formatArs(line.unitPriceArs)}</span></div></article>)}</div> : <EmptyState title="Sin ventas" body="Confirma una venta desde Inventario / Venta para verla aca." />}</section>
        <aside className="panel sales-side"><h3>Ventas por lugar</h3>{channelTotals.length ? channelTotals.map((row) => <div className="channel-row" key={row.channel}><strong>{channelLabel(row.channel)}</strong><MoneyStack ars={row.total || null} usd={row.totalUsd || null} blueRate={blueRate} compact /></div>) : <p className="muted">Todavia no hay ventas cobradas.</p>}<div className="cash-note"><strong>Mes actual</strong><span>{formatArs(monthly.reduce((sum, sale) => sum + sale.totalArs, 0))}</span><small>Ticket promedio {formatArs(paid.length ? paid.reduce((sum, sale) => sum + sale.totalArs, 0) / paid.length : 0)}</small></div></aside>
      </div>
    </section>
  );
}

function ClaimsView(props: {
  workspace: ClaimsWorkspace;
  priceChartingCache: { entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus };
  blueRate: BlueExchangeRate;
  claimImageSearching: boolean;
  claimCardImageSearching: string;
  claimPriceRefreshing: boolean;
  onCreateClaim: (name: string) => void;
  onUpdateClaimSettings: (patch: { paymentDueAt?: string }) => void;
  onSearchPriceCharting: (search: string) => void;
  onAddCards: (ids: string[], sectionId?: string) => void;
  onUpdateCard: (cardId: string, patch: Partial<Pick<ClaimCard, "sectionId" | "finalPriceArs" | "finalPriceUsd" | "finalName" | "imageUrl" | "buyer" | "quantity" | "tags" | "status">>) => void;
  onDeleteCard: (cardId: string) => void;
  onSearchCardImage: (cardId: string) => void;
  onCreateSection: (name: string) => void;
  onUpdateSection: (sectionId: string, patch: { name?: string; direction?: "up" | "down" }) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddFree: (input: Partial<ClaimFree> & { quantity: number }) => void;
  onExportClaimCsv: () => void;
  onExportOrders: () => void;
  onGenerateGrid: () => void;
  onSearchClaimImages: () => void;
  onRefreshClaimPrices: () => void;
  onStartLive: () => void;
  onCloseClaim: () => void;
  onArchiveClaim: () => void;
}) {
  const [claimName, setClaimName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPriceChartingIds, setSelectedPriceChartingIds] = useState<string[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<string[]>([]);
  const [claimSearch, setClaimSearch] = useState("");
  const [claimPriceFilter, setClaimPriceFilter] = useState<"all" | "missing_price" | "buyer_missing_price" | "missing_buyer">("all");
  const [free, setFree] = useState({ buyer: "", finalName: "", quantity: 1, tags: "", notes: "" });
  const active = props.workspace.activeClaim;
  const summary = props.workspace.summary;
  const sections = props.workspace.sections;
  const claimSearchQuery = parseUiSearchQuery(claimSearch);
  const sectionNames = useMemo(() => new Map(sections.map((section) => [section.id, section.name])), [sections]);
  const visibleClaimCards = props.workspace.cards.filter((card) => {
    const matchesSearch = claimSearchQuery.tokens.length ? matchesClaimSearch(card, claimSearchQuery, sectionNames.get(card.sectionId) || "Sin seccion") : true;
    const hasPrice = card.finalPriceArs > 0 || card.finalPriceUsd > 0;
    const hasBuyer = Boolean(card.buyer.trim());
    const matchesFilter =
      claimPriceFilter === "all" ||
      (claimPriceFilter === "missing_price" && !hasPrice) ||
      (claimPriceFilter === "buyer_missing_price" && hasBuyer && !hasPrice) ||
      (claimPriceFilter === "missing_buyer" && !hasBuyer);
    return matchesSearch && matchesFilter;
  });
  const claimRunCards = useMemo(() => orderedClaimCardsForRun(props.workspace.cards, sections), [props.workspace.cards, sections]);
  useEffect(() => {
    if (selectedSectionId && !sections.some((section) => section.id === selectedSectionId)) setSelectedSectionId("");
  }, [sections, selectedSectionId]);
  const sectionBuckets = [
    ...sections.map((section) => ({ id: section.id, name: section.name, cards: visibleClaimCards.filter((card) => card.sectionId === section.id) })),
    { id: "", name: "Sin seccion", cards: visibleClaimCards.filter((card) => !card.sectionId) }
  ].filter((section) => claimSearchQuery.tokens.length ? section.cards.length : section.id || section.cards.length || !sections.length);
  const canClose = Boolean(active && summary.buyers > 0 && summary.missingPrices === 0);
  const togglePriceCharting = (id: string) => {
    setSelectedPriceChartingIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };
  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSectionIds((current) => current.includes(sectionId) ? current.filter((value) => value !== sectionId) : [...current, sectionId]);
  };
  const addSelected = () => {
    props.onAddCards(selectedPriceChartingIds, selectedSectionId);
    setSelectedPriceChartingIds([]);
  };
  return (
    <section className="view claims-layout">
      <section className="panel claims-hero">
        <div className="claims-hero-left">
          <p className="eyebrow">Claims</p>
          <h2>{active ? active.name : "Sin claim activo"}</h2>
          <p className="muted">{active ? `${summary.cardsWithBuyer} vendidas a ${summary.buyers} compradores` : "Crea un workspace propio para preparar el proximo claim."}</p>
        </div>
        <div className="claims-hero-right">
          {active ? (
            <>
              <button className="primary-action" disabled={!claimRunCards.length} onClick={props.onStartLive}><Icon name="play" />Comenzar claim</button>
              <label className="claim-editor-field claim-due-field"><span>Fecha limite de pago</span><input type="date" value={active.paymentDueAt ? active.paymentDueAt.slice(0, 10) : ""} onChange={(event) => props.onUpdateClaimSettings({ paymentDueAt: event.target.value })} /></label>
              <button className="secondary-action" disabled={props.claimPriceRefreshing} onClick={props.onRefreshClaimPrices}><Icon name="refresh" />{props.claimPriceRefreshing ? "Actualizando..." : "Actualizar precios"}</button>
              <button className="secondary-action" disabled={props.claimImageSearching} onClick={props.onSearchClaimImages}><Icon name="search" />{props.claimImageSearching ? "Buscando..." : "Buscar imagenes"}</button>
              <button className="secondary-action" onClick={props.onGenerateGrid}><Icon name="image" />Grilla 5x6</button>
              <button className="secondary-action" onClick={props.onExportClaimCsv}><Icon name="download" />Exportar CSV</button>
              <button className="secondary-action" disabled={!canClose} onClick={props.onExportOrders}><Icon name="download" />Exportar ordenes</button>
              <button className="primary-action" disabled={!canClose} onClick={props.onCloseClaim}><Icon name="close" />Cerrar claim</button>
              <button className="secondary-action danger-action" onClick={props.onArchiveClaim}><Icon name="close" />Cancelar claim</button>
              {summary.missingPrices ? <span className="quality-warning">{summary.missingPrices} con comprador sin precio</span> : null}
            </>
          ) : (
            <form className="claim-create-form" onSubmit={(event) => { event.preventDefault(); props.onCreateClaim(claimName); setClaimName(""); }}>
              <input value={claimName} onChange={(event) => setClaimName(event.target.value)} placeholder="Nombre opcional, ej. Claim viernes" />
              <button className="primary-action"><Icon name="plus" />Nuevo claim</button>
            </form>
          )}
        </div>
      </section>

      <section className="claims-metrics">
        <Metric label="Cartas" value={summary.cards} helper="en mesa" />
        <Metric label="Compradores" value={summary.buyers} helper="con nombre" />
        <Metric label="Vendido ARS" value={formatArs(summary.totalArs)} helper="asignado" />
        <Metric label="Vendido USD" value={formatUsd(summary.totalUsd)} helper="asignado" />
        <Metric label="Claim ARS" value={formatArs(summary.claimTotalArs)} helper="total mesa" />
        <Metric label="Claim USD" value={formatUsd(summary.claimTotalUsd)} helper="total mesa" />
        <Metric label="Frees" value={summary.frees} helper="unidades" />
        <Metric label="Sin imagen" value={summary.missingImages} helper="no entran al grid" />
      </section>

      {active ? (
        <div className="claims-workspace">
          <section className="panel claim-review-panel">
            <div className="section-heading claim-review-heading">
              <div><h3>Mesa de revision</h3><p>Precio final, comprador y tags antes de cerrar.</p></div>
              <div className="claim-search-tools">
                <label className="claim-search-field">
                  <Icon name="search" />
                  <input value={claimSearch} onChange={(event) => setClaimSearch(event.target.value)} placeholder="Buscar carta, tag o comprador" />
                </label>
                <label className="claim-filter-field">
                  <Icon name="filter" />
                  <select value={claimPriceFilter} onChange={(event) => setClaimPriceFilter(event.target.value as typeof claimPriceFilter)}>
                    <option value="all">Todas</option>
                    <option value="missing_price">Sin precio</option>
                    <option value="buyer_missing_price">Vendidas sin precio</option>
                    <option value="missing_buyer">Sin comprador</option>
                  </select>
                </label>
                {claimSearch || claimPriceFilter !== "all" ? <button className="secondary-action" onClick={() => { setClaimSearch(""); setClaimPriceFilter("all"); }}>Limpiar</button> : null}
                {claimSearchQuery.tokens.length || claimPriceFilter !== "all" ? <span className="claim-search-count">{visibleClaimCards.length}/{props.workspace.cards.length}</span> : null}
              </div>
            </div>
            {props.workspace.cards.length ? (
              sectionBuckets.length ? (
                <div className="claim-card-list">
                  {sectionBuckets.map((section, index) => {
                    const sectionKey = section.id || "unsectioned";
                    const isCollapsed = !claimSearchQuery.tokens.length && collapsedSectionIds.includes(sectionKey);
                    return (
                    <section className="claim-section-block" key={sectionKey}>
                      <div className="claim-section-header">
                        <div>
                          <h4>{section.name}</h4>
                          <span>{section.cards.length} carta(s)</span>
                        </div>
                        <div className="claim-section-actions">
                          <button className="secondary-action" aria-expanded={!isCollapsed} onClick={() => toggleSectionCollapsed(sectionKey)}>{isCollapsed ? "Mostrar" : "Ocultar"}</button>
                          {section.id ? (
                            <>
                              <button className="secondary-action" disabled={index === 0} onClick={() => props.onUpdateSection(section.id, { direction: "up" })}>Subir</button>
                              <button className="secondary-action" disabled={index === sections.length - 1} onClick={() => props.onUpdateSection(section.id, { direction: "down" })}>Bajar</button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {isCollapsed ? null : section.cards.length ? section.cards.map((card) => <ClaimCardRow key={card.id} card={card} sections={sections} blueRate={props.blueRate} imageSearching={props.claimCardImageSearching === card.id} onUpdate={props.onUpdateCard} onDelete={props.onDeleteCard} onSearchImage={props.onSearchCardImage} />) : <p className="muted">Todavia no hay cartas en esta seccion.</p>}
                    </section>
                    );
                  })}
                </div>
              ) : <EmptyState title="Sin resultados" body="No encontre cartas con esa busqueda." />
            ) : <EmptyState title="Claim vacio" body="Busca cartas en PriceCharting y agregalas a esta mesa." />}
          </section>

          <aside className="claims-side">
            <section className="panel claim-sections-panel">
              <div className="section-heading compact-heading">
                <div><h3>Secciones</h3><p>Ordenan como sale el claim.</p></div>
              </div>
              <form className="claim-section-form" onSubmit={(event) => {
                event.preventDefault();
                props.onCreateSection(newSectionName);
                setNewSectionName("");
              }}>
                <input value={newSectionName} onChange={(event) => setNewSectionName(event.target.value)} placeholder="Ej. Trainer gallery, promos..." />
                <button className="secondary-action" type="submit"><Icon name="plus" />Crear</button>
              </form>
              <div className="claim-section-list">
                {sections.length ? sections.map((section, index) => (
                  <div key={section.id}>
                    <button className={selectedSectionId === section.id ? "active" : ""} onClick={() => setSelectedSectionId(section.id)}>{section.name}</button>
                    <span>{props.workspace.cards.filter((card) => card.sectionId === section.id).length}</span>
                    <button disabled={index === 0} onClick={() => props.onUpdateSection(section.id, { direction: "up" })}>Arriba</button>
                    <button disabled={index === sections.length - 1} onClick={() => props.onUpdateSection(section.id, { direction: "down" })}>Abajo</button>
                    <button className="danger-text-action" onClick={() => {
                      if (window.confirm("Eliminar esta seccion? Las cartas quedaran sin seccion.")) props.onDeleteSection(section.id);
                    }}>Eliminar</button>
                  </div>
                )) : <p className="muted">Crea secciones para separar cargas.</p>}
                <button className={`claim-unsectioned-button ${selectedSectionId === "" ? "active" : ""}`} onClick={() => setSelectedSectionId("")}>Sin seccion</button>
              </div>
            </section>
            <section className="panel claim-loader">
              <div className="section-heading compact-heading">
                <div><h3>Agregar desde PriceCharting</h3><p>Busca y suma cartas al claim activo.</p></div>
                <strong>{props.priceChartingCache.status.totalEntries.toLocaleString("es-AR")} en cache</strong>
              </div>
              <label className="claim-section-select">Cargar en seccion
                <select value={selectedSectionId} onChange={(event) => setSelectedSectionId(event.target.value)}>
                  <option value="">Sin seccion</option>
                  {sections.map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}
                </select>
              </label>
              <form className="cache-search" onSubmit={(event) => { event.preventDefault(); props.onSearchPriceCharting(search); }}>
                <label>Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, expansion, numero o ID" /></label>
                <button className="primary-action" type="submit"><Icon name="search" />Buscar</button>
              </form>
              {selectedPriceChartingIds.length > 0 && (
                <button className="primary-action" disabled={!selectedPriceChartingIds.length} onClick={addSelected}>
                  <Icon name="plus" />Agregar seleccionadas ({selectedPriceChartingIds.length})
                </button>
              )}
              <div className="claim-pc-results">
                {props.priceChartingCache.entries.slice(0, 12).map((entry) => (
                  <button className={`claim-pc-row ${selectedPriceChartingIds.includes(entry.priceChartingId) ? "selected" : ""}`} key={entry.priceChartingId} onClick={() => togglePriceCharting(entry.priceChartingId)}>
                    {entry.imageUrl ? <img src={assetUrl(entry.imageUrl)} alt="" /> : <div className="image-placeholder compact-placeholder">PC</div>}
                    <div>
                      <strong>{entry.productName}</strong>
                      <span>{entry.expansionName} {entry.cardNumber ? `#${entry.cardNumber}` : ""}</span>
                      <MoneyStack usd={entry.loosePriceUsd} blueRate={props.blueRate} compact />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel claim-frees-panel">
              <h3>Frees</h3>
              <form className="claim-free-form" onSubmit={(event) => {
                event.preventDefault();
                props.onAddFree(free);
                setFree({ buyer: "", finalName: "", quantity: 1, tags: "", notes: "" });
              }}>
                <input value={free.buyer} onChange={(event) => setFree((current) => ({ ...current, buyer: event.target.value }))} placeholder="Comprador" required />
                <input value={free.finalName} onChange={(event) => setFree((current) => ({ ...current, finalName: event.target.value }))} placeholder="Free / carta" required />
                <input type="number" min={1} value={free.quantity} onChange={(event) => setFree((current) => ({ ...current, quantity: Math.max(1, Number(event.target.value)) }))} placeholder="Cantidad" />
                <input value={free.tags} onChange={(event) => setFree((current) => ({ ...current, tags: event.target.value }))} placeholder="Tags" />
                <button className="secondary-action" type="submit"><Icon name="plus" />Agregar free</button>
              </form>
              <div className="claim-free-list">
                {props.workspace.frees.length ? props.workspace.frees.map((item) => (
                  <div key={item.id}>
                    <strong>{item.buyer}</strong>
                    <span>{item.quantity} x {item.finalName}</span>
                  </div>
                )) : <p className="muted">Sin frees cargados.</p>}
              </div>
            </section>

            <section className="panel claim-history-panel">
              <h3>Historial</h3>
              {props.workspace.history.length ? props.workspace.history.map((claim) => (
                <div className="compact-activity-row" key={claim.id}>
                  <strong>{claim.name}</strong>
                  <span>{claim.cards} cartas - {claim.buyers} compradores</span>
                  <MoneyStack ars={claim.totalArs} usd={claim.totalUsd} blueRate={props.blueRate} compact />
                </div>
              )) : <p className="muted">Todavia no hay claims cerrados.</p>}
            </section>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function ClaimCardRow({ card, sections, blueRate, imageSearching, onUpdate, onDelete, onSearchImage }: { card: ClaimCard; sections: ClaimSection[]; blueRate: BlueExchangeRate; imageSearching: boolean; onUpdate: (cardId: string, patch: Partial<Pick<ClaimCard, "sectionId" | "finalPriceArs" | "finalPriceUsd" | "finalName" | "imageUrl" | "buyer" | "quantity" | "tags" | "status">>) => void; onDelete: (cardId: string) => void; onSearchImage: (cardId: string) => void }) {
  const [draft, setDraft] = useState(() => claimCardDraft(card));
  const [copiedName, setCopiedName] = useState(false);
  useEffect(() => setDraft(claimCardDraft(card)), [card.id, card.finalPriceArs, card.finalPriceUsd, card.finalName, card.buyer, card.quantity, card.tags, card.status]);
  const save = (patch: Partial<Pick<ClaimCard, "sectionId" | "finalPriceArs" | "finalPriceUsd" | "finalName" | "imageUrl" | "buyer" | "quantity" | "tags" | "status">>) => onUpdate(card.id, patch);
  const draftQuantity = Math.max(1, Math.floor(Number(draft.quantity) || 1));
  const generatedName = claimDisplayNameWithQuantity(draft.finalName || claimFinalName(card, Number(draft.finalPriceArs), Number(draft.finalPriceUsd)), draftQuantity);
  const buyerSlots = claimBuyerSlotsForUi(draft.buyer, draftQuantity);
  const updateBuyerSlot = (index: number, value: string) => {
    const next = [...buyerSlots];
    next[index] = value;
    setDraft((current) => ({ ...current, buyer: claimBuyerSlotsValue(next) }));
  };
  const copyName = async () => {
    if (await copyToClipboard(generatedName)) {
      setCopiedName(true);
      window.setTimeout(() => setCopiedName(false), 1100);
    }
  };
  const correctImage = () => {
    const imageUrl = window.prompt("Pega una URL directa de imagen o el link de PriceCharting de esta carta:", card.imageUrl || "");
    if (imageUrl === null) return;
    save({ imageUrl: imageUrl.trim() });
  };
  return (
    <article className={`claim-card-row ${card.status === "ignored" ? "ignored" : ""}`} key={card.id}>
      <div className="claim-card-media">
        {card.imageUrl ? (
          <img src={assetUrl(card.imageUrl)} alt="" />
        ) : (
          <div className="image-placeholder compact-placeholder">CL</div>
        )}
      </div>
      <div className="claim-card-info">
        <strong>{card.productName}</strong>
        <span>{card.expansionName} {card.cardNumber ? `#${card.cardNumber}` : ""}</span>
        <small>ID {card.priceChartingId}</small>
        {card.quantity > 1 ? <small>{card.quantity} unidades</small> : null}
        <div className="claim-card-prices">
          <MoneyStack usd={card.pcPriceUsd} blueRate={blueRate} compact label="PC" />
          <MoneyStack ars={card.suggestedArs} blueRate={blueRate} compact label="Sugerido" />
        </div>
        <em>{generatedName}</em>
      </div>
      <div className="claim-card-editor">
        <label className="claim-editor-field">
          <span>Precio ARS</span>
          <input value={draft.finalPriceArs} onChange={(event) => setDraft((current) => ({ ...current, finalPriceArs: event.target.value }))} onBlur={() => save({ finalPriceArs: Number(draft.finalPriceArs) || 0 })} placeholder="ARS" />
        </label>
        <label className="claim-editor-field">
          <span>Precio USD</span>
          <input value={draft.finalPriceUsd} onChange={(event) => setDraft((current) => ({ ...current, finalPriceUsd: event.target.value }))} onBlur={() => save({ finalPriceUsd: Number(draft.finalPriceUsd) || 0 })} placeholder="USD" />
        </label>
        <div className="claim-editor-field claim-buyer-slots">
          <span>Compradores por unidad</span>
          <div className="claim-buyer-slot-grid">
            {buyerSlots.map((buyer, index) => <label className="claim-buyer-slot" key={`${card.id}-buyer-${index}`}><small>#{index + 1}</small><input value={buyer} onChange={(event) => updateBuyerSlot(index, event.target.value)} onBlur={() => save({ buyer: claimBuyerSlotsValue(claimBuyerSlotsForUi(draft.buyer, draftQuantity)) })} placeholder="Sin comprador" /></label>)}
          </div>
        </div>
        <label className="claim-editor-field">
          <span>Unidades</span>
          <input type="number" min={1} value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value, buyer: claimBuyerSlotsValue(claimBuyerSlotsForUi(current.buyer, Math.max(1, Math.floor(Number(event.target.value) || 1)))) }))} onBlur={() => { const quantity = Math.max(1, Math.floor(Number(draft.quantity) || 1)); save({ quantity, buyer: claimBuyerSlotsValue(claimBuyerSlotsForUi(draft.buyer, quantity)) }); }} placeholder="1" />
        </label>
        <label className="claim-editor-field">
          <span>Tags</span>
          <input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} onBlur={() => save({ tags: draft.tags })} placeholder="Etiquetas" />
        </label>
        <label className="claim-editor-field claim-editor-field--wide">
          <span>Nombre final (opcional)</span>
          <input value={draft.finalName} onChange={(event) => setDraft((current) => ({ ...current, finalName: event.target.value }))} onBlur={() => save({ finalName: draft.finalName })} placeholder="Sobreescribe el nombre generado" />
        </label>
        <label className="claim-editor-field claim-editor-field--wide">
          <span>Seccion</span>
          <select value={card.sectionId} onChange={(event) => save({ sectionId: event.target.value })}>
            <option value="">Sin seccion</option>
            {sections.map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}
          </select>
        </label>
      </div>
      <div className="claim-card-actions">
        {!card.imageUrl ? (
          <button className="secondary-action" disabled={imageSearching} onClick={() => onSearchImage(card.id)}>
            <Icon name="image" />{imageSearching ? "Buscando..." : "Buscar imagen"}
          </button>
        ) : null}
        <button className="secondary-action" onClick={correctImage}>
          <Icon name="image" />Corregir imagen
        </button>
        <button className="secondary-action" onClick={copyName}>
          <Icon name={copiedName ? "check" : "copy"} />{copiedName ? "Copiado" : "Copiar nombre"}
        </button>
        <button className="secondary-action" onClick={() => { setDraft((current) => ({ ...current, finalPriceArs: String(card.suggestedArs || "") })); save({ finalPriceArs: card.suggestedArs }); }}>
          <Icon name="check" />Usar sugerido
        </button>
        <button className={`secondary-action ${card.status === "ignored" ? "primary-action" : ""}`} onClick={() => save({ status: card.status === "ignored" ? "draft" : "ignored" })}>
          <Icon name={card.status === "ignored" ? "refresh" : "close"} />{card.status === "ignored" ? "Restaurar" : "Ignorar"}
        </button>
        <button className="secondary-action danger-action" onClick={() => {
          if (window.confirm("Eliminar esta carta del claim?")) onDelete(card.id);
        }}>
          <Icon name="close" />Eliminar
        </button>
      </div>
    </article>
  );
}

function ClaimLiveView({ workspace, blueRate, onGoClaims }: { workspace: ClaimsWorkspace; blueRate: BlueExchangeRate; onGoClaims: () => void }) {
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState<"name" | "tags" | null>(null);
  const active = workspace.activeClaim;
  const cards = useMemo(() => orderedClaimCardsForRun(workspace.cards, workspace.sections), [workspace.cards, workspace.sections]);
  const sectionNames = useMemo(() => new Map(workspace.sections.map((section) => [section.id, section.name])), [workspace.sections]);
  const card = cards[index] || cards[0];
  const finalName = card ? card.finalName || claimFinalName(card, card.finalPriceArs, card.finalPriceUsd) : "";
  const tags = card?.tags?.trim() || "";
  const tagList = tags.split(/[,\s]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 12);
  const copyRunText = async (kind: "name" | "tags", value: string) => {
    if (!value || !(await copyToClipboard(value))) return;
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1100);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!cards.length) return;
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(current - 1, 0));
      if (event.key === "ArrowRight") setIndex((current) => Math.min(current + 1, cards.length - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cards.length]);
  useEffect(() => {
    if (index >= cards.length) setIndex(Math.max(cards.length - 1, 0));
  }, [cards.length, index]);
  if (!active) {
    return (
      <section className="view claim-live-view">
        <section className="panel claim-live-empty">
          <EmptyState title="Sin claim activo" body="Crea o activa un claim desde Claims antes de trabajar en vivo." />
          <button className="primary-action" onClick={onGoClaims}><Icon name="claims" />Ir a Claims</button>
        </section>
      </section>
    );
  }
  if (!card) {
    return (
      <section className="view claim-live-view">
        <section className="panel claim-live-empty">
          <EmptyState title="Claim sin cartas" body="Agrega cartas al claim activo para empezar." />
          <button className="primary-action" onClick={onGoClaims}><Icon name="claims" />Organizar claim</button>
        </section>
      </section>
    );
  }
  return (
    <section className="view claim-live-view">
      <section className="claim-run-modal claim-live-panel">
        <header className="claim-run-header claim-live-header">
          <div>
            <p className="eyebrow">Claim en vivo</p>
            <h2>{active.name}</h2>
            <p>{index + 1} de {cards.length} - {sectionNames.get(card.sectionId) || "Sin seccion"}</p>
          </div>
          <button className="secondary-action" onClick={onGoClaims}><Icon name="claims" />Organizar</button>
        </header>
        <div className="claim-run-body">
          <div className="claim-run-image-stage">
            {card.imageUrl ? <img src={assetUrl(card.imageUrl)} alt={card.productName} /> : <div className="image-placeholder claim-run-placeholder">Sin imagen</div>}
          </div>
          <div className="claim-run-info">
            <div>
              <span className="claim-run-kicker">{card.expansionName} {card.cardNumber ? `#${card.cardNumber}` : ""}</span>
              <h2>{card.productName}</h2>
            </div>
            <div className="claim-run-copy-box">
              <span>Nombre para copiar</span>
              <strong>{finalName}</strong>
              <button className="primary-action" onClick={() => copyRunText("name", finalName)}><Icon name={copied === "name" ? "check" : "copy"} />{copied === "name" ? "Copiado" : "Copiar nombre"}</button>
            </div>
            <div className="claim-run-tags">
              <div className="claim-run-tags-head">
                <span>Tags</span>
                <button className="secondary-action" disabled={!tags} onClick={() => copyRunText("tags", tags)}><Icon name={copied === "tags" ? "check" : "copy"} />{copied === "tags" ? "Copiados" : "Copiar tags"}</button>
              </div>
              {tagList.length ? <div className="claim-run-tag-list">{tagList.map((tag) => <span key={tag}>{tag}</span>)}</div> : <p className="muted">Sin tags cargados.</p>}
            </div>
            <div className="claim-run-meta">
              <MoneyStack usd={card.pcPriceUsd} blueRate={blueRate} compact label="PC" />
              <MoneyStack ars={card.suggestedArs} blueRate={blueRate} compact label="Sugerido" />
              <MoneyStack ars={card.finalPriceArs} usd={card.finalPriceUsd} blueRate={blueRate} compact label="Final" />
            </div>
            <div className="claim-run-nav">
              <button className="secondary-action" disabled={index === 0} onClick={() => setIndex(index - 1)}>Anterior</button>
              <button className="secondary-action" disabled={index >= cards.length - 1} onClick={() => setIndex(index + 1)}>Siguiente</button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}

function AdminView(props: {
  environment: AppEnvironment;
  blueRate: BlueExchangeRate;
  stockSummary: StockSummary;
  quality: StockQualitySummary;
  priceChartingCache: { entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus };
  priceChartingAutoRefresh: PriceChartingAutoRefreshStatus;
  tcgplayerPrices: TcgplayerPriceCacheStatus;
  tcgplayerPriceAutoRefresh: TcgplayerPriceAutoRefreshStatus;
  priceChartingImages: PriceChartingImageCacheStatus;
  cardIndexStatus: CardIndexStatus;
  priceChartingSyncing: boolean;
  tcgplayerPriceSyncing: boolean;
  cardIndexSyncing: boolean;
  priceChartingImageProcessing: boolean;
  priceChartingImageBackfillRunning: boolean;
  priceChartingImageResumeAt: string;
  lastBatch: ImageBatchResult | null;
  onRefresh: () => void;
  onGoImport: () => void;
  onGoCatalog: () => void;
  onPriceChartingSync: () => void;
  onTcgplayerPriceSync: () => void;
  onCardIndexRebuild: () => void;
  onCardIndexTcgCsvSync: () => void;
  onPriceChartingImageBatch: (includeAll: boolean, mode?: ImageResolverMode) => void;
  onPriceChartingBackfillChange: (running: boolean) => void;
  onResetInventoryStock: () => void;
}) {
  const totalIssues = props.quality.missingImage + props.quality.missingPriceCharting + props.quality.zeroPrice + props.quality.lowStock + props.quality.duplicates;
  const imageReady = Math.max(props.priceChartingImages.urlEntries, props.priceChartingImages.downloadedEntries);
  const imageTotal = Math.max(1, props.priceChartingImages.totalEntries);
  const imageProgress = Math.round((imageReady / imageTotal) * 100);
  const catalogBusy = props.priceChartingSyncing || props.cardIndexSyncing || props.priceChartingImageProcessing;
  return (
    <section className="view admin-view">
      <section className="panel admin-hero">
        <div>
          <p className="eyebrow">Administracion</p>
          <h2>Centro de mantenimiento</h2>
          <p>Acciones del sistema que conviene poder correr sin tocar codigo: catalogos, imagenes, indices, estado general e importacion inicial.</p>
        </div>
        <div className="admin-hero-actions">
          <button className="secondary-action" onClick={props.onRefresh}><Icon name="refresh" />Actualizar datos</button>
          <button className="primary-action" onClick={props.onGoImport}><Icon name="import" />Importar stock</button>
        </div>
      </section>

      <section className="metrics admin-metrics">
        <Metric label="Perfil" value={props.environment.dataProfile} helper={props.environment.allowExamples ? "permite ejemplos" : "datos reales"} />
        <Metric label="Dolar blue" value={formatArs(props.blueRate.sell)} helper={props.blueRate.fallback ? "fallback local" : props.blueRate.source} />
        <Metric label="Stock" value={props.stockSummary.totalUnits.toLocaleString("es-AR")} helper={`${props.stockSummary.totalSkus.toLocaleString("es-AR")} SKUs`} />
        <Metric label="Valor stock" value={formatArs(props.stockSummary.stockValueArs)} helper={`${formatUsd(fromBlueArs(props.stockSummary.stockValueArs, props.blueRate))} blue`} />
        <Metric label="Alertas" value={totalIssues.toLocaleString("es-AR")} helper="catalogo/stock" />
      </section>

      <section className="panel source-health-panel">
        <div className="section-heading compact-heading">
          <div><h3>Estado de fuentes</h3><p>Semaforo rapido para saber si los datos base estan listos antes de vender o cargar stock.</p></div>
        </div>
        <div className="source-health-grid">
          <SourceHealthCard label="PriceCharting" status={props.priceChartingCache.status.lastRun?.status === "completed" ? "ok" : "warn"} value={props.priceChartingCache.status.totalEntries.toLocaleString("es-AR")} helper={props.priceChartingCache.status.lastRun ? formatShortDate(props.priceChartingCache.status.lastRun.completedAt) : "Sin corrida"} />
          <SourceHealthCard label="TCGplayer" status={props.tcgplayerPrices.lastRun?.status === "completed" ? "ok" : "warn"} value={props.tcgplayerPrices.totalEntries.toLocaleString("es-AR")} helper={props.tcgplayerPrices.lastRun ? formatShortDate(props.tcgplayerPrices.lastRun.completedAt) : "Sin corrida"} />
          <SourceHealthCard label="Indice maestro" status={props.cardIndexStatus.totalEntries > 0 ? props.cardIndexStatus.conflictEntries > 0 ? "warn" : "ok" : "bad"} value={props.cardIndexStatus.totalEntries.toLocaleString("es-AR")} helper={`${props.cardIndexStatus.tcgplayerLinkedEntries.toLocaleString("es-AR")} con TCG`} />
          <SourceHealthCard label="Imagenes" status={props.priceChartingImages.failedEntries > 0 ? "warn" : "ok"} value={Math.max(props.priceChartingImages.urlEntries, props.priceChartingImages.downloadedEntries).toLocaleString("es-AR")} helper={`${props.priceChartingImages.failedEntries.toLocaleString("es-AR")} fallidas`} />
        </div>
      </section>

      <div className="admin-grid">
        <section className="panel admin-card">
          <div className="admin-card-heading">
            <Icon name="download" />
            <div>
              <h3>PriceCharting CSV</h3>
              <p>Actualiza la base de precios e IDs que usa stock, compras y claims.</p>
            </div>
          </div>
          <div className="admin-stat-row">
            <span>Cartas en cache</span>
            <strong>{props.priceChartingCache.status.totalEntries.toLocaleString("es-AR")}</strong>
          </div>
          <div className="admin-stat-row">
            <span>Ultima descarga</span>
            <strong>{props.priceChartingCache.status.lastRun ? formatShortDate(props.priceChartingCache.status.lastRun.completedAt) : "Sin datos"}</strong>
          </div>
          <div className="auto-refresh-box">
            <div><span>Automatico</span><strong>{props.priceChartingAutoRefresh.enabled ? `${props.priceChartingAutoRefresh.time} hs` : "Desactivado"}</strong></div>
            <div><span>Proxima</span><strong>{props.priceChartingAutoRefresh.nextRunAt ? formatShortDate(props.priceChartingAutoRefresh.nextRunAt) : "-"}</strong></div>
            <div><span>Ultimo estado</span><strong>{autoRefreshLabel(props.priceChartingAutoRefresh)}</strong></div>
          </div>
          {props.priceChartingAutoRefresh.lastError ? <p className="image-warning">{props.priceChartingAutoRefresh.lastError}</p> : null}
          <button className="primary-action" disabled={props.priceChartingSyncing} onClick={props.onPriceChartingSync}>
            <Icon name="refresh" />{props.priceChartingSyncing ? "Actualizando..." : "Actualizar CSV"}
          </button>
        </section>

        <section className="panel admin-card">
          <div className="admin-card-heading">
            <Icon name="sales" />
            <div>
              <h3>Precios TCGplayer</h3>
              <p>Trae market/low/mid/high desde TCGCSV y los cruza con el indice maestro.</p>
            </div>
          </div>
          <div className="admin-stat-row">
            <span>Filas de precio</span>
            <strong>{props.tcgplayerPrices.totalEntries.toLocaleString("es-AR")}</strong>
          </div>
          <div className="admin-stat-row">
            <span>Productos cruzados</span>
            <strong>{props.tcgplayerPrices.linkedProductEntries.toLocaleString("es-AR")}</strong>
          </div>
          <div className="admin-stat-row">
            <span>Cartas del indice con precio</span>
            <strong>{props.tcgplayerPrices.linkedCardIndexEntries.toLocaleString("es-AR")}</strong>
          </div>
          <div className="auto-refresh-box">
            <div><span>Automatico</span><strong>{props.tcgplayerPriceAutoRefresh.enabled ? `${props.tcgplayerPriceAutoRefresh.time} hs` : "Desactivado"}</strong></div>
            <div><span>Proxima</span><strong>{props.tcgplayerPriceAutoRefresh.nextRunAt ? formatShortDate(props.tcgplayerPriceAutoRefresh.nextRunAt) : "-"}</strong></div>
            <div><span>Ultimo estado</span><strong>{tcgplayerRefreshLabel(props.tcgplayerPriceAutoRefresh, props.tcgplayerPrices)}</strong></div>
          </div>
          {props.tcgplayerPriceAutoRefresh.lastError || props.tcgplayerPrices.lastRun?.errorMessage ? <p className="image-warning">{props.tcgplayerPriceAutoRefresh.lastError || props.tcgplayerPrices.lastRun?.errorMessage}</p> : null}
          <button className="primary-action" disabled={props.tcgplayerPriceSyncing} onClick={props.onTcgplayerPriceSync}>
            <Icon name="refresh" />{props.tcgplayerPriceSyncing ? "Actualizando..." : "Actualizar precios"}
          </button>
        </section>

        <section className="panel admin-card">
          <div className="admin-card-heading">
            <Icon name="palette" />
            <div>
              <h3>Indice maestro</h3>
              <p>Une PriceCharting con TCGplayer para mejorar links, nombres e imagenes.</p>
            </div>
          </div>
          <div className="admin-stat-row"><span>Total indice</span><strong>{props.cardIndexStatus.totalEntries.toLocaleString("es-AR")}</strong></div>
          <div className="admin-stat-row"><span>Con TCGplayer</span><strong>{props.cardIndexStatus.tcgplayerLinkedEntries.toLocaleString("es-AR")}</strong></div>
          <div className="admin-button-row">
            <button className="secondary-action" disabled={props.cardIndexSyncing} onClick={props.onCardIndexRebuild}><Icon name="refresh" />Reconstruir</button>
            <button className="primary-action" disabled={props.cardIndexSyncing} onClick={props.onCardIndexTcgCsvSync}><Icon name="download" />Buscar TCG</button>
          </div>
        </section>

        <section className="panel admin-card admin-card-wide">
          <div className="admin-card-heading">
            <Icon name="image" />
            <div>
              <h3>Imagenes de cartas</h3>
              <p>Completa URLs, descarga imagenes locales y mantiene fotos listas para inventario, ordenes y claims.</p>
            </div>
          </div>
          <div className="admin-progress">
            <div><span>{imageReady.toLocaleString("es-AR")} / {props.priceChartingImages.totalEntries.toLocaleString("es-AR")} con URL o local</span><strong>{imageProgress}%</strong></div>
            <span style={{ width: `${imageProgress}%` }} />
          </div>
          <div className="admin-image-stats">
            <div><span>Pendientes</span><strong>{props.priceChartingImages.pendingEntries.toLocaleString("es-AR")}</strong></div>
            <div><span>Locales</span><strong>{props.priceChartingImages.downloadedEntries.toLocaleString("es-AR")}</strong></div>
            <div><span>Fallidas</span><strong>{props.priceChartingImages.failedEntries.toLocaleString("es-AR")}</strong></div>
            <div><span>Stock</span><strong>{props.priceChartingImages.stockLinkedEntries.toLocaleString("es-AR")}</strong></div>
          </div>
          <div className="admin-button-row">
            <button className="secondary-action" disabled={props.priceChartingImageProcessing} onClick={() => props.onPriceChartingImageBatch(false)}><Icon name="image" />Completar stock</button>
            <button className="secondary-action" disabled={props.priceChartingImageProcessing} onClick={() => props.onPriceChartingImageBatch(true)}><Icon name="activity" />Buscar URLs</button>
            <button className="secondary-action" disabled={props.priceChartingImageProcessing} onClick={() => props.onPriceChartingImageBatch(true, "auto")}><Icon name="download" />Guardar locales</button>
            <button className={props.priceChartingImageBackfillRunning ? "primary-action" : "secondary-action"} disabled={props.priceChartingImageProcessing} onClick={() => props.onPriceChartingBackfillChange(!props.priceChartingImageBackfillRunning)}>
              <Icon name={props.priceChartingImageBackfillRunning ? "close" : "refresh"} />{props.priceChartingImageBackfillRunning ? "Pausar auto" : "Proceso auto"}
            </button>
          </div>
          {props.priceChartingImageResumeAt ? <p className="image-warning">Pausa por limite externo hasta {formatShortDate(props.priceChartingImageResumeAt)}.</p> : null}
          {props.lastBatch ? <p className="muted">Ultima tanda: {props.lastBatch.processed} procesadas, {(props.lastBatch.urlFound || 0) + (props.lastBatch.downloaded || 0)} resueltas.</p> : null}
        </section>

        <section className="panel admin-card">
          <div className="admin-card-heading">
            <Icon name="import" />
            <div>
              <h3>Carga inicial de stock</h3>
              <p>Plantilla, vista previa, resolucion de problemas e importacion final.</p>
            </div>
          </div>
          <div className="admin-stat-row"><span>Sin PriceCharting</span><strong>{props.quality.missingPriceCharting.toLocaleString("es-AR")}</strong></div>
          <div className="admin-stat-row"><span>Sin imagen</span><strong>{props.quality.missingImage.toLocaleString("es-AR")}</strong></div>
          <button className="primary-action" onClick={props.onGoImport}><Icon name="import" />Ir a Importar</button>
          <div className="admin-danger-zone">
            <div>
              <strong>Reset de inventario</strong>
              <span>Pone unidades y reservas en cero. Conserva cartas, precios, imagenes y categorias.</span>
            </div>
            <button className="secondary-action danger-action" disabled={props.stockSummary.totalUnits === 0 && props.stockSummary.reservedUnits === 0} onClick={props.onResetInventoryStock}><Icon name="close" />Resetear stock</button>
          </div>
        </section>

        <section className="panel admin-card">
          <div className="admin-card-heading">
            <Icon name="settings" />
            <div>
              <h3>Herramientas avanzadas</h3>
              <p>Auditoria manual de matches, links y catalogo de imagenes.</p>
            </div>
          </div>
          <div className="admin-stat-row"><span>Conflictos</span><strong>{props.cardIndexStatus.conflictEntries.toLocaleString("es-AR")}</strong></div>
          <div className="admin-stat-row"><span>Matches debiles</span><strong>{props.cardIndexStatus.weakMatchEntries.toLocaleString("es-AR")}</strong></div>
          <button className="secondary-action" disabled={catalogBusy} onClick={props.onGoCatalog}><Icon name="palette" />Abrir Calidad</button>
        </section>
      </div>
    </section>
  );
}

function CatalogView(props: {
  priceChartingCache: { entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus };
  priceChartingImages: PriceChartingImageCacheStatus;
  cardIndexStatus: CardIndexStatus;
  cardIndexEntries: CardIndexEntry[];
  cardIndexSyncing: boolean;
  priceChartingSyncing: boolean;
  priceChartingImageProcessing: boolean;
  priceChartingImageBackfillRunning: boolean;
  priceChartingImageResumeAt: string;
  priceChartingImageLastBatch: ImageBatchResult | null;
  cardIndexRebuildAfterId: string;
  cardIndexNextGroupOffset: number | null;
  blueRate: BlueExchangeRate;
  languageGroup: LanguageGroupFilter;
  onLanguageGroupChange: (languageGroup: LanguageGroupFilter) => void;
  onPriceChartingSearch: (search: string) => void;
  onCardIndexSearch: (search: string, filter?: CardIndexFilter) => void;
  onCardIndexReview: (cardIndexId: string, input: { action: "approve" | "reject" | "manual"; tcgplayerProductId?: string; tcgplayerUrl?: string; imageUrl?: string; note?: string }) => void;
  onCardIndexApproveByConfidence: (minimumConfidence: number, search: string, filter: CardIndexFilter) => void;
  onPriceChartingSync: () => void;
  onCardIndexRebuild: () => void;
  onCardIndexTcgCsvSync: () => void;
  onPriceChartingImageReindexLocal: () => void;
  onPriceChartingImageBatch: (includeAll: boolean, mode?: ImageResolverMode) => void;
  onPriceChartingBackfillChange: (running: boolean) => void;
  showImageReview: boolean;
  onToggleImageReview: () => void;
  stockImageReview: { items: StockImageReviewItem[]; total: number };
  stockImageReviewLoading: boolean;
  showImageCatalog: boolean;
  onToggleImageCatalog: () => void;
  imageCatalog: { entries: ImageCatalogEntry[]; total: number };
  imageCatalogLoading: boolean;
  imageCatalogFilter: "all" | "downloaded" | "url_found" | "failed" | "pending";
  onImageCatalogFilterChange: (filter: "all" | "downloaded" | "url_found" | "failed" | "pending") => void;
  imageCatalogSearch: string;
  onImageCatalogSearchChange: (search: string) => void;
}) {
  const [priceChartingSearch, setPriceChartingSearch] = useState("");
  const [cardIndexSearch, setCardIndexSearch] = useState("");
  const [cardIndexFilter, setCardIndexFilter] = useState<CardIndexFilter>("all");
  const [approvalConfidence, setApprovalConfidence] = useState(90);
  const [showAdvancedCatalogTools, setShowAdvancedCatalogTools] = useState(false);
  const imageFoundEntries = Math.max(props.priceChartingImages.downloadedEntries, props.priceChartingImages.urlEntries);
  const imageProgressTotal = Math.max(1, props.priceChartingImages.totalEntries);
  const imageProgress = Math.round((imageFoundEntries / imageProgressTotal) * 100);
  const catalogTotal = Math.max(1, props.cardIndexStatus.totalEntries);
  const pricedCoverage = percent(props.priceChartingCache.status.pricedEntries, Math.max(1, props.priceChartingCache.status.totalEntries));
  const indexCoverage = percent(props.cardIndexStatus.priceChartingEntries, Math.max(1, props.priceChartingCache.status.totalEntries));
  const tcgCoverage = percent(props.cardIndexStatus.tcgplayerLinkedEntries, catalogTotal);
  const imageCoverage = percent(props.cardIndexStatus.imageLinkedEntries, catalogTotal);
  const missingTcgEntries = Math.max(0, props.cardIndexStatus.totalEntries - props.cardIndexStatus.tcgplayerLinkedEntries);
  const missingImageEntries = Math.max(0, props.cardIndexStatus.totalEntries - props.cardIndexStatus.imageLinkedEntries);
  const doctorMetrics = [
    { label: "PriceCharting", value: props.priceChartingCache.status.totalEntries, percent: pricedCoverage, helper: "con precio USD", tone: pricedCoverage >= 85 ? "ok" : "warn" },
    { label: "Indice maestro", value: props.cardIndexStatus.totalEntries, percent: indexCoverage, helper: "cubierto desde PC", tone: indexCoverage >= 99 ? "ok" : "warn" },
    { label: "TCGPlayer", value: props.cardIndexStatus.tcgplayerLinkedEntries, percent: tcgCoverage, helper: `${missingTcgEntries.toLocaleString("es-AR")} sin link`, tone: tcgCoverage >= 70 ? "ok" : "warn" },
    { label: "Imagenes", value: props.cardIndexStatus.imageLinkedEntries, percent: imageCoverage, helper: `${missingImageEntries.toLocaleString("es-AR")} sin imagen`, tone: imageCoverage >= 70 ? "ok" : "danger" }
  ];
  const auditCounts = props.cardIndexEntries.reduce(
    (counts, entry) => {
      if (entry.matchStatus === "matched") counts.ok += 1;
      else if (entry.matchStatus === "weak_match") counts.review += 1;
      else if (entry.matchStatus === "conflict") counts.conflict += 1;
      else counts.pending += 1;
      if (!entry.tcgplayerUrl) counts.missingTcg += 1;
      if (!entry.imageUrl) counts.missingImage += 1;
      return counts;
    },
    { ok: 0, review: 0, conflict: 0, pending: 0, missingTcg: 0, missingImage: 0 }
  );
  const lastBatchSources = props.priceChartingImageLastBatch?.items.reduce<Record<string, number>>((sources, item) => {
    if (item.status !== "downloaded" && item.status !== "url_found") return sources;
    const source = item.source || "Sin fuente";
    sources[source] = (sources[source] || 0) + 1;
    return sources;
  }, {});
  const lastBatchFailures = props.priceChartingImageLastBatch?.items.filter((item) => item.status === "failed" || item.status === "skipped").slice(0, 5) || [];
  const lastBatchResolved = (props.priceChartingImageLastBatch?.urlFound || 0) + (props.priceChartingImageLastBatch?.downloaded || 0);
  const applyCardIndexFilter = (filter: CardIndexFilter) => {
    setCardIndexFilter(filter);
    props.onCardIndexSearch(cardIndexSearch, filter);
  };
  const qualityMetrics: Array<{ label: string; value: number; helper: string; filter: CardIndexFilter; tone: string }> = [
    { label: "Para revisar", value: props.cardIndexStatus.weakMatchEntries + props.cardIndexStatus.priceChartingOnlyEntries, helper: "debiles o solo PriceCharting", filter: "pending_review", tone: "warn" },
    { label: "Conflictos", value: props.cardIndexStatus.conflictEntries, helper: "requieren correccion manual", filter: "conflict", tone: "danger" },
    { label: "Sin imagen", value: Math.max(0, props.cardIndexStatus.totalEntries - props.cardIndexStatus.imageLinkedEntries), helper: "no se pueden vender comodo", filter: "missing_image", tone: "blue" },
    { label: "Sin TCG", value: Math.max(0, props.cardIndexStatus.totalEntries - props.cardIndexStatus.tcgplayerLinkedEntries), helper: "falta link externo", filter: "missing_tcg", tone: "neutral" },
    { label: "OK fuertes", value: props.cardIndexStatus.matchedEntries, helper: "matches de alta confianza", filter: "matched", tone: "good" }
  ];
  return (
    <section className="view catalog-view">
      <section className="panel catalog-doctor-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Columna vertebral</p>
            <h2>Cobertura del catalogo</h2>
            <p>Estado real de PriceCharting, TCGPlayer e imagenes. Estas acciones trabajan por lotes para evitar procesos pisandose.</p>
          </div>
          <div className="catalog-doctor-state">
            <span>{props.cardIndexSyncing || props.priceChartingSyncing || props.priceChartingImageProcessing ? "Procesando" : "Listo"}</span>
            <strong>{imageCoverage}% imagenes</strong>
          </div>
        </div>
        <div className="catalog-doctor-grid">
          {doctorMetrics.map((metric) => (
            <article className={`catalog-doctor-card ${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value.toLocaleString("es-AR")}</strong>
              <div className="catalog-doctor-progress" aria-label={`${metric.label} ${metric.percent}%`}>
                <i style={{ width: `${Math.min(100, Math.max(0, metric.percent))}%` }} />
              </div>
              <small>{metric.percent}% {metric.helper}</small>
            </article>
          ))}
        </div>
        <div className="catalog-doctor-actions">
          <button className="secondary-action" disabled={props.priceChartingSyncing} onClick={props.onPriceChartingSync}>
            <Icon name="refresh" />{props.priceChartingSyncing ? "Actualizando..." : "Actualizar PriceCharting"}
          </button>
          <button className="secondary-action" disabled={props.cardIndexSyncing} onClick={props.onCardIndexRebuild}>
            <Icon name="palette" />{props.cardIndexRebuildAfterId ? "Continuar indice PC" : "Reconstruir indice PC"}
          </button>
          <button className="secondary-action" disabled={props.cardIndexSyncing} onClick={props.onCardIndexTcgCsvSync}>
            <Icon name="external" />{props.cardIndexNextGroupOffset === null ? "TCG completo" : `TCG desde grupo ${props.cardIndexNextGroupOffset}`}
          </button>
          <button className="secondary-action" disabled={props.priceChartingImageProcessing} onClick={props.onPriceChartingImageReindexLocal}>
            <Icon name="image" />Reindexar imagenes locales
          </button>
          <button className="primary-action" disabled={props.priceChartingImageProcessing} onClick={() => props.onPriceChartingImageBatch(true, "external-index")}>
            <Icon name="search" />Buscar URLs faltantes
          </button>
        </div>
        <p className="catalog-doctor-note">
          Pendiente critico: {missingImageEntries.toLocaleString("es-AR")} cartas sin imagen, {missingTcgEntries.toLocaleString("es-AR")} sin TCGPlayer y {props.cardIndexStatus.conflictEntries.toLocaleString("es-AR")} conflictos para revisar.
        </p>
      </section>
      <section className="panel catalog-command-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Calidad</p>
            <h2>Bandeja de datos del catalogo</h2>
            <p>Revisa solo lo que afecta el uso diario: imagen, link externo, match y confianza. Las herramientas tecnicas quedan en mantenimiento.</p>
          </div>
          <button className="secondary-action" onClick={() => setShowAdvancedCatalogTools((open) => !open)}>
            <Icon name={showAdvancedCatalogTools ? "close" : "settings"} />{showAdvancedCatalogTools ? "Ocultar mantenimiento" : "Mantenimiento"}
          </button>
        </div>
        <div className="quality-overview">
          {qualityMetrics.map((metric) => (
            <button
              className={`quality-metric ${metric.tone} ${cardIndexFilter === metric.filter ? "active" : ""}`}
              key={metric.label}
              type="button"
              onClick={() => applyCardIndexFilter(metric.filter)}
            >
              <span>{metric.label}</span>
              <strong>{metric.value.toLocaleString("es-AR")}</strong>
              <small>{metric.helper}</small>
            </button>
          ))}
        </div>
        <div className="quality-guidance">
          <strong>Flujo sugerido</strong>
          <span>1. Filtra pendientes o conflictos.</span>
          <span>2. Compara foto, PriceCharting y TCGplayer.</span>
          <span>3. Aprueba, marca mal o corrige manualmente.</span>
        </div>
      </section>
      <section className={`panel pricecharting-panel ${showAdvancedCatalogTools ? "" : "catalog-daily-panel"}`}>
        <div className="section-heading">
          <div>
            <h2>Mantenimiento tecnico</h2>
            <p>Cache, indice maestro, imagenes masivas y busqueda directa en PriceCharting.</p>
          </div>
          <button className="secondary-action" disabled={props.priceChartingSyncing} onClick={props.onPriceChartingSync}>
            <Icon name="refresh" />{props.priceChartingSyncing ? "Sincronizando..." : "Sincronizar cache"}
          </button>
        </div>
        <div className="cache-status-grid">
          <Metric label="Cartas en cache" value={props.priceChartingCache.status.totalEntries.toLocaleString("es-AR")} helper="registros persistentes" />
          <Metric label="Con precio USD" value={props.priceChartingCache.status.pricedEntries.toLocaleString("es-AR")} helper="precio loose disponible" />
          <Metric label="Ultima sincronizacion" value={props.priceChartingCache.status.lastRun ? formatShortDate(props.priceChartingCache.status.lastRun.completedAt) : "Sin datos"} helper={!props.priceChartingCache.status.lastRun ? "todavia no se sincronizo" : props.priceChartingCache.status.lastRun.status === "failed" ? "fallo la ultima descarga" : "descarga completa"} />
          <Metric label="URLs imagen" value={props.priceChartingImages.urlEntries.toLocaleString("es-AR")} helper="listas para mostrar" />
          <Metric label="Imagenes locales" value={props.priceChartingImages.downloadedEntries.toLocaleString("es-AR")} helper={`${formatBytes(props.priceChartingImages.bytesStored)} guardados`} />
          <Metric label="Pendientes imagen" value={props.priceChartingImages.pendingEntries.toLocaleString("es-AR")} helper={`${props.priceChartingImages.failedEntries.toLocaleString("es-AR")} fallidas`} />
          <Metric label="Vinculadas al stock" value={props.priceChartingImages.stockLinkedEntries.toLocaleString("es-AR")} helper="prioridad alta" />
        </div>
        <section className="card-index-panel">
          <div className="section-heading compact-heading">
            <div>
              <h3>Indice maestro</h3>
              <p>Carta + PriceCharting + TCGplayer + imagen. No modifica stock.</p>
            </div>
            <div className="inline-actions">
              <button className="secondary-action" disabled={props.cardIndexSyncing} onClick={props.onCardIndexRebuild}>
                <Icon name="refresh" />Crear base desde PriceCharting
              </button>
              <button className="primary-action" disabled={props.cardIndexSyncing} onClick={props.onCardIndexTcgCsvSync}>
                <Icon name="download" />{props.cardIndexSyncing ? "Buscando..." : "Buscar links TCGplayer"}
              </button>
            </div>
          </div>
          <div className="card-index-grid">
            <Metric label="Indice total" value={props.cardIndexStatus.totalEntries.toLocaleString("es-AR")} helper="filas canonicas" />
            <Metric label="Con TCGplayer" value={props.cardIndexStatus.tcgplayerLinkedEntries.toLocaleString("es-AR")} helper="productId + link" />
            <Metric label="Con imagen" value={props.cardIndexStatus.imageLinkedEntries.toLocaleString("es-AR")} helper="PC / TCGplayer / externa" />
            <Metric label="Matches fuertes" value={props.cardIndexStatus.matchedEntries.toLocaleString("es-AR")} helper={`${props.cardIndexStatus.weakMatchEntries.toLocaleString("es-AR")} debiles`} />
            <Metric label="Conflictos" value={props.cardIndexStatus.conflictEntries.toLocaleString("es-AR")} helper="requieren revision" />
            <Metric label="Solo PC" value={props.cardIndexStatus.priceChartingOnlyEntries.toLocaleString("es-AR")} helper="pendiente enriquecer" />
          </div>
          {props.cardIndexStatus.lastRun ? (
            <p className="muted index-run-note">
              Ultimo indice {props.cardIndexStatus.lastRun.source}: {props.cardIndexStatus.lastRun.status === "completed" ? "OK" : "fallo"} - {formatShortDate(props.cardIndexStatus.lastRun.completedAt)}
            </p>
          ) : null}
        </section>
        <section className="catalog-audit-panel">
          <div className="section-heading compact-heading">
            <div>
              <h3>Bandeja de revision</h3>
              <p>Una fila por carta para decidir si los datos son confiables antes de usarlos en ventas, compras o claims.</p>
            </div>
            <form className="catalog-audit-search" onSubmit={(event) => { event.preventDefault(); props.onCardIndexSearch(cardIndexSearch, cardIndexFilter); }}>
              <input value={cardIndexSearch} onChange={(event) => setCardIndexSearch(event.target.value)} placeholder="Nombre, numero, PC ID o TCG ID" />
              <button className="primary-action" type="submit"><Icon name="search" />Revisar</button>
              {cardIndexSearch ? <button className="secondary-action" type="button" onClick={() => { setCardIndexSearch(""); props.onCardIndexSearch("", cardIndexFilter); }}><Icon name="close" />Limpiar</button> : null}
            </form>
          </div>
          <div className="catalog-audit-strip">
            <div><span>OK fuerte</span><strong>{auditCounts.ok}</strong></div>
            <div><span>Revisar</span><strong>{auditCounts.review}</strong></div>
            <div><span>Conflictos</span><strong>{auditCounts.conflict}</strong></div>
            <div><span>Sin TCG</span><strong>{auditCounts.missingTcg}</strong></div>
            <div><span>Sin imagen</span><strong>{auditCounts.missingImage}</strong></div>
          </div>
          <LanguageGroupSelector value={props.languageGroup} onChange={(value) => {
            setPriceChartingSearch("");
            setCardIndexSearch("");
            setCardIndexFilter("all");
            props.onLanguageGroupChange(value);
          }} />
          <div className="catalog-bulk-approve">
            <div>
              <strong>Aprobacion automatica</strong>
              <span>Aprueba pendientes con link PC + link TCGplayer, sin conflictos y con confianza minima.</span>
            </div>
            <label>
              Confianza minima
              <input
                type="number"
                min={0}
                max={100}
                value={approvalConfidence}
                onChange={(event) => setApprovalConfidence(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
              />
            </label>
            <button className="primary-action" onClick={() => props.onCardIndexApproveByConfidence(approvalConfidence, cardIndexSearch, cardIndexFilter)}>
              <Icon name="check" />Aprobar {approvalConfidence}%+
            </button>
          </div>
          <div className="catalog-audit-filters">
            {([
              ["all", "Todos"],
              ["pending_review", "Para revisar"],
              ["conflict", "Conflictos"],
              ["weak_match", "Debiles"],
              ["missing_tcg", "Sin TCG"],
              ["missing_image", "Sin imagen"],
              ["approved", "Aprobados"],
              ["rejected", "Marcados mal"],
              ["manual", "Manuales"]
            ] as const).map(([value, label]) => (
              <button
                className={cardIndexFilter === value ? "active" : ""}
                key={value}
                onClick={() => {
                  applyCardIndexFilter(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {props.cardIndexEntries.length ? (
            <div className="catalog-audit-list">
              {props.cardIndexEntries.map((entry) => (
                <CardIndexAuditRow entry={entry} key={entry.id} onReview={props.onCardIndexReview} />
              ))}
            </div>
          ) : <EmptyState title="Sin entradas para revisar" body="Sincroniza PriceCharting o busca otra carta en el indice." />}
        </section>
        <section className={`image-ops-panel ${showAdvancedCatalogTools ? "" : "catalog-advanced-hidden"}`}>
          <div className="image-progress-header">
            <div>
              <strong>{props.priceChartingImageProcessing ? "Procesando imagenes" : props.priceChartingImageBackfillRunning ? "Catalogo en marcha" : "Imagenes en espera"}</strong>
              <span>{imageFoundEntries.toLocaleString("es-AR")} / {props.priceChartingImages.totalEntries.toLocaleString("es-AR")} con URL</span>
            </div>
            <b>{imageProgress}%</b>
          </div>
          <div className="image-progress-track"><span style={{ width: `${imageProgress}%` }} /></div>
          <div className="image-cache-actions">
            <button className="secondary-action" disabled={props.priceChartingImageProcessing} onClick={() => props.onPriceChartingImageBatch(false)}>
              <Icon name="image" />{props.priceChartingImageProcessing ? "Procesando..." : "Completar imagenes del stock"}
            </button>
            <button className="secondary-action" disabled={props.priceChartingImageProcessing || props.priceChartingImageBackfillRunning} onClick={() => props.onPriceChartingImageBatch(true)}>
              <Icon name="activity" />Buscar URLs por indice externo
            </button>
            <button className="secondary-action" disabled={props.priceChartingImageProcessing} onClick={() => props.onPriceChartingImageBatch(true, "pokemon-tcg")}>
              <Icon name="download" />Descargar imagen desde PokemonTCG
            </button>
            <button className="secondary-action" disabled={props.priceChartingImageProcessing} onClick={() => props.onPriceChartingImageBatch(true, "auto")}>
              <Icon name="download" />Guardar imagenes locales
            </button>
            <button className={props.priceChartingImageBackfillRunning ? "primary-action" : "secondary-action"} onClick={() => props.onPriceChartingBackfillChange(!props.priceChartingImageBackfillRunning)}>
              <Icon name={props.priceChartingImageBackfillRunning ? "close" : "refresh"} />{props.priceChartingImageBackfillRunning ? "Pausar proceso automatico" : "Procesar imagenes automaticamente"}
            </button>
          </div>
          <div className="image-ops-status">
            <div><span>Pendientes</span><strong>{props.priceChartingImages.pendingEntries.toLocaleString("es-AR")}</strong></div>
            <div><span>URLs</span><strong>{props.priceChartingImages.urlEntries.toLocaleString("es-AR")}</strong></div>
            <div><span>Fallidas</span><strong>{props.priceChartingImages.failedEntries.toLocaleString("es-AR")}</strong></div>
            <div><span>Disco</span><strong>{formatBytes(props.priceChartingImages.bytesStored)}</strong></div>
            <div><span>Prioridad stock</span><strong>{props.priceChartingImages.stockLinkedEntries.toLocaleString("es-AR")}</strong></div>
          </div>
          {props.priceChartingImageResumeAt ? <p className="image-warning">PriceCharting pausado hasta {formatShortDate(props.priceChartingImageResumeAt)}. Las fuentes externas pueden seguir.</p> : null}
          {props.priceChartingImageLastBatch ? (
            <div className="image-batch-panel">
              <div className="image-batch-title">
                <strong>Ultima tanda</strong>
                <span>{imageModeLabel(props.priceChartingImageLastBatch.mode)} - {formatShortDate(props.priceChartingImageLastBatch.completedAt)}</span>
              </div>
              <div className="image-batch-stats">
                <span>{props.priceChartingImageLastBatch.processed} procesadas</span>
                <span>{lastBatchResolved} resueltas</span>
                <span>{props.priceChartingImageLastBatch.skipped + props.priceChartingImageLastBatch.failed} sin match</span>
              </div>
              {lastBatchSources && Object.keys(lastBatchSources).length ? (
                <div className="image-source-list">{Object.entries(lastBatchSources).map(([source, count]) => <span key={source}>{source}: {count}</span>)}</div>
              ) : null}
              {lastBatchFailures.length ? (
                <div className="image-error-list">{lastBatchFailures.map((item) => <span key={item.priceChartingId}>{item.priceChartingId}: {shortError(item.error || "")}</span>)}</div>
              ) : null}
            </div>
          ) : null}
        </section>
        <form className="cache-search" onSubmit={(event) => { event.preventDefault(); props.onPriceChartingSearch(priceChartingSearch); }}>
          <label>
            Buscar en PriceCharting
            <input value={priceChartingSearch} onChange={(event) => setPriceChartingSearch(event.target.value)} placeholder="Nombre, expansion, numero o ID" />
          </label>
          <button className="primary-action" type="submit"><Icon name="search" />Buscar</button>
          {priceChartingSearch ? <button className="secondary-action" type="button" onClick={() => { setPriceChartingSearch(""); props.onPriceChartingSearch(""); }}><Icon name="close" />Limpiar</button> : null}
        </form>
        {props.priceChartingCache.entries.length ? (
          <div className="pricecharting-results">
            {props.priceChartingCache.entries.map((entry) => (
              <article className="pricecharting-row" key={entry.priceChartingId}>
                {entry.imageUrl ? <img className="inventory-thumb" src={assetUrl(entry.imageUrl)} alt="" /> : <div className="image-placeholder compact-placeholder">PC</div>}
                <div>
                  <strong>{entry.productName}</strong>
                  <span>{entry.expansionName || "Sin expansion"} {entry.cardNumber ? `#${entry.cardNumber}` : ""}</span>
                  <small>ID {entry.priceChartingId}</small>
                </div>
                <div className="pricecharting-price"><MoneyStack usd={entry.loosePriceUsd} blueRate={props.blueRate} compact /><span>Loose / ungraded</span></div>
                <a className="secondary-action cache-link" href={entry.canonicalUrl} target="_blank" rel="noreferrer"><Icon name="external" />Ver</a>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Cache vacio" body="Configura el token y sincroniza para importar el catalogo completo." />}
      </section>
      <section className={`panel catalog-actions-panel ${showAdvancedCatalogTools ? "" : "catalog-advanced-hidden"}`}>
        <h3>Herramientas de imagen</h3>
        <div className="catalog-toggle-actions">
          <button className="secondary-action" onClick={props.onToggleImageReview}><Icon name="image" />{props.showImageReview ? "Volver a Calidad" : "Ver imagenes con match"}</button>
          <button className="secondary-action" onClick={props.onToggleImageCatalog}><Icon name="activity" />{props.showImageCatalog ? "Volver a Calidad" : "Catalogo imagenes PC"}</button>
        </div>
        {props.showImageReview ? (
          props.stockImageReviewLoading ? (
            <div className="review-empty"><p>Cargando revision de imagenes...</p></div>
          ) : props.stockImageReview.items.length === 0 ? (
            <div className="review-empty"><p>No hay cartas con imagenes asociadas todavia.</p><small>Ejecuta URLs masivas o Descargar PokemonTCG primero.</small></div>
          ) : (
            <div className="image-review-grid">
              <div className="review-summary">{props.stockImageReview.total} cartas con imagen</div>
              {props.stockImageReview.items.map((item) => (
                <article className="review-card" key={item.inventoryItemId}>
                  {item.pcImageUrl ? (
                    <img className="review-card-img" src={assetUrl(item.pcImageUrl)} alt={item.priceChartingName} />
                  ) : item.hasProductImage ? (
                    <img className="review-card-img" src={assetUrl(item.pcImageUrl || "")} alt={item.productName} style={{ background: "#1a1b20" }} />
                  ) : (
                    <div className="image-placeholder review-placeholder">?</div>
                  )}
                  <div className="review-card-info">
                    <strong title={item.productName}>{item.productName}</strong>
                    <span>{item.expansion} #{item.cardNumber || "-"}</span>
                    <small>{item.language} / {item.condition} / {item.quantityOnHand} en stock</small>
                  </div>
                  {item.priceChartingId ? (
                    <>
                    <div className="review-card-match">
                      <span className="match-label">PC: <strong title={item.priceChartingName}>{item.priceChartingName}</strong></span>
                      <span className="match-label"># {item.priceChartingNumber || "-"}</span>
                    </div>
                    {item.pcPublicUrl ? <a className="review-card-link" href={item.pcPublicUrl} target="_blank" rel="noreferrer"><Icon name="external" />Ver PC</a> : null}
                    </>
                  ) : (
                    <div className="review-card-match">
                      <span className="match-label match-note">Sin match PriceCharting</span>
                    </div>
                  )}
                  <div className="review-card-sources">
                    <span className="badge source-badge" style={{ backgroundColor: item.imageSource.includes("PokemonTCG") || item.imageSource.includes("TCGdex") ? "#2f9e44" : item.imageSource.includes("PriceCharting") ? "#c1121f" : "#5f3dc4" }}>{item.imageSource}</span>
                    <span className="badge match-badge">{item.matchCriteria}</span>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : props.showImageCatalog ? (
          <section className="image-catalog-section">
            <div className="catalog-header">
              <h3>Todo el catalogo de imagenes PriceCharting</h3>
              <div className="catalog-controls">
                <input value={props.imageCatalogSearch} onChange={(e) => props.onImageCatalogSearchChange(e.target.value)} placeholder="Buscar nombre, expansion, numero o PC ID..." className="catalog-search-input" />
                <div className="catalog-filter-buttons">
                  {(["all", "downloaded", "url_found", "failed", "pending"] as const).map((f) => (
                    <button key={f} className={props.imageCatalogFilter === f ? "catalog-filter active" : "catalog-filter"} onClick={() => props.onImageCatalogFilterChange(f)}>
                      {f === "all" ? "Todos" : f === "downloaded" ? "Descargadas" : f === "url_found" ? "URLs" : f === "failed" ? "Fallidas" : "Pendientes"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {props.imageCatalogLoading ? (
              <div className="catalog-empty"><p>Cargando catalogo de imagenes...</p></div>
            ) : props.imageCatalog.entries.length === 0 ? (
              <div className="catalog-empty"><p>No hay entradas en el catalogo de imagenes de PriceCharting.</p><small>Ejecuta "URLs masivas" primero para poblar este catalogo.</small></div>
            ) : (
              <>
              <div className="catalog-stats">
                <span className="catalog-stat-label">{props.imageCatalog.total} totales</span>
                <span className="catalog-stat downloaded">{props.imageCatalog.entries.filter(e => e.status === "downloaded").length} descargadas</span>
                <span className="catalog-stat url-found">{props.imageCatalog.entries.filter(e => e.status === "url_found").length} con URL</span>
                <span className="catalog-stat failed">{props.imageCatalog.entries.filter(e => e.status === "failed").length} fallidas</span>
              </div>
              <div className="image-catalog-grid">
                {props.imageCatalog.entries
                  .filter((entry) => {
                    if (props.imageCatalogFilter !== "all" && entry.status !== props.imageCatalogFilter) return false;
                    if (props.imageCatalogSearch) {
                      const q = props.imageCatalogSearch.toLowerCase();
                      return (
                        entry.productName.toLowerCase().includes(q) ||
                        entry.expansionName.toLowerCase().includes(q) ||
                        entry.cardNumber.toLowerCase().includes(q) ||
                        entry.priceChartingId.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((entry) => (
                    <article className="catalog-card" key={entry.priceChartingId} style={{ borderLeft: `3px solid ${entry.statusColor}` }}>
                      {entry.imageUrl ? (
                        <img className="catalog-card-img" src={assetUrl(entry.imageUrl)} alt={entry.productName} />
                      ) : (
                        <div className="catalog-placeholder">{entry.productName.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div className="catalog-card-info">
                        <strong title={entry.productName}>{entry.productName}</strong>
                        <span>{entry.expansionName || "Sin expansion"} {entry.cardNumber ? `#${entry.cardNumber}` : ""}</span>
                        {entry.loosePriceUsd ? <span className="catalog-price">Loose: ${entry.loosePriceUsd} USD</span> : null}
                      </div>
                      <div className="catalog-card-meta">
                        <span className="badge" style={{ backgroundColor: entry.statusColor }}>{entry.status === "downloaded" ? "Descargada" : entry.status === "url_found" ? "URL" : entry.status === "failed" ? "Fallo" : "Pendiente"}</span>
                        <span className="badge catalog-source-badge" style={{ backgroundColor: entry.sourceLabel.includes("PokemonTCG") ? "#2f9e44" : entry.sourceLabel.includes("TCGdex") ? "#2563eb" : entry.sourceLabel.includes("PriceCharting") ? "#c1121f" : "#555" }}>{entry.sourceLabel}</span>
                      </div>
                      {entry.canonicalUrl ? <a className="catalog-card-link" href={entry.canonicalUrl} target="_blank" rel="noreferrer"><Icon name="external" />{entry.priceChartingId}</a> : <span className="catalog-card-id">{entry.priceChartingId}</span>}
                      {entry.sourceImageUrl && entry.status !== "downloaded" ? (
                        <div className="catalog-source-url" title={entry.sourceImageUrl}>
                          <small>Fuente: {entry.sourceImageUrl.slice(0, 80)}{entry.sourceImageUrl.length > 80 ? "..." : ""}</small>
                        </div>
                      ) : null}
                      {entry.errorMessage ? (
                        <div className="catalog-error" title={entry.errorMessage}>
                          <small>⚠ {entry.errorMessage.slice(0, 60)}</small>
                        </div>
                      ) : null}
                      <div className="catalog-card-footer">
                        <small>Intentos: {entry.attempts} | {entry.lastAttemptRelative}</small>
                        {entry.bytesDownloaded > 0 ? <small>{formatBytes(entry.bytesDownloaded)}</small> : null}
                      </div>
                    </article>
                  ))}
              </div>
              </>
            )}
          </section>
        ) : (
          <div className="catalog-empty">
            <p>Usa las herramientas de arriba para gestionar el catalogo de imagenes.</p>
            <small>Sincroniza el cache, reconstruye el indice, y ejecuta procesos de imagenes.</small>
          </div>
        )}
      </section>
    </section>
  );
}

function CardIndexAuditRow({ entry, onReview }: {
  entry: CardIndexEntry;
  onReview: (cardIndexId: string, input: { action: "approve" | "reject" | "manual"; tcgplayerProductId?: string; tcgplayerUrl?: string; imageUrl?: string; note?: string }) => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    tcgplayerProductId: entry.tcgplayerProductId,
    tcgplayerUrl: entry.tcgplayerUrl,
    imageUrl: entry.tcgplayerImageUrl || entry.imageUrl,
    note: entry.reviewNote
  });
  useEffect(() => {
    setManual({
      tcgplayerProductId: entry.tcgplayerProductId,
      tcgplayerUrl: entry.tcgplayerUrl,
      imageUrl: entry.tcgplayerImageUrl || entry.imageUrl,
      note: entry.reviewNote
    });
  }, [entry.id, entry.tcgplayerProductId, entry.tcgplayerUrl, entry.tcgplayerImageUrl, entry.imageUrl, entry.reviewNote]);
  return (
    <article className={`catalog-audit-row ${entry.matchStatus} review-${entry.reviewStatus}`}>
      <div className="catalog-audit-image">
        {entry.imageUrl ? <img src={assetUrl(entry.imageUrl)} alt="" /> : <div className="image-placeholder compact-placeholder">IMG</div>}
        <span>{catalogImageSourceLabel(entry.imageSource)}</span>
      </div>
      <div className="catalog-audit-card">
        <strong>{entry.canonicalName}</strong>
        <span>{entry.canonicalExpansion || "Sin expansion"} {entry.cardNumber ? `#${entry.cardNumber}` : ""}</span>
        <small>PC ID {entry.priceChartingId}{entry.tcgplayerProductId ? ` / TCG ${entry.tcgplayerProductId}` : ""}</small>
        {entry.reviewStatus !== "pending" ? <em>{cardIndexReviewStatusLabel(entry.reviewStatus)}{entry.reviewedAt ? ` - ${formatShortDate(entry.reviewedAt)}` : ""}</em> : null}
      </div>
      <div className="catalog-audit-links">
        {entry.priceChartingUrl ? <a className="secondary-action" href={entry.priceChartingUrl} target="_blank" rel="noreferrer"><Icon name="external" />PriceCharting</a> : <span className="catalog-missing">Sin PC</span>}
        {entry.tcgplayerUrl ? <a className="secondary-action" href={entry.tcgplayerUrl} target="_blank" rel="noreferrer"><Icon name="external" />TCGplayer</a> : <span className="catalog-missing">Sin TCGplayer</span>}
        {entry.tcgplayerImageUrl ? <a className="secondary-action" href={entry.tcgplayerImageUrl} target="_blank" rel="noreferrer"><Icon name="image" />Imagen TCG</a> : null}
      </div>
      <div className="catalog-audit-verdict">
        <strong>{cardIndexStatusLabel(entry.matchStatus)}</strong>
        <span>{entry.matchConfidence}% confianza</span>
        <small>{cardIndexEvidenceLabel(entry)}</small>
      </div>
      <div className="catalog-audit-actions">
        <button className="secondary-action" disabled={entry.reviewStatus === "approved"} onClick={() => onReview(entry.id, { action: "approve", note: "Aprobado visualmente" })}><Icon name="check" />Aprobar</button>
        <button className="secondary-action" disabled={entry.reviewStatus === "rejected"} onClick={() => onReview(entry.id, { action: "reject", note: "Marcado como incorrecto en auditoria" })}><Icon name="close" />Marcar mal</button>
        <button className={manualOpen ? "primary-action" : "secondary-action"} onClick={() => setManualOpen((open) => !open)}><Icon name="edit" />Manual</button>
      </div>
      {manualOpen ? (
        <form className="catalog-manual-form" onSubmit={(event) => {
          event.preventDefault();
          onReview(entry.id, { action: "manual", ...manual });
          setManualOpen(false);
        }}>
          <input value={manual.tcgplayerProductId} onChange={(event) => setManual((current) => ({ ...current, tcgplayerProductId: event.target.value }))} placeholder="TCGplayer product ID" />
          <input value={manual.tcgplayerUrl} onChange={(event) => setManual((current) => ({ ...current, tcgplayerUrl: event.target.value }))} placeholder="Link TCGplayer correcto" />
          <input value={manual.imageUrl} onChange={(event) => setManual((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="URL de imagen correcta" />
          <input value={manual.note} onChange={(event) => setManual((current) => ({ ...current, note: event.target.value }))} placeholder="Nota de revision" />
          <button className="primary-action" type="submit"><Icon name="check" />Guardar manual</button>
        </form>
      ) : null}
    </article>
  );
}

function PurchasesView(props: {
  items: StockRow[];
  purchases: PurchaseRecord[];
  cart: PurchaseCartLine[];
  seller: string;
  note: string;
  blueRate: BlueExchangeRate;
  onAdd: (item: StockRow) => void;
  onCartChange: (cart: PurchaseCartLine[]) => void;
  onSellerChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const [search, setSearch] = useState("");
  const [stockMode, setStockMode] = useState<"all" | "low" | "recent">("all");
  const parsedSearch = parseUiSearchQuery(search);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyPurchases = props.purchases.filter((purchase) => new Date(purchase.createdAt) >= monthStart);
  const monthlyTotal = monthlyPurchases.reduce((sum, purchase) => sum + purchase.totalArs, 0);
  const averageCost = props.purchases.flatMap((purchase) => purchase.lines).reduce((sum, line) => sum + line.lineTotalArs, 0) / Math.max(1, props.purchases.flatMap((purchase) => purchase.lines).reduce((sum, line) => sum + line.quantity, 0));
  const lowStockCount = props.items.filter((item) => item.availableQuantity <= 1).length;
  const visible = props.items
    .map((item) => ({ item, searchScore: scoreStockSearch(item, parsedSearch) }))
    .filter(({ item, searchScore }) => (!parsedSearch.tokens.length || searchScore > 0) && (stockMode === "all" || (stockMode === "low" && item.availableQuantity <= 1) || (stockMode === "recent" && Boolean(item.lastPurchaseAt))))
    .sort((left, right) => {
      if (parsedSearch.tokens.length && left.searchScore !== right.searchScore) return right.searchScore - left.searchScore;
      if (stockMode === "low") return left.item.availableQuantity - right.item.availableQuantity || right.item.priceArs - left.item.priceArs;
      if (stockMode === "recent") return new Date(right.item.lastPurchaseAt || 0).getTime() - new Date(left.item.lastPurchaseAt || 0).getTime();
      return left.item.product.name.localeCompare(right.item.product.name, "es", { numeric: true });
    })
    .slice(0, 18)
    .map(({ item }) => item);
  const total = props.cart.reduce((sum, line) => sum + line.quantity * line.unitCostArs, 0);
  const totalUnits = props.cart.reduce((sum, line) => sum + line.quantity, 0);
  const lineKey = (line: PurchaseCartLine) => line.inventoryItemId ? `stock:${line.inventoryItemId}` : `pc:${line.priceChartingId}`;
  const update = (key: string, patch: Partial<{ quantity: number; unitCostArs: number }>) => props.onCartChange(props.cart.map((line) => lineKey(line) === key ? { ...line, ...patch } : line));
  return (
    <section className="view purchases-layout">
      <section className="purchases-top panel">
        <div className="section-heading">
          <div><h2>Compras</h2><p>Registra entradas de stock con costo real y seguimiento por proveedor.</p></div>
        </div>
        <div className="purchase-metrics">
          <Metric label="Compras mes" value={monthlyPurchases.length} helper={formatArs(monthlyTotal)} />
          <Metric label="Costo promedio" value={formatArs(averageCost)} helper="por unidad historica" />
          <Metric label="Stock bajo" value={lowStockCount} helper="0 o 1 disponible" />
          <Metric label="En carga" value={totalUnits} helper={formatArs(total)} />
        </div>
      </section>
      <section className="panel sale-picker">
        <div className="stock-picker-header">
          <div><h2>Catalogo para comprar</h2><p className="muted">Busca una carta existente y suma unidades al ingreso.</p></div>
        </div>
        <div className="purchase-search-row">
          <label>Buscar en catalogo<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, expansion, numero, SKU, PSA..." /></label>
          <div className="dashboard-feature-tabs purchase-tabs">
            <button className={stockMode === "all" ? "active" : ""} onClick={() => setStockMode("all")}>Todos</button>
            <button className={stockMode === "low" ? "active" : ""} onClick={() => setStockMode("low")}>Stock bajo</button>
            <button className={stockMode === "recent" ? "active" : ""} onClick={() => setStockMode("recent")}>Comprados antes</button>
          </div>
        </div>
        <div className="sale-stock-list">{visible.map((item) => (
          <article className="sale-stock-row purchase-stock-row" key={item.id}>
            <CardArt src={item.product.imageUrl} alt={item.product.name} label={item.product.name} className="purchase-stock-image" fallbackClassName="purchase-stock-image image-placeholder" />
            <div>
              <strong>{item.product.name}</strong>
              <span>{item.product.expansion} #{item.product.number || "-"}</span>
              <small>{inventoryVariantLabel(item)}</small>
              {item.lastPurchaseArs ? <MoneyStack ars={item.lastPurchaseArs} blueRate={props.blueRate} compact label="Ultima compra" /> : null}
            </div>
            <div className="sale-stock-meta"><MoneyStack ars={item.priceArs} usd={item.priceUsd} blueRate={props.blueRate} compact /><span>{item.quantityOnHand} stock / {item.availableQuantity} disp.</span></div>
            <button className="cart-chip" onClick={() => props.onAdd(item)}><Icon name="cart" />Agregar</button>
          </article>
        ))}</div>
        {!visible.length ? <EmptyState title="Sin resultados" body="Proba buscar por nombre, expansion, numero, SKU o variante." /> : null}
      </section>
      <aside className="stock-side">
        <section className="panel sale-cart purchase-cart-panel">
          <div className="section-heading compact-heading"><div><h3>Nueva compra</h3><p>{totalUnits} unidad(es) preparadas</p></div><MoneyStack ars={total} blueRate={props.blueRate} compact /></div>
          <div className="purchase-form-row">
            <label>Vendedor<input value={props.seller} onChange={(event) => props.onSellerChange(event.target.value)} placeholder="Cliente o proveedor" /></label>
            <label>Nota<input value={props.note} onChange={(event) => props.onNoteChange(event.target.value)} placeholder="Origen, lote, forma de pago..." /></label>
          </div>
          {props.cart.length ? (
            <div className="cart-lines">{props.cart.map((line) => {
              const key = lineKey(line);
              const item = line.inventoryItemId ? props.items.find((row) => row.id === line.inventoryItemId) : null;
              const name = item ? stockDisplayLabel(item) : line.name || "Carta PriceCharting";
              const expansionLabel = item ? item.product.expansion : [line.expansion, line.number ? `#${line.number}` : ""].filter(Boolean).join(" ");
              return (
                <div className="cart-line purchase-line editable-cart-line" key={key}>
                  <CardArt src={item?.product.imageUrl || line.imageUrl} alt={name} label={name} className="purchase-line-image" fallbackClassName="purchase-line-image image-placeholder" />
                  <div><strong>{name}</strong><span>{expansionLabel || (line.priceChartingId ? `PriceCharting ${line.priceChartingId}` : "Sin expansion")}</span><small>Subtotal {formatArs(line.quantity * line.unitCostArs)}</small></div>
                  <label>Cant.<input type="number" min={1} value={line.quantity} onChange={(event) => update(key, { quantity: Math.max(1, Number(event.target.value)) })} /></label>
                  <label>Costo u.<input type="number" min={0} value={line.unitCostArs} onChange={(event) => update(key, { unitCostArs: Math.max(0, Number(event.target.value)) })} /></label>
                  <button className="remove-action" aria-label="Quitar de la compra" title="Quitar" onClick={() => props.onCartChange(props.cart.filter((row) => lineKey(row) !== key))}><Icon name="close" /></button>
                </div>
              );
            })}</div>
          ) : <EmptyState title="Compra vacia" body="Agrega cartas del catalogo para registrar un ingreso." />}
          <div className="purchase-total-strip"><div><span>Total compra</span><MoneyStack ars={total} blueRate={props.blueRate} /></div><div><span>Unidades</span><strong>{totalUnits}</strong></div></div>
          <button className="primary-action" disabled={!props.cart.length || props.saving} onClick={props.onSubmit}><Icon name="check" />{props.saving ? "Registrando..." : "Registrar compra e ingresar stock"}</button>
        </section>
        <section className="panel purchase-history-panel"><h3>Ultimas compras</h3>{props.purchases.length ? props.purchases.slice(0, 6).map((purchase) => <div className="compact-activity-row purchase-history-row" key={purchase.id}><div><strong>{purchase.sellerName}</strong><span>{purchase.lines.reduce((sum, line) => sum + line.quantity, 0)} unidad(es) - {formatDate(purchase.createdAt)}</span></div><MoneyStack ars={purchase.totalArs} blueRate={props.blueRate} compact /></div>) : <p className="muted">Sin compras registradas.</p>}</section>
      </aside>
    </section>
  );
}

function MobileIntakeView(props: {
  applying: boolean;
  feedback: string;
  entries: MobileInventoryEntry[];
  blueRate: BlueExchangeRate;
  onSearch: (query: string) => Promise<{ candidates: MobileInventoryCandidate[] }>;
  onSave: (input: Partial<MobileInventoryEntry>) => Promise<MobileInventoryEntry>;
  onStatus: (id: string, status: MobileInventoryEntry["status"]) => void;
  onApplyEntry: (id: string) => void;
  onApplyPending: () => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onLoadToImport: () => void;
  onExit: () => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [helperName, setHelperName] = useState(() => readLocalStorage(mobileHelperStorageKey));
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [candidates, setCandidates] = useState<MobileInventoryCandidate[]>([]);
  const [selected, setSelected] = useState<MobileInventoryCandidate | null>(null);
  const [lastSaved, setLastSaved] = useState<MobileInventoryEntry | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [draft, setDraft] = useState<MobileIntakeDraft>({
    name: "",
    expansion: "",
    number: "",
    language: "EN",
    condition: readLocalStorage(mobileConditionStorageKey) || "NM",
    finish: "normal",
    quantityOnHand: "1",
    location: "",
    intakeBatch: readLocalStorage(mobileBatchStorageKey),
    priceArs: "0",
    priceUsd: "0",
    notes: ""
  });
  const pending = props.entries.filter((entry) => entry.status === "pending");
  const reviewed = props.entries.filter((entry) => entry.status === "reviewed");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = props.entries.filter((entry) => new Date(entry.createdAt).getTime() >= todayStart.getTime()).length;
  useEffect(() => {
    writeLocalStorage(mobileHelperStorageKey, helperName);
  }, [helperName]);
  useEffect(() => {
    writeLocalStorage(mobileBatchStorageKey, draft.intakeBatch);
    writeLocalStorage(mobileConditionStorageKey, draft.condition);
  }, [draft.intakeBatch, draft.condition]);
  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) {
      setCandidates([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      void runSearch(clean);
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [query]);
  async function runSearch(nextQuery = query.trim()) {
    if (nextQuery.length < 2) return;
    setSearching(true);
    setSearchError("");
    try {
      const result = await props.onSearch(nextQuery);
      setCandidates(result.candidates);
    } catch (nextError) {
      setSearchError(errorMessage(nextError));
    } finally {
      setSearching(false);
    }
  }
  function chooseCandidate(candidate: MobileInventoryCandidate) {
    setSelected(candidate);
    setManualOpen(false);
    setDraft((current) => ({
      ...current,
      name: candidate.name,
      expansion: candidate.expansion,
      number: candidate.number,
      language: candidate.language || current.language,
      condition: readLocalStorage(mobileConditionStorageKey) || candidate.condition || current.condition,
      finish: candidate.finish || current.finish,
      priceArs: candidate.priceArs ? String(candidate.priceArs) : current.priceArs,
      priceUsd: candidate.priceUsd ? String(candidate.priceUsd) : current.priceUsd
    }));
  }
  function openManual() {
    setSelected(null);
    setManualOpen(true);
    setDraft((current) => ({ ...current, name: current.name || query.trim() }));
  }
  function changeQuantity(delta: number) {
    setDraft((current) => {
      const next = Math.max(1, Number(current.quantityOnHand || 0) + delta);
      return { ...current, quantityOnHand: String(next) };
    });
  }
  const selectedCaptureKey = selected?.inventoryItemId
    ? `stock:${selected.inventoryItemId}`
    : selected?.priceChartingId
      ? `pc:${selected.priceChartingId}`
      : normalize([draft.name, draft.expansion, draft.number].join(" "));
  const matchingPending = selected || manualOpen
    ? pending.filter((entry) => {
      const entryKey = entry.inventoryItemId
        ? `stock:${entry.inventoryItemId}`
        : entry.priceChartingId
          ? `pc:${entry.priceChartingId}`
          : normalize([entry.name, entry.expansion, entry.number].join(" "));
      return entryKey && entryKey === selectedCaptureKey;
    })
    : [];
  const matchingPendingUnits = matchingPending.reduce((sum, entry) => sum + entry.quantityOnHand, 0);
  async function saveDraft() {
    const cleanName = draft.name.trim();
    const safeQuantity = Math.max(1, Math.floor(Number(draft.quantityOnHand || 1)));
    const safePriceArs = Math.max(0, Number(draft.priceArs || 0));
    const safePriceUsd = draft.priceUsd === "" ? null : Math.max(0, Number(draft.priceUsd || 0));
    if (!helperName.trim()) {
      setSearchError("Pone tu nombre antes de guardar.");
      return;
    }
    if (!cleanName) {
      setSearchError("Busca una carta o carga el nombre manualmente.");
      return;
    }
    setSaving(true);
    setSearchError("");
    try {
      const saved = await props.onSave({
        helperName,
        matchType: selected?.matchType || "manual",
        inventoryItemId: selected?.inventoryItemId,
        priceChartingId: selected?.priceChartingId || "",
        sku: selected?.sku || "",
        name: cleanName,
        expansion: draft.expansion,
        number: draft.number,
        language: draft.language,
        condition: draft.condition,
        finish: draft.finish,
        gradingCompany: selected?.gradingCompany || "",
        grade: selected?.grade || "",
        location: "",
        intakeBatch: draft.intakeBatch,
        quantityOnHand: safeQuantity,
        priceArs: safePriceArs,
        priceUsd: safePriceUsd,
        imageUrl: selected?.imageUrl || "",
        notes: draft.notes
      });
      setLastSaved(saved);
      setSelected(null);
      setManualOpen(false);
      setQuery("");
      setCandidates([]);
      setDraft((current) => ({
        ...current,
        name: "",
        expansion: "",
        number: "",
        quantityOnHand: "1",
        priceArs: "0",
        priceUsd: "0",
        notes: ""
      }));
      window.setTimeout(() => searchInputRef.current?.focus(), 80);
    } catch (nextError) {
      setSearchError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="view mobile-intake-view">
      <section className="mobile-intake-hero">
        <div>
          <p className="eyebrow">Pre-base movil</p>
          <h2>Cargar stock</h2>
        </div>
        <div className="mobile-intake-stats">
          <div><span>Pendientes</span><strong>{pending.length}</strong></div>
          <div><span>Hoy</span><strong>{todayEntries}</strong></div>
          <div><span>Cargadas</span><strong>{reviewed.length}</strong></div>
        </div>
        <button className="secondary-action mobile-exit-action" onClick={props.onExit}><Icon name="home" />Panel</button>
      </section>

      <section className="panel mobile-intake-capture">
        <label>Tu nombre<input value={helperName} onChange={(event) => setHelperName(event.target.value)} placeholder="Ej.: Nico, Agus, Mesa 1" /></label>
        <form className="mobile-search-form" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
          <label>Buscar carta<input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, expansion, numero o SKU" inputMode="search" /></label>
          <button className="primary-action" type="submit" disabled={searching || query.trim().length < 2}><Icon name="search" />{searching ? "Buscando..." : "Buscar"}</button>
        </form>
        <div className="mobile-candidate-list">
          {candidates.map((candidate) => (
            <button className={`mobile-candidate ${selected?.id === candidate.id ? "selected" : ""}`} key={`${candidate.matchType}-${candidate.id}`} onClick={() => chooseCandidate(candidate)}>
              <CardArt src={candidate.imageUrl} alt={candidate.name} label={candidate.name} className="mobile-candidate-image" fallbackClassName="mobile-candidate-image image-placeholder" />
              <span><strong>{candidate.name}</strong><small>{candidate.expansion} {candidate.number ? `#${candidate.number}` : ""}</small><em>{candidate.matchType === "inventory" ? "Stock existente" : "Indice maestro"} - {candidate.helper}</em></span>
              <b>{candidate.priceArs ? formatArs(candidate.priceArs) : candidate.priceUsd ? formatUsd(candidate.priceUsd) : "Sin precio"}</b>
            </button>
          ))}
        </div>
        {query.trim().length >= 2 && !searching && !candidates.length ? <button className="secondary-action mobile-manual-open" onClick={openManual}><Icon name="plus" />No aparece, cargar manual</button> : null}
        {manualOpen || selected ? (
          <section className={`mobile-count-card ${selected ? "matched" : "manual"}`}>
            <div className="mobile-selected-card">
              <CardArt src={selected?.imageUrl} alt={draft.name} label={draft.name || "Carta"} className="mobile-selected-image" fallbackClassName="mobile-selected-image image-placeholder" />
              <div><strong>{draft.name || "Carga manual"}</strong><span>{draft.expansion || "Sin expansion"} {draft.number ? `#${draft.number}` : ""}</span><small>{selected ? selected.helper : "Entrada manual para revisar"}</small></div>
            </div>
            <div className="mobile-field-grid">
              <label>Nombre<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>Expansion<input value={draft.expansion} onChange={(event) => setDraft((current) => ({ ...current, expansion: event.target.value }))} /></label>
              <label>Numero<input value={draft.number} onChange={(event) => setDraft((current) => ({ ...current, number: event.target.value }))} /></label>
              <label className="mobile-quantity-field">Cantidad<div className="mobile-stepper"><button type="button" onClick={() => changeQuantity(-1)}>-</button><input type="text" inputMode="numeric" pattern="[0-9]*" value={draft.quantityOnHand} onChange={(event) => {
                const value = event.target.value.replace(/\D+/g, "");
                setDraft((current) => ({ ...current, quantityOnHand: value }));
              }} /><button type="button" onClick={() => changeQuantity(1)}><Icon name="plus" /></button></div></label>
              <label>Lote<input value={draft.intakeBatch} onChange={(event) => setDraft((current) => ({ ...current, intakeBatch: event.target.value }))} placeholder="Viernes caja 1" /></label>
              <label>Condicion<input value={draft.condition} onChange={(event) => setDraft((current) => ({ ...current, condition: event.target.value.toUpperCase() }))} /></label>
              <label>Precio ARS<input type="text" inputMode="decimal" value={draft.priceArs} onChange={(event) => {
                const value = event.target.value.replace(/[^\d.,]/g, "").replace(",", ".");
                setDraft((current) => ({ ...current, priceArs: value }));
              }} /></label>
            </div>
            {matchingPending.length ? <div className="mobile-dupe-note"><strong>Ya pendiente</strong><span>{matchingPendingUnits} unidad(es) en {matchingPending.length} captura(s)</span></div> : null}
            {searchError ? <p className="mobile-error">{searchError}</p> : null}
            <button className="primary-action mobile-save-action" disabled={saving} onClick={() => void saveDraft()}><Icon name="check" />{saving ? "Guardando..." : "Guardar en pre-base"}</button>
            <label>Notas<textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Idioma raro, holo, revisar estado, falta funda..." /></label>
          </section>
        ) : null}
      </section>

      <section className="panel mobile-staging-panel">
        <div className="section-heading">
          <div><h3>Pre-base capturada</h3><p>{pending.length} pendiente(s), listas para cargar al inventario.</p></div>
          <div className="hero-actions">
            {lastSaved ? <button className="secondary-action" onClick={() => { props.onDelete(lastSaved.id); setLastSaved(null); }}><Icon name="close" />Deshacer ultimo</button> : null}
            <button className="secondary-action" onClick={props.onRefresh}><Icon name="refresh" />Actualizar</button>
            <button className="secondary-action" disabled={!pending.length} onClick={props.onLoadToImport}><Icon name="import" />Preview</button>
            <button className="primary-action" disabled={props.applying || !pending.length} onClick={props.onApplyPending}><Icon name="check" />{props.applying ? "Cargando..." : "Cargar pendientes"}</button>
          </div>
        </div>
        {props.feedback ? <p className="intake-feedback" role="status">{props.feedback}</p> : null}
        <div className="mobile-entry-list">
          {props.entries.slice(0, 80).map((entry) => (
            <article className={`mobile-entry ${entry.status}`} key={entry.id}>
              <CardArt src={entry.imageUrl} alt={entry.name} label={entry.name} className="mobile-entry-image" fallbackClassName="mobile-entry-image image-placeholder" />
              <div>
                <strong>{entry.name}</strong>
                <span>{entry.expansion || "Sin expansion"} {entry.number ? `#${entry.number}` : ""}</span>
                <small>{[`${entry.quantityOnHand} u.`, entry.location, entry.helperName || "Sin ayudante", formatShortDate(entry.createdAt)].filter(Boolean).join(" - ")}</small>
              </div>
              <MoneyStack ars={entry.priceArs || null} usd={entry.priceUsd} blueRate={props.blueRate} compact />
              <div className="mobile-entry-actions">
                <button className="secondary-action" disabled={props.applying || entry.status !== "pending"} onClick={() => props.onApplyEntry(entry.id)}><Icon name="check" />{entry.status === "reviewed" ? "Cargada" : "Cargar"}</button>
                <button className="secondary-action" disabled={props.applying || entry.status !== "pending"} onClick={() => props.onStatus(entry.id, "rejected")}><Icon name="close" />Rechazar</button>
              </div>
            </article>
          ))}
        </div>
        {!props.entries.length ? <EmptyState title="Pre-base vacia" body="Cuando los ayudantes guarden cartas desde el celular, van a aparecer aca." /> : null}
      </section>
    </section>
  );
}

function ImportView({ applying, feedback, csvText, rows, resolutions, importBatch, importRuns, blueRate, onTextChange, onBatchChange, onPreview, onPreviewText, onApply, onLoadExampleCsv, onResolve, onResolveMany }: {
  applying: boolean;
  feedback: string;
  csvText: string;
  rows: SnapshotPreviewRow[];
  resolutions: Record<number, ImportResolution>;
  importBatch: ImportBatchState;
  importRuns: ImportRunRow[];
  blueRate: BlueExchangeRate;
  onTextChange: (value: string) => void;
  onBatchChange: (value: ImportBatchState) => void;
  onPreview: () => void;
  onPreviewText: (value: string) => void;
  onApply: () => void;
  onLoadExampleCsv?: () => void;
  onResolve: (rowNumber: number, resolution: ImportResolution) => void;
  onResolveMany: (resolutions: Record<number, ImportResolution>) => void;
}) {
  const [filter, setFilter] = useState<"all" | SnapshotPreviewRow["action"]>("all");
  const [rowSearch, setRowSearch] = useState("");
  const [quickOpen, setQuickOpen] = useState(true);
  const [quickText, setQuickText] = useState("");
  const [quickDefaults, setQuickDefaults] = useState({ language: "EN", condition: "NM", finish: "normal", location: "Claim" });
  const patchBatch = (patch: Partial<ImportBatchState>) => onBatchChange({ ...importBatch, ...patch });
  const invalid = rows.filter((row) => row.action === "invalid").length;
  const review = rows.filter((row) => row.action === "review").length;
  const unresolved = rows.filter((row) => row.action === "review" && !resolutions[row.rowNumber]).length;
  const quickImport = useMemo(() => buildQuickStockCsv(quickText, { ...quickDefaults, intakeBatch: importBatch.name, inventoryStatus: importBatch.defaultInventoryStatus }), [importBatch.defaultInventoryStatus, importBatch.name, quickText, quickDefaults]);
  const autoResolvable = rows.filter((row) => row.action === "review" && !resolutions[row.rowNumber] && (
    (row.candidates.length === 0 && row.priceChartingCandidates.length === 1 && row.priceChartingCandidates[0].confidence >= 88)
    || (row.candidates.length === 1 && row.candidates[0].confidence >= 86 && row.priceChartingCandidates.length <= 1)
  ));
  const importTotals = rows.reduce((totals, row) => {
    totals.units += row.quantityOnHand || 0;
    totals.value += (row.quantityOnHand || 0) * (row.priceArs || 0);
    if (row.priceChartingId || row.priceChartingCandidates.length === 1) totals.linked += 1;
    if (!row.imageUrl && !row.priceChartingCandidates.some((candidate) => candidate.imageUrl)) totals.missingImage += 1;
    if (!row.priceArs && !row.priceUsd) totals.missingPrice += 1;
    return totals;
  }, { units: 0, value: 0, linked: 0, missingImage: 0, missingPrice: 0 });
  const visible = (filter === "all" ? rows : rows.filter((row) => row.action === filter))
    .filter((row) => {
      const clean = normalize(rowSearch);
      if (!clean) return true;
      return normalize([row.name, row.sku, row.expansion, row.number, row.priceChartingId || "", ...row.warnings].join(" ")).includes(clean);
    });
  const choosePriceCharting = (row: SnapshotPreviewRow, candidate: PriceChartingImportCandidate, current?: ImportResolution) => {
    onResolve(row.rowNumber, {
      resolution: current?.resolution || "create",
      matchedInventoryItemId: current?.matchedInventoryItemId,
      priceChartingId: candidate.priceChartingId
    });
  };
  const chooseInventory = (row: SnapshotPreviewRow, candidate: ImportCandidate, current?: ImportResolution) => {
    onResolve(row.rowNumber, {
      resolution: "update",
      matchedInventoryItemId: candidate.inventoryItemId,
      priceChartingId: current?.priceChartingId || row.priceChartingId
    });
  };
  const acceptAutomaticMatches = () => {
    const next: Record<number, ImportResolution> = {};
    for (const row of autoResolvable) {
      const priceChartingId = row.priceChartingCandidates.length === 1 ? row.priceChartingCandidates[0].priceChartingId : row.priceChartingId;
      if (row.candidates.length === 1 && row.candidates[0].confidence >= 86) {
        next[row.rowNumber] = { resolution: "update", matchedInventoryItemId: row.candidates[0].inventoryItemId, priceChartingId };
      } else if (row.priceChartingCandidates.length === 1) {
        next[row.rowNumber] = { resolution: "create", priceChartingId };
      }
    }
    onResolveMany(next);
  };
  const createVisibleLocal = () => {
    const next: Record<number, ImportResolution> = {};
    for (const row of visible) {
      if (row.action === "review" && !row.candidates.length && !resolutions[row.rowNumber]) {
        next[row.rowNumber] = { resolution: "create", priceChartingId: row.priceChartingCandidates.length === 1 ? row.priceChartingCandidates[0].priceChartingId : row.priceChartingId };
      }
    }
    onResolveMany(next);
  };
  const ignoreVisibleRows = () => {
    const next: Record<number, ImportResolution> = {};
    for (const row of visible) {
      if (row.action === "review" && !resolutions[row.rowNumber]) next[row.rowNumber] = { resolution: "ignore" };
    }
    onResolveMany(next);
  };
  const convertQuickImport = () => {
    if (!quickImport.csv) return;
    onTextChange(quickImport.csv);
    onPreviewText(quickImport.csv);
  };
  const downloadImportTemplate = () => {
    downloadCsv("ultimoturno-plantilla-stock.csv", [
      ["name", "expansion", "number", "language", "condition", "finish", "gradingCompany", "grade", "gradingCert", "location", "intakeBatch", "inventoryStatus", "quantityOnHand", "priceArs", "priceUsd", "sku", "priceChartingId", "imageUrl", "notes"],
      ["Abra", "Scarlet & Violet 151", "63", "EN", "NM", "normal", "", "", "", "Caja A", "Caja 1 - RAW", "available", 1, 1500, 0.91, "", "", "", "RAW"],
      ["Team Rocket's Mewtwo Ex", "Ascended Heroes", "281", "EN", "GRADED", "normal", "PSA", "10", "12345678", "Vitrina PSA", "Graded PSA", "available", 1, 850000, 535.5, "", "", "", "PSA 10"]
    ]);
  };
  const readyRows = rows.filter((row) => row.action === "create" || row.action === "update").length;
  const localCreatable = visible.filter((row) => row.action === "review" && !row.candidates.length && !resolutions[row.rowNumber]).length;
  const ignoredRows = Object.values(resolutions).filter((resolution) => resolution.resolution === "ignore").length;
  const canApply = rows.length > 0 && invalid === 0 && unresolved === 0;
  const csvDraftLines = csvText.split(/\r?\n/).filter((line) => {
    const clean = line.trim();
    return clean && !clean.startsWith("#");
  }).length;
  const lastRun = importRuns[0];
  const priceCoverage = rows.length ? Math.round((importTotals.linked / rows.length) * 100) : 0;
  const preflightChecks = [
    { label: "Lote", detail: importBatch.name.trim() || "Nombra la caja o tanda fisica", status: importBatch.name.trim() ? "ok" : "block" },
    { label: "Ubicacion", detail: importBatch.defaultLocation.trim() || "Opcional: se puede completar despues", status: importBatch.defaultLocation.trim() ? "ok" : "warn" },
    { label: "CSV", detail: csvText.trim() ? `${csvDraftLines.toLocaleString("es-AR")} linea(s) listas` : "Pega o carga el archivo", status: csvText.trim() ? "ok" : "block" },
    { label: "Preview", detail: rows.length ? `${rows.length.toLocaleString("es-AR")} fila(s) analizadas` : "Genera vista previa antes de aplicar", status: rows.length ? "ok" : "block" },
    { label: "Errores", detail: invalid ? `${invalid} bloquean la importacion` : rows.length ? "Sin errores bloqueantes" : "Pendiente de preview", status: invalid ? "block" : rows.length ? "ok" : "warn" },
    { label: "Revisiones", detail: unresolved ? `${unresolved} sin decision` : rows.length ? "Coincidencias resueltas" : "Pendiente de preview", status: unresolved ? "block" : rows.length ? "ok" : "warn" },
    { label: "Precios", detail: rows.length ? `${importTotals.missingPrice} sin precio declarado` : "Se valida en preview", status: rows.length && importTotals.missingPrice > 0 ? "warn" : rows.length ? "ok" : "warn" },
    { label: "PriceCharting", detail: rows.length ? `${priceCoverage}% vinculado` : "Ayuda a imagenes y precios", status: rows.length && priceCoverage < 65 ? "warn" : rows.length ? "ok" : "warn" }
  ];
  const blockingChecks = preflightChecks.filter((check) => check.status === "block");
  const readinessStatus = !csvText.trim()
    ? "Esperando CSV"
    : !rows.length
      ? "Falta vista previa"
      : blockingChecks.length
        ? "No importar todavia"
        : "Listo para importar";
  const readinessTone = blockingChecks.length ? "blocked" : rows.length ? "ready" : "waiting";
  const issueCount = invalid + review;
  return (
    <section className="view imports-main">
      <section className="panel import-guide-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Carga inicial</p>
            <h2>Importar stock</h2>
            <p>Primero carga el archivo, despues revisa problemas, y recien al final se escribe en el inventario.</p>
          </div>
          {rows.length ? <strong>{rows.length} filas analizadas</strong> : null}
        </div>
        <section className="import-batch-panel">
          <div>
            <span className="eyebrow">Lote de trabajo</span>
            <strong>{importBatch.name || "Sin nombre de lote"}</strong>
            <small>{importBatch.defaultLocation || "Sin ubicacion por defecto"} / {inventoryStatusLabel(importBatch.defaultInventoryStatus)}</small>
          </div>
          <label>Nombre del lote<input value={importBatch.name} onChange={(event) => patchBatch({ name: event.target.value })} placeholder="Caja 1 - RAW barato" /></label>
          <label>Ubicacion por defecto (opcional)<input value={importBatch.defaultLocation} onChange={(event) => patchBatch({ defaultLocation: event.target.value })} placeholder="Caja A, Binder 1, PSA..." /></label>
          <label>Estado inicial<select value={importBatch.defaultInventoryStatus} onChange={(event) => patchBatch({ defaultInventoryStatus: event.target.value })}>{inventoryStatusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          <label className="span-2">Nota del lote<input value={importBatch.note} onChange={(event) => patchBatch({ note: event.target.value })} placeholder="Ej.: cargado desde caja fisica, falta revisar holos" /></label>
        </section>
        <div className="import-steps">
          <div className={csvText.trim() ? "done" : "active"}><span>1</span><strong>Preparar CSV</strong><small>Plantilla o archivo propio</small></div>
          <div className={rows.length ? "done" : csvText.trim() ? "active" : ""}><span>2</span><strong>Vista previa</strong><small>Detecta errores</small></div>
          <div className={unresolved || invalid ? "active" : rows.length ? "done" : ""}><span>3</span><strong>Resolver</strong><small>Conflictos y errores</small></div>
          <div className={canApply ? "active" : ""}><span>4</span><strong>Importar</strong><small>Guarda stock</small></div>
        </div>
        <section className={`import-readiness-panel ${readinessTone}`}>
          <div className="import-readiness-head">
            <div>
              <p className="eyebrow">Preflight viernes 04/09</p>
              <h3>{readinessStatus}</h3>
              <span>{rows.length ? `${rows.length.toLocaleString("es-AR")} filas / ${importTotals.units.toLocaleString("es-AR")} unidades / ${formatArs(importTotals.value)}` : `${csvDraftLines.toLocaleString("es-AR")} linea(s) detectadas en borrador`}</span>
            </div>
            <strong>{blockingChecks.length ? `${blockingChecks.length} bloqueo(s)` : "Sin bloqueos"}</strong>
          </div>
          <div className="preflight-grid">
            {preflightChecks.map((check) => (
              <article className={`preflight-check ${check.status}`} key={check.label}>
                <span>{check.label}</span>
                <strong>{check.status === "ok" ? "OK" : check.status === "block" ? "Bloquea" : "Revisar"}</strong>
                <small>{check.detail}</small>
              </article>
            ))}
          </div>
          <div className="preflight-footer">
            <div>
              <strong>Ultima carga</strong>
              <span>{lastRun ? `${lastRun.fileName || "Carga stock"} - ${formatDate(lastRun.createdAt)} - ${lastRun.appliedRows}/${lastRun.totalRows} filas` : "Sin cargas registradas todavia"}</span>
            </div>
            <div>
              <button className="secondary-action" onClick={downloadImportTemplate}><Icon name="download" />Plantilla viernes</button>
              <button className="secondary-action" disabled={!rows.length || issueCount === 0} onClick={() => exportImportIssuesCsv(rows)}><Icon name="download" />Pendientes CSV</button>
            </div>
          </div>
        </section>
        <section className="quick-import-panel">
          <div className="quick-import-head">
            <div><strong>Carga rapida</strong><span>Una carta por linea, sin armar columnas eternas.</span></div>
            <button className="secondary-action" onClick={() => setQuickOpen((open) => !open)}><Icon name={quickOpen ? "close" : "plus"} />{quickOpen ? "Ocultar" : "Abrir"}</button>
          </div>
          {quickOpen ? (
            <div className="quick-import-body">
              <div className="quick-defaults">
                <label>Idioma<input value={quickDefaults.language} onChange={(event) => setQuickDefaults((current) => ({ ...current, language: event.target.value.toUpperCase() }))} /></label>
                <label>Condicion<input value={quickDefaults.condition} onChange={(event) => setQuickDefaults((current) => ({ ...current, condition: event.target.value.toUpperCase() }))} /></label>
                <label>Acabado<input value={quickDefaults.finish} onChange={(event) => setQuickDefaults((current) => ({ ...current, finish: event.target.value }))} /></label>
                <label>Ubicacion<input value={quickDefaults.location} onChange={(event) => setQuickDefaults((current) => ({ ...current, location: event.target.value }))} /></label>
              </div>
              <label className="quick-import-text">
                Formato rapido
                <textarea value={quickText} onChange={(event) => setQuickText(event.target.value)} placeholder={"Nombre | Expansion | Numero | Cantidad | Precio USD | Precio ARS | Variante | Ubicacion\nAbra | Scarlet & Violet 151 | 63 | 2 | 0.91 | 1500 | reverse | Caja A\nTeam Rocket's Mewtwo Ex | Ascended Heroes | 281 | 1 | 535.5 | 850000 | PSA 10 | Vitrina"} />
              </label>
              <div className="quick-import-footer">
                <div><strong>{quickImport.rows} fila(s) listas</strong><span>{quickImport.skipped ? `${quickImport.skipped} ignorada(s) por faltar datos minimos` : "Se convierte a CSV y genera vista previa."}</span></div>
                <button className="primary-action" disabled={!quickImport.csv} onClick={convertQuickImport}><Icon name="search" />Convertir y previsualizar</button>
              </div>
            </div>
          ) : null}
        </section>
        <div className="import-helper-grid">
          <div>
            <strong>Columnas minimas</strong>
            <span>name, expansion, number, quantityOnHand, priceArs</span>
          </div>
          <div>
            <strong>Recomendadas</strong>
            <span>language, condition, finish, gradingCompany, grade, gradingCert, location, priceUsd, sku</span>
          </div>
          <div>
            <strong>Opcionales</strong>
            <span>priceChartingId, imageUrl, notes</span>
          </div>
        </div>
        <div className="import-input-grid">
          <label className="file-importer">Archivo CSV<input type="file" accept=".csv,.txt,text/csv" onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            file.text().then(onTextChange).catch(() => onTextChange(""));
          }} /></label>
          <div className="import-template-actions">
            <button className="secondary-action" onClick={downloadImportTemplate}><Icon name="download" />Descargar plantilla</button>
            {onLoadExampleCsv ? <button className="secondary-action" onClick={onLoadExampleCsv}><Icon name="import" />Cargar ejemplo</button> : null}
          </div>
        </div>
        <label className="csv-editor-label">
          Pegar CSV
          <textarea className="csv-input" value={csvText} onChange={(event) => onTextChange(event.target.value)} placeholder="name,expansion,number,language,condition,finish,gradingCompany,grade,gradingCert,quantityOnHand,priceArs&#10;Abra,Scarlet & Violet 151,63,EN,NM,normal,,,,1,1500&#10;Team Rocket's Mewtwo Ex,Ascended Heroes,281,EN,GRADED,normal,PSA,10,12345678,1,850000" />
        </label>
        <div className="hero-actions import-main-actions">
          <button className="secondary-action" disabled={applying || !csvText.trim()} onClick={onPreview}><Icon name="search" />Generar vista previa</button>
          {rows.length ? <button className="secondary-action" disabled={!autoResolvable.length} onClick={acceptAutomaticMatches}><Icon name="check" />Resolver seguras ({autoResolvable.length})</button> : null}
          {rows.length ? <button className="secondary-action" disabled={!localCreatable} onClick={createVisibleLocal}><Icon name="plus" />Crear locales visibles ({localCreatable})</button> : null}
          {rows.length ? <button className="secondary-action" disabled={!visible.some((row) => row.action === "review" && !resolutions[row.rowNumber])} onClick={ignoreVisibleRows}><Icon name="close" />Ignorar dudas visibles</button> : null}
          {rows.length ? <button className="secondary-action" disabled={!invalid && !review} onClick={() => exportImportIssuesCsv(rows)}><Icon name="download" />Exportar problemas</button> : null}
          <button className="primary-action" disabled={applying || !canApply} onClick={onApply}><Icon name="check" />{applying ? "Procesando..." : "Confirmar e importar"}</button>
        </div>
      </section>
      {feedback ? <p className="intake-feedback" role="status">{feedback}</p> : null}
      {rows.length ? <>
        <section className="review-summary"><Metric label="Nuevas" value={rows.filter((row) => row.action === "create").length} helper="se crearan" /><Metric label="Actualizaciones" value={rows.filter((row) => row.action === "update").length} helper="SKU existente" /><Metric label="A revisar" value={review} helper={`${unresolved} sin resolver`} /><Metric label="Errores" value={invalid} helper="bloquean la importacion" /></section>
        <section className="import-total-strip">
          <div><span>Unidades detectadas</span><strong>{importTotals.units.toLocaleString("es-AR")}</strong></div>
          <div><span>Valor declarado</span><MoneyStack ars={importTotals.value} blueRate={blueRate} compact /></div>
          <div><span>Con PriceCharting</span><strong>{importTotals.linked} / {rows.length}</strong></div>
          <div><span>Sin imagen / precio</span><strong>{importTotals.missingImage} / {importTotals.missingPrice}</strong></div>
          <div><span>Listas sin tocar</span><strong>{readyRows}</strong></div>
          <div><span>Ignoradas</span><strong>{ignoredRows}</strong></div>
        </section>
        <section className="panel review-panel">
          <div className="section-heading"><div><h3>Revision fila por fila</h3><p>Los errores quedan siempre visibles; las coincidencias requieren una decision.</p></div></div>
          <div className="review-controls">{(["all", "review", "invalid", "create", "update"] as const).map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value === "all" ? "Todas" : snapshotActionLabel(value)}</button>)}</div>
          <label className="review-search">Buscar dentro de la revision<input value={rowSearch} onChange={(event) => setRowSearch(event.target.value)} placeholder="Fila, nombre, expansion, numero, warning..." /></label>
          <div className="review-table">{visible.map((row) => {
            const resolution = resolutions[row.rowNumber];
            const selectedPriceChartingId = resolution?.priceChartingId || row.priceChartingId;
            const selectedPriceCharting = row.priceChartingCandidates.find((candidate) => candidate.priceChartingId === selectedPriceChartingId);
            const selectedInventory = row.candidates.find((candidate) => candidate.inventoryItemId === resolution?.matchedInventoryItemId);
            const previewImage = row.imageUrl || selectedPriceCharting?.imageUrl || row.priceChartingCandidates.find((candidate) => candidate.imageUrl)?.imageUrl || "";
            return (
              <article className={`review-row ${row.action === "invalid" || row.action === "review" ? "pending" : "approved"}`} key={`${row.rowNumber}-${row.sku}`}>
                <div className="review-row-main">
                  <CardArt src={previewImage} alt={row.name || "Carta"} label={row.name || "Sin imagen"} className="review-row-image" fallbackClassName="review-row-image image-placeholder" />
                  <div><span className="row-number">Fila {row.rowNumber}</span><h3>{row.name || "Sin nombre"}</h3><p>{row.sku || "SKU automatico"} - {row.expansion || "Sin expansion"}</p></div>
                  <span className={`pill ${row.action === "invalid" || row.action === "review" ? "warning" : "ok"}`}>{snapshotActionLabel(row.action)}</span>
                </div>
                <dl className="review-grid"><div><dt>Numero</dt><dd>{row.number || "-"}</dd></div><div><dt>Variante</dt><dd>{[row.language, row.gradingCompany || row.grade ? [row.gradingCompany, row.grade].filter(Boolean).join(" ") : row.condition].filter(Boolean).join(" / ")}</dd></div><div><dt>Cantidad</dt><dd>{row.quantityOnHand}</dd></div><div><dt>Lote / estado</dt><dd>{row.intakeBatch || importBatch.name || "Sin lote"} / {inventoryStatusLabel(row.inventoryStatus || importBatch.defaultInventoryStatus)}</dd></div><div><dt>Ubicacion</dt><dd>{row.location || importBatch.defaultLocation || "-"}</dd></div><div><dt>Precio</dt><dd><MoneyStack ars={row.priceArs} usd={row.priceUsd} blueRate={blueRate} compact /></dd></div></dl>
                {row.warnings.length ? <div className="warnings">{row.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div> : <p className="muted">Lista para aplicar.</p>}
                {row.priceChartingId && !row.priceChartingCandidates.length ? <div className="selected-candidate"><span>PriceCharting asociado</span><strong>{row.priceChartingId}</strong></div> : null}
                {row.priceChartingCandidates.length ? (
                  <div className="candidate-review pricecharting-review">
                    <div><h4>Coincidencias PriceCharting</h4><p>Esta asociacion define el link canonico y evita descargar imagenes duplicadas.</p></div>
                    <div className="candidate-grid pricecharting-grid">{row.priceChartingCandidates.map((candidate) => (
                      <button className={`candidate-card ${selectedPriceChartingId === candidate.priceChartingId ? "selected" : ""}`} key={candidate.priceChartingId} onClick={() => choosePriceCharting(row, candidate, resolution)}>
                        {candidate.imageUrl ? <img src={candidate.imageUrl} alt={candidate.productName} /> : <div className="image-placeholder">{candidate.productName.slice(0, 2).toUpperCase()}</div>}
                        <strong>{candidate.productName}</strong>
                        <span>{candidate.expansionName} #{candidate.cardNumber || "-"}</span>
                        <small>ID {candidate.priceChartingId}</small>
                        <MoneyStack usd={candidate.loosePriceUsd} blueRate={blueRate} compact />
                        <div className="confidence"><span>Coincidencia</span><strong>{candidate.confidence}%</strong></div>
                        <p>{candidate.reasons.join(" · ")}</p>
                      </button>
                    ))}</div>
                  </div>
                ) : null}
                {row.action === "review" ? (
                  <div className="candidate-review resolved-review">
                    <div><h4>Posibles coincidencias en stock</h4><p>Compara nombre, expansion, numero, idioma y condicion antes de elegir.</p></div>
                    {row.candidates.length ? <div className="candidate-grid">{row.candidates.map((candidate) => (
                      <button className={`candidate-card ${resolution?.matchedInventoryItemId === candidate.inventoryItemId ? "selected" : ""}`} key={candidate.inventoryItemId} onClick={() => chooseInventory(row, candidate, resolution)}>
                        {candidate.imageUrl ? <img src={candidate.imageUrl} alt={candidate.name} /> : <div className="image-placeholder">{candidate.name.slice(0, 2).toUpperCase()}</div>}
                        <strong>{candidate.name}</strong>
                        <span>{candidate.expansion} #{candidate.number || "-"}</span>
                        <small>{[candidate.language, candidate.gradingCompany || candidate.grade ? [candidate.gradingCompany, candidate.grade].filter(Boolean).join(" ") : candidate.condition].filter(Boolean).join(" / ")}</small>
                        <div className="confidence"><span>Coincidencia</span><strong>{candidate.confidence}%</strong></div>
                        <p>{candidate.reasons.join(" · ")}</p>
                      </button>
                    ))}</div> : <p className="muted">No hay una carta igual cargada en tu stock.</p>}
                    <div className="review-actions">
                      <button className={resolution?.resolution === "create" ? "primary-action" : "secondary-action"} disabled={row.priceChartingCandidates.length > 1 && !selectedPriceChartingId} onClick={() => onResolve(row.rowNumber, { resolution: "create", priceChartingId: selectedPriceChartingId })}><Icon name="check" />{selectedPriceChartingId ? "Crear con PriceCharting" : "Crear local"}</button>
                      <button className={resolution?.resolution === "ignore" ? "primary-action" : "secondary-action"} onClick={() => onResolve(row.rowNumber, { resolution: "ignore" })}><Icon name="close" />Ignorar fila</button>
                    </div>
                    {resolution ? <div className="selected-candidate"><span>Decision guardada</span><strong>{resolution.resolution === "update" ? `Actualizar ${selectedInventory?.name || "coincidencia"}` : resolution.resolution === "create" ? selectedPriceChartingId ? `Crear usando ${selectedPriceCharting?.productName || selectedPriceChartingId}` : "Crear carta local sin PriceCharting" : "No importar esta fila"}</strong></div> : null}
                  </div>
                ) : null}
              </article>
            );
          })}</div>
        </section>
      </> : <section className="panel import-empty-panel"><EmptyState title="Sin vista previa" body="Descarga la plantilla, carga tu CSV y genera la vista previa. Nada se modifica hasta confirmar." /></section>}
      <section className="panel import-history-panel">
        <div className="section-heading"><div><h3>Lotes recientes</h3><p>Historial rapido de cargas aplicadas desde esta pantalla.</p></div></div>
        {importRuns.length ? (
          <div className="import-history-list">{importRuns.slice(0, 6).map((run) => (
            <div className="compact-activity-row" key={run.id}>
              <div><strong>{run.fileName || "Carga stock"}</strong><span>{formatDate(run.createdAt)} - {run.appliedRows}/{run.totalRows} filas - {run.status}</span>{run.note ? <small>{run.note}</small> : null}</div>
            </div>
          ))}</div>
        ) : <p className="muted">Todavia no hay lotes registrados.</p>}
      </section>
    </section>
  );
}

function buildQuickStockCsv(
  text: string,
  defaults: { language: string; condition: string; finish: string; location: string; intakeBatch?: string; inventoryStatus?: string }
): { csv: string; rows: number; skipped: number } {
  const headers = ["name", "expansion", "number", "language", "condition", "finish", "gradingCompany", "grade", "gradingCert", "location", "intakeBatch", "inventoryStatus", "quantityOnHand", "priceArs", "priceUsd", "sku", "priceChartingId", "imageUrl", "notes"];
  const rows: string[][] = [];
  let skipped = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.includes("\t") ? "\t" : line.includes("|") ? "|" : "";
    if (!separator) {
      skipped += 1;
      continue;
    }
    const parts = line.split(separator).map((part) => part.trim());
    const [name, expansion, number, quantityText, priceUsdText, priceArsText, variantText, locationText] = parts;
    if (!name || !expansion || !quantityText) {
      skipped += 1;
      continue;
    }
    const variant = parseQuickStockVariant(variantText || defaults.condition, defaults);
    rows.push([
      name,
      expansion,
      number || "",
      variant.language || defaults.language || "EN",
      variant.condition || defaults.condition || "NM",
      variant.finish || defaults.finish || "normal",
      variant.gradingCompany,
      variant.grade,
      variant.gradingCert,
      locationText || defaults.location || "",
      defaults.intakeBatch || "",
      defaults.inventoryStatus || "available",
      quantityText || "1",
      priceArsText || "",
      priceUsdText || "",
      "",
      "",
      "",
      variantText || ""
    ]);
  }
  if (!rows.length) return { csv: "", rows: 0, skipped };
  return {
    csv: [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"),
    rows: rows.length,
    skipped
  };
}

function parseQuickStockVariant(value: string, defaults: { language: string; condition: string; finish: string }) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();
  const gradingCompany = upper.match(/\b(PSA|BGS|CGC|SGC)\b/)?.[1] || "";
  const grade = upper.match(/\b(?:PSA|BGS|CGC|SGC)?\s*(10|9(?:\.5)?|8(?:\.5)?|7(?:\.5)?|6(?:\.5)?|5(?:\.5)?|4(?:\.5)?|3(?:\.5)?|2(?:\.5)?|1(?:\.5)?)\b/)?.[1] || "";
  const language = upper.match(/\b(EN|ES|JP|JA|FR|DE|IT|PT|KR|CN)\b/)?.[1] || defaults.language;
  const finish = upper.includes("REVERSE") ? "reverse"
    : upper.includes("COSMOS") ? "cosmos"
      : upper.includes("MASTER") ? "masterball"
        : upper.includes("POKE BALL") || upper.includes("POKEBALL") ? "pokeball"
          : upper.includes("HOLO") ? "holo"
            : defaults.finish;
  const condition = gradingCompany || grade || upper.includes("GRADED")
    ? "GRADED"
    : upper.match(/\b(NM|LP|MP|HP|DMG)\b/)?.[1] || defaults.condition;
  return {
    language,
    condition,
    finish,
    gradingCompany,
    grade,
    gradingCert: ""
  };
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function NavButton({ active, icon, onClick, children }: { active: boolean; icon: IconName; onClick: () => void; children: React.ReactNode }) {
  return <button className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={onClick}><Icon name={icon} /><span>{children}</span></button>;
}

function Metric({ label, value, helper }: { label: string; value: React.ReactNode; helper: React.ReactNode }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>;
}

function SourceHealthCard({ label, status, value, helper }: { label: string; status: "ok" | "warn" | "bad"; value: React.ReactNode; helper: React.ReactNode }) {
  return <article className={`source-health-card ${status}`}><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>;
}

function MoneyStack({ ars, usd, blueRate, compact = false, label, className = "" }: { ars?: number | null; usd?: number | null; blueRate: BlueExchangeRate; compact?: boolean; label?: string; className?: string }) {
  const hasUsd = usd !== null && usd !== undefined && Number.isFinite(usd);
  const hasArs = ars !== null && ars !== undefined && Number.isFinite(ars);
  const mainUsd = hasUsd ? Number(usd) : hasArs ? fromBlueArs(Number(ars), blueRate) : null;
  const mainArs = hasArs ? Number(ars) : hasUsd ? toBlueArs(Number(usd), blueRate) : null;
  const classes = ["money-stack", compact ? "compact" : "", className].filter(Boolean).join(" ");
  if (mainUsd === null && mainArs === null) {
    return <span className={classes}>{label ? <small>{label}</small> : null}<strong>Sin precio</strong></span>;
  }
  return (
    <span className={classes} title={`Dolar blue venta: ${formatArs(blueRate.sell)}${blueRate.fallback ? " (fallback)" : ""}`}>
      {label ? <small>{label}</small> : null}
      <strong>{formatUsd(mainUsd)}</strong>
      <em>{formatArs(mainArs || 0)} blue</em>
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{body}</span></div>;
}

function BootScreen() {
  return (
    <main className="access-shell">
      <section className="access-card boot-card" aria-live="polite">
        <img className="brand-mark" src="/brand/ultimo-turno-logo.jpeg" alt="UltimoTurno" />
        <div>
          <h1>UltimoTurno</h1>
          <p className="subtitle">Conectando...</p>
        </div>
        <div className="boot-progress" />
      </section>
    </main>
  );
}

function AccessGate({
  value,
  error,
  checking,
  onChange,
  onSubmit
}: {
  value: string;
  error: string;
  checking: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="access-shell">
      <form className="access-card" onSubmit={onSubmit}>
        <img className="brand-mark" src="/brand/ultimo-turno-logo.jpeg" alt="UltimoTurno" />
        <div>
          <h1>UltimoTurno</h1>
          <p className="subtitle">Acceso privado</p>
        </div>
        <label>
          <span>Clave</span>
          <input
            autoFocus
            type="password"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Clave de acceso"
          />
        </label>
        {error ? <div className="access-error">{error}</div> : null}
        <button type="submit" disabled={checking}>{checking ? "Verificando..." : "Entrar"}</button>
      </form>
    </main>
  );
}

function readLocalStorage(key: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Algunas vistas embebidas bloquean storage; la app debe seguir operando.
  }
}

function removeLocalStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Sin accion: es solo persistencia local.
  }
}

function getStoredAccessKey() {
  return readLocalStorage(accessKeyStorageKey);
}

function setStoredAccessKey(value: string) {
  writeLocalStorage(accessKeyStorageKey, value);
  try {
    document.cookie = `${accessKeyCookieName}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
  } catch {
    // El header igualmente queda cubierto por storage cuando esta disponible.
  }
}

function clearStoredAccessKey() {
  removeLocalStorage(accessKeyStorageKey);
  try {
    document.cookie = `${accessKeyCookieName}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Sin accion: es solo limpieza de credencial local.
  }
}

function isAccessError(error: unknown) {
  return Boolean(error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 401);
}

function normalizeApiBase(rawValue: string | undefined) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "/api";

  try {
    const url = new URL(raw);
    const pathname = url.pathname.replace(/\/+$/, "");
    const hostname = url.hostname.toLowerCase();
    const isLocalApi = isLocalHostname(hostname);

    if (!pathname && !isLocalApi) {
      url.pathname = "/api";
    } else {
      url.pathname = pathname || "";
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    const relative = raw.startsWith("/") ? raw : `/${raw}`;
    return relative.replace(/\/+$/, "") || "/api";
  }
}

function isLocalHostname(hostname: string) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());
}

function shouldUseApiDispatch() {
  if (typeof window !== "undefined" && isLocalHostname(window.location.hostname)) return false;
  try {
    const url = new URL(apiBase);
    return !isLocalHostname(url.hostname);
  } catch {
    return apiBase === "/api";
  }
}

function buildApiRequestUrl(path: string) {
  const requestPath = path.startsWith("/") ? path : `/${path}`;
  if (!shouldUseApiDispatch()) return `${apiBase}${requestPath}`;
  return `${apiBase}/dispatch?path=${encodeURIComponent(requestPath)}`;
}

async function api<T>(path: string, options: { token?: string; method?: string; body?: unknown } = {}): Promise<T> {
  const accessKey = getStoredAccessKey();
  const requestUrl = buildApiRequestUrl(path);
  const method = options.method || "GET";
  const response = await fetch(requestUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessKey ? { "X-UltimoTurno-Access-Key": accessKey } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(payload.error || response.statusText || `Error ${response.status}`);
    const error = new Error(`${method} ${requestUrl} -> ${response.status}: ${detail}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return payload as T;
}

function blankForm(): InventoryFormState {
  return {
    purchaseCost: null,
    purchaseCurrency: "ARS",
    sku: "",
    name: "",
    expansion: "",
    number: "",
    imageUrl: "",
    priceChartingId: "",
    priceChartingUrl: "",
    language: "EN",
    condition: "NM",
    finish: "normal",
    gradingCompany: "",
    grade: "",
    gradingCert: "",
    location: "",
    intakeBatch: "",
    inventoryStatus: "available",
    tags: "",
    quantityOnHand: 0,
    quantityReserved: 0,
    priceArs: 0,
    priceUsd: null,
    notes: ""
  };
}

const inventoryStatusOptions = [
  { value: "available", label: "Disponible" },
  { value: "pending_intake", label: "Lote pendiente" },
  { value: "review", label: "Para revisar" },
  { value: "not_for_sale", label: "No venta" },
  { value: "missing_price", label: "Sin precio" },
  { value: "missing_image", label: "Sin imagen" }
];

function inventoryStatusLabel(value: string) {
  return inventoryStatusOptions.find((option) => option.value === value)?.label || "Disponible";
}

function autoRefreshLabel(status: PriceChartingAutoRefreshStatus) {
  if (status.running) return "Corriendo ahora";
  if (status.lastStatus === "success") return status.lastCompletedAt ? `OK ${formatShortDate(status.lastCompletedAt)}` : "OK";
  if (status.lastStatus === "failed") return "Fallo";
  if (status.lastStatus === "skipped") return "Salteado";
  return "Sin corridas";
}

function tcgplayerRefreshLabel(status: TcgplayerPriceAutoRefreshStatus, cache: TcgplayerPriceCacheStatus) {
  if (status.running) return "Corriendo ahora";
  if (status.lastStatus === "success") return status.lastCompletedAt ? `OK ${formatShortDate(status.lastCompletedAt)}` : "OK";
  if (status.lastStatus === "failed") return "Fallo";
  if (status.lastStatus === "skipped") return "Sin cambios";
  if (cache.lastRun?.status === "completed") return `OK ${formatShortDate(cache.lastRun.completedAt)}`;
  if (cache.lastRun?.status === "skipped") return "Sin cambios";
  if (cache.lastRun?.status === "failed") return "Fallo";
  return "Sin corridas";
}

function defaultImportBatch(): ImportBatchState {
  return {
    name: "",
    defaultLocation: "",
    defaultInventoryStatus: "available",
    note: ""
  };
}

function readImportDraft(): { csvText: string; batch: ImportBatchState } {
  if (typeof window === "undefined") return { csvText: "", batch: defaultImportBatch() };
  try {
    const parsed = JSON.parse(readLocalStorage(importDraftStorageKey) || "{}") as { csvText?: string; batch?: Partial<ImportBatchState> };
    return {
      csvText: String(parsed.csvText || ""),
      batch: { ...defaultImportBatch(), ...(parsed.batch || {}) }
    };
  } catch {
    return { csvText: "", batch: defaultImportBatch() };
  }
}

function formFromItem(item: StockRow): InventoryFormState {
  const priceCharting = item.product.identifiers.find((identifier) => identifier.source === "pricecharting");
  return {
    purchaseCost: item.purchaseCost ?? null,
    purchaseCurrency: item.purchaseCurrency || "ARS",
    sku: item.sku,
    name: item.product.name,
    expansion: item.product.expansion,
    number: item.product.number || "",
    imageUrl: item.product.imageUrl || "",
    priceChartingId: priceCharting?.externalId || "",
    priceChartingUrl: priceCharting?.url || "",
    language: item.variant.language,
    condition: item.variant.condition,
    finish: item.variant.finish,
    gradingCompany: item.variant.gradingCompany || "",
    grade: item.variant.grade || "",
    gradingCert: item.variant.gradingCert || "",
    location: item.location,
    intakeBatch: item.intakeBatch || "",
    inventoryStatus: item.inventoryStatus || "available",
    tags: item.tags || "",
    quantityOnHand: item.quantityOnHand,
    quantityReserved: item.quantityReserved,
    priceArs: item.priceArs,
    priceUsd: item.priceUsd,
    notes: ""
  };
}

function emptySummary(): StockSummary {
  return { totalSkus: 0, totalUnits: 0, reservedUnits: 0, availableUnits: 0, stockValueArs: 0 };
}

function summarizeStockRows(items: StockRow[]): StockSummary {
  return items.reduce<StockSummary>((summary, item) => {
    summary.totalSkus += 1;
    summary.totalUnits += item.quantityOnHand;
    summary.reservedUnits += item.quantityReserved;
    summary.availableUnits += item.availableQuantity;
    summary.stockValueArs += item.availableQuantity * item.priceArs;
    return summary;
  }, emptySummary());
}

function emptyPriceChartingStatus(): PriceChartingCacheStatus {
  return { totalEntries: 0, pricedEntries: 0, lastRun: null };
}

function emptyPriceChartingAutoRefreshStatus(): PriceChartingAutoRefreshStatus {
  return {
    enabled: false,
    time: "06:00",
    timezone: "local",
    category: "pokemon-cards",
    running: false,
    nextRunAt: "",
    lastStartedAt: "",
    lastCompletedAt: "",
    lastStatus: "never",
    lastError: "",
    lastEntries: 0
  };
}

function emptyTcgplayerPriceStatus(): TcgplayerPriceCacheStatus {
  return { totalEntries: 0, pricedEntries: 0, productEntries: 0, linkedProductEntries: 0, linkedCardIndexEntries: 0, lastRun: null };
}

function emptyTcgplayerPriceAutoRefreshStatus(): TcgplayerPriceAutoRefreshStatus {
  return {
    enabled: false,
    time: "18:30",
    timezone: "local",
    source: "tcgcsv",
    categoryId: "3",
    running: false,
    nextRunAt: "",
    lastStartedAt: "",
    lastCompletedAt: "",
    lastStatus: "never",
    lastError: "",
    lastEntries: 0
  };
}

function emptyPriceChartingImageStatus(): PriceChartingImageCacheStatus {
  return { totalEntries: 0, pendingEntries: 0, urlEntries: 0, downloadedEntries: 0, failedEntries: 0, bytesStored: 0, stockLinkedEntries: 0 };
}

function emptyCardIndexStatus(): CardIndexStatus {
  return {
    totalEntries: 0,
    priceChartingEntries: 0,
    tcgplayerLinkedEntries: 0,
    coolstuffLinkedEntries: 0,
    imageLinkedEntries: 0,
    matchedEntries: 0,
    weakMatchEntries: 0,
    conflictEntries: 0,
    priceChartingOnlyEntries: 0,
    lastRun: null
  };
}

function emptyClaimsWorkspace(): ClaimsWorkspace {
  return {
    activeClaim: null,
    sections: [],
    cards: [],
    frees: [],
    history: [],
    summary: { cards: 0, cardsWithBuyer: 0, buyers: 0, missingPrices: 0, missingImages: 0, totalArs: 0, totalUsd: 0, claimTotalArs: 0, claimTotalUsd: 0, frees: 0 }
  };
}

function claimCardDraft(card: ClaimCard) {
  return {
    finalPriceArs: card.finalPriceArs ? String(card.finalPriceArs) : "",
    finalPriceUsd: card.finalPriceUsd ? String(card.finalPriceUsd) : "",
    finalName: card.finalName,
    buyer: card.buyer,
    quantity: String(Math.max(1, card.quantity || 1)),
    tags: card.tags
  };
}

function claimBuyerSlotsForUi(value: string, quantity: number) {
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  const text = String(value || "");
  const raw = text.split(",").map((buyer) => buyer.trim());
  if (!text.trim()) return Array.from({ length: safeQuantity }, () => "");
  if (!text.includes(",") && raw[0]) return Array.from({ length: safeQuantity }, () => raw[0]);
  return [...raw, ...Array.from({ length: Math.max(0, safeQuantity - raw.length) }, () => "")].slice(0, safeQuantity);
}

function claimBuyerSlotsValue(slots: string[]) {
  return slots.map((buyer) => buyer.trim()).join(",");
}

function claimDisplayNameWithQuantity(name: string, quantity: number) {
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  if (safeQuantity <= 1 || /\bhay\s+\d+\b/i.test(name)) return name;
  return `${name} - hay ${safeQuantity}`;
}

function claimFinalName(card: ClaimCard, priceArs: number, priceUsd: number) {
  const base = [card.productName, card.expansionName].filter(Boolean).join(" - ");
  const prices = [];
  if (priceArs > 0) prices.push(formatClaimNameArsPrice(priceArs));
  if (priceUsd > 0) prices.push(`$${priceUsd}usd`);
  return prices.length ? `${base} - ${prices.join(" + ")}` : base;
}

function formatClaimNameArsPrice(priceArs: number) {
  const roundedPrice = Math.round(priceArs);
  if (roundedPrice >= 10000) {
    const thousands = roundedPrice / 1000;
    const display = Number.isInteger(thousands)
      ? String(thousands)
      : thousands.toLocaleString("es-AR", { maximumFractionDigits: 1 });
    return `$${display}mil`;
  }
  return `$${roundedPrice}`;
}

function orderedClaimCardsForRun(cards: ClaimCard[], sections: ClaimSection[]) {
  const availableCards = cards.filter((card) => card.status !== "ignored");
  const ordered: ClaimCard[] = [];
  const used = new Set<string>();
  for (const section of sections) {
    for (const card of availableCards.filter((item) => item.sectionId === section.id)) {
      ordered.push(...expandClaimCardUnits(card));
      used.add(card.id);
    }
  }
  for (const card of availableCards.filter((item) => !item.sectionId || !used.has(item.id))) {
    if (!used.has(card.id)) ordered.push(...expandClaimCardUnits(card));
  }
  return ordered;
}

function expandClaimCardUnits(card: ClaimCard) {
  const quantity = Math.max(1, Math.floor(Number(card.quantity) || 1));
  return Array.from({ length: quantity }, () => card);
}

function matchesClaimSearch(card: ClaimCard, query: ReturnType<typeof parseUiSearchQuery>, sectionName: string) {
  if (!query.tokens.length) return true;
  const generatedName = claimFinalName(card, card.finalPriceArs, card.finalPriceUsd);
  const haystack = normalize([
    card.productName,
    card.expansionName,
    card.cardNumber,
    card.priceChartingId,
    card.canonicalUrl,
    card.imageUrl,
    card.finalName,
    generatedName,
    card.buyer,
    card.tags,
    card.status,
    sectionName
  ].join(" "));
  const cardNumber = primaryCardNumber(card.cardNumber);
  return query.tokens.every((token) => {
    const numberToken = token.replace(/^0+([0-9])/, "$1");
    if (/^[0-9]+[a-z]?$/i.test(token) && cardNumber.includes(numberToken)) return true;
    return haystack.includes(token);
  });
}

async function copyToClipboard(value: string) {
  const text = String(value || "").trim();
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // LAN access may not expose navigator.clipboard; fall back to a hidden textarea.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function buildDuplicateIdentityKeys(items: StockRow[]): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = stockIdentityKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function summarizeStockQuality(items: StockRow[], duplicateKeys: Set<string>): StockQualitySummary {
  return items.reduce<StockQualitySummary>((summary, item) => {
    const issues = stockItemIssues(item, duplicateKeys);
    if (issues.includes("missingImage")) summary.missingImage += 1;
    if (issues.includes("missingPriceCharting")) summary.missingPriceCharting += 1;
    if (issues.includes("zeroPrice")) summary.zeroPrice += 1;
    if (issues.includes("lowStock")) summary.lowStock += 1;
    if (issues.includes("duplicates")) summary.duplicates += 1;
    return summary;
  }, { missingImage: 0, missingPriceCharting: 0, zeroPrice: 0, lowStock: 0, duplicates: 0 });
}

function stockItemIssues(item: StockRow, duplicateKeys: Set<string>): IssueFilter[] {
  const issues: IssueFilter[] = [];
  if (!item.product.imageUrl) issues.push("missingImage");
  if (!item.product.identifiers.some((identifier) => identifier.source === "pricecharting")) issues.push("missingPriceCharting");
  if (!item.priceArs) issues.push("zeroPrice");
  if (item.availableQuantity <= 1) issues.push("lowStock");
  if (duplicateKeys.has(stockIdentityKey(item))) issues.push("duplicates");
  return issues;
}

function stockIdentityKey(item: StockRow): string {
  return normalize([item.product.name, item.product.expansion, item.product.number, item.variant.language, item.variant.condition, item.variant.finish, item.variant.gradingCompany, item.variant.grade, item.variant.gradingCert].join("|"));
}

function inventoryGradingLabel(item: StockRow): string {
  return [item.variant.gradingCompany, item.variant.grade].filter(Boolean).join(" ");
}

function inventoryPresentationLabel(item: StockRow): string {
  return item.variant.gradingCompany || item.variant.grade ? "Graded" : "RAW";
}

function inventoryVariantLabel(item: StockRow): string {
  const grading = inventoryGradingLabel(item);
  const condition = grading ? grading : item.variant.condition;
  return [item.variant.language, condition, item.variant.finish].filter(Boolean).join(" / ");
}

const languageGroupOptions: Array<{ value: LanguageGroupFilter; label: string; flag: string }> = [
  { value: "all", label: "Todos", flag: "" },
  { value: "english", label: "Ingles", flag: "🇺🇸" },
  { value: "japanese", label: "Japones", flag: "🇯🇵" },
  { value: "chinese", label: "Chino", flag: "🇨🇳" }
];

function LanguageGroupSelector({ value, onChange }: { value: LanguageGroupFilter; onChange: (value: LanguageGroupFilter) => void }) {
  return (
    <div className="language-group-row">
      <span>Idioma:</span>
      {languageGroupOptions.map((option) => (
        <button className={value === option.value ? "active" : ""} key={option.value} type="button" onClick={() => onChange(option.value)}>
          {option.flag ? <span aria-hidden="true">{option.flag}</span> : null}{option.label}
        </button>
      ))}
    </div>
  );
}

function inventoryLanguageGroup(language: string): LanguageGroupFilter {
  const normalized = normalize(language);
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  if (["chinese", "simplified", "traditional", "taiwan"].some((token) => normalized.includes(token))) return "chinese";
  if (["zh", "cn", "chs", "cht", "china"].some((token) => tokens.has(token))) return "chinese";
  if (["japanese", "japan", "korean", "korea", "indonesia", "indonesian", "thai", "thailand", "vietnam", "asia"].some((token) => normalized.includes(token))) return "japanese";
  if (["ja", "jp", "kr", "ko"].some((token) => tokens.has(token))) return "japanese";
  return "english";
}

function inventoryPriceDisplay(item: StockRow, source: InventoryPriceSource, blueRate: BlueExchangeRate): {
  label: string;
  ars: number | null;
  usd: number | null;
  helper: string;
  hasPrice: boolean;
} {
  const references = item.priceReferences;
  if (source === "pricecharting") {
    const usd = references?.priceCharting.usd ?? null;
    return {
      label: "PriceCharting",
      ars: usd ? toBlueArs(usd, blueRate) : null,
      usd,
      helper: usd ? `${formatUsd(usd)} loose` : references?.priceCharting.priceChartingId ? "Sin precio PC" : "Sin link PC",
      hasPrice: usd !== null && usd > 0
    };
  }
  if (source === "tcgplayer") {
    const usd = references?.tcgplayer.marketPriceUsd ?? references?.tcgplayer.usd ?? null;
    const subtype = references?.tcgplayer.subTypeName || "";
    return {
      label: "TCGplayer",
      ars: usd ? toBlueArs(usd, blueRate) : null,
      usd,
      helper: usd ? `${formatUsd(usd)} market${subtype ? ` · ${subtype}` : ""}` : references?.tcgplayer.productId ? "Sin market TCG" : "Sin link TCG",
      hasPrice: usd !== null && usd > 0
    };
  }
  if (source === "coolstuff") {
    const usd = references?.coolstuff.usd ?? null;
    return {
      label: "CoolStuff",
      ars: usd ? toBlueArs(usd, blueRate) : null,
      usd,
      helper: "Pendiente",
      hasPrice: usd !== null && usd > 0
    };
  }
  return {
    label: "Venta",
    ars: item.priceArs || null,
    usd: item.priceUsd,
    helper: item.priceUsd ? `${formatUsd(item.priceUsd)} venta` : "Precio local",
    hasPrice: item.priceArs > 0 || Boolean(item.priceUsd && item.priceUsd > 0)
  };
}

function inventoryPriceSortValue(item: StockRow, source: InventoryPriceSource, blueRate: BlueExchangeRate): number {
  const price = inventoryPriceDisplay(item, source, blueRate);
  return price.ars || (price.usd ? toBlueArs(price.usd, blueRate) : 0);
}

function stockDisplayLabel(item: StockRow): string {
  const grading = inventoryGradingLabel(item);
  return grading ? `${item.product.name} - ${grading}` : item.product.name;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "es"));
}

const inventoryTagSuggestions = ["jugables", "old", "full art", "promo", "sellado", "staple", "bulk", "vitrina"];

function inventoryTags(value: string): string[] {
  const seen = new Set<string>();
  return String(value || "")
    .split(/[,;|]/)
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((tag) => {
      if (seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

function inventoryTagsText(tags: string[]): string {
  return unique(tags.map((tag) => tag.trim().toLowerCase().replace(/\s+/g, " "))).join(", ");
}

function toggleInventoryTag(tagsText: string, tag: string): string {
  const tagList = inventoryTags(tagsText);
  const normalized = inventoryTags(tag)[0];
  if (!normalized) return inventoryTagsText(tagList);
  return inventoryTagsText(tagList.includes(normalized) ? tagList.filter((current) => current !== normalized) : [...tagList, normalized]);
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseUiSearchQuery(value: string) {
  const raw = normalize(value);
  const tokens = raw.split(" ").filter((token) => token && token !== "s");
  const numberTokens = [...new Set(tokens
    .map((token) => token.replace(/^#/, ""))
    .filter((token) => /^[0-9]+[a-z]?$/i.test(token))
    .map((token) => token.replace(/^0+([0-9])/, "$1")))].slice(0, 1);
  const textTokens = [...new Set(tokens.filter((token) => !/^[0-9]+[a-z]?$/i.test(token.replace(/^#/, ""))))];
  return { raw, tokens, textTokens, numberTokens };
}

function uiSearchTokenVariants(token: string): string[] {
  const variants = new Set([token]);
  if (token.endsWith("ies") && token.length > 4) variants.add(`${token.slice(0, -3)}y`);
  if (token.endsWith("s") && token.length > 3) variants.add(token.slice(0, -1));
  return [...variants];
}

function normalizedTextIncludesToken(value: string, token: string): boolean {
  return uiSearchTokenVariants(token).some((variant) => value.includes(variant));
}

function normalizedWordsIncludeToken(value: string, token: string): boolean {
  const words = new Set(value.split(" ").filter(Boolean));
  return uiSearchTokenVariants(token).some((variant) => words.has(variant));
}

function primaryCardNumber(value: string) {
  const raw = String(value || "").trim().split("/")[0] || "";
  return normalize(raw).replace(/\s+/g, "").replace(/^0+([0-9])/, "$1");
}

function scoreStockSearch(item: StockRow, query: ReturnType<typeof parseUiSearchQuery>) {
  if (!query.tokens.length) return 1;
  const name = normalize(item.product.name);
  const nameWords = name.split(" ");
  const expansionText = normalize(item.product.expansion);
  const skuText = normalize(item.sku);
  const miscText = normalize([
    item.variant.language,
    item.variant.condition,
    item.variant.finish,
    item.variant.gradingCompany,
    item.variant.grade,
    item.variant.gradingCert,
    item.location,
    item.tags,
    item.product.identifiers.map((identifier) => `${identifier.source} ${identifier.externalId} ${identifier.url || ""}`).join(" ")
  ].join(" "));
  const haystack = `${name} ${expansionText} ${skuText} ${miscText}`;
  let score = 0;
  for (const token of query.textTokens) {
    if (normalizedWordsIncludeToken(name, token)) score += 50;
    else if (normalizedTextIncludesToken(name, token)) score += 34;
    else if (normalizedTextIncludesToken(skuText, token)) score += 24;
    else if (normalizedTextIncludesToken(expansionText, token)) score += 16;
    else if (normalizedTextIncludesToken(miscText, token)) score += 7;
    else if (normalizedTextIncludesToken(haystack, token)) score += 3;
    else return 0;
  }
  const itemNumber = primaryCardNumber(item.product.number || "");
  const fullNumber = normalize(item.product.number || "").replace(/\s+/g, "");
  for (const token of query.numberTokens) {
    if (itemNumber === token) score += 80;
    else if (fullNumber.includes(token)) score += 18;
    else if (skuText.includes(token)) score += 8;
    else return 0;
  }
  if (query.raw && haystack.includes(query.raw)) score += 10;
  return score;
}

function searchInventoryCatalogEntries(items: StockRow[], search: string, languageGroup: LanguageGroupFilter, limit: number): PriceChartingCacheEntry[] {
  const query = parseUiSearchQuery(search);
  const seen = new Set<string>();
  return items
    .filter((item) => languageGroup === "all" || inventoryLanguageGroup(item.variant.language) === languageGroup)
    .map((item) => ({ item, score: scoreStockSearch(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.item.product.name.localeCompare(right.item.product.name, "es", { numeric: true }))
    .map(({ item }) => stockRowToCatalogEntry(item))
    .filter((entry) => {
      const key = entry.priceChartingId || `${normalize(entry.productName)}|${normalize(entry.expansionName)}|${normalize(entry.cardNumber)}|${normalize(entry.language || "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function stockRowToCatalogEntry(item: StockRow): PriceChartingCacheEntry {
  const priceChartingIdentifier = item.product.identifiers.find((identifier) => identifier.source === "pricecharting");
  const priceChartingReference = item.priceReferences?.priceCharting;
  const priceChartingId = priceChartingReference?.priceChartingId || priceChartingIdentifier?.externalId || item.sku;
  return {
    priceChartingId,
    canonicalUrl: priceChartingReference?.url || priceChartingIdentifier?.url || "",
    sourceUrl: "",
    productName: item.product.name,
    expansionName: item.product.expansion,
    cardNumber: item.product.number || "",
    languageGroup: inventoryLanguageGroup(item.variant.language),
    language: item.variant.language,
    finish: item.variant.finish || "normal",
    loosePriceUsd: priceChartingReference?.usd ?? item.priceUsd,
    tcgplayerPriceUsd: item.priceReferences?.tcgplayer.marketPriceUsd ?? item.priceReferences?.tcgplayer.usd ?? null,
    tcgplayerSubtype: item.priceReferences?.tcgplayer.subTypeName || "",
    imageUrl: item.product.imageUrl || "",
    importedAt: ""
  };
}

function mergeCatalogPickerEntries(primary: PriceChartingCacheEntry[], fallback: PriceChartingCacheEntry[], limit: number): PriceChartingCacheEntry[] {
  const seen = new Set<string>();
  const seenCatalogIdentity = new Set<string>();
  const seenLooseIdentity = new Set<string>();
  const merged: PriceChartingCacheEntry[] = [];
  const sortedPrimary = [...primary].sort((left, right) => {
    const leftHasPrice = left.loosePriceUsd !== null && left.loosePriceUsd !== undefined;
    const rightHasPrice = right.loosePriceUsd !== null && right.loosePriceUsd !== undefined;
    if (leftHasPrice !== rightHasPrice) return leftHasPrice ? -1 : 1;
    const leftHasImage = Boolean(left.imageUrl);
    const rightHasImage = Boolean(right.imageUrl);
    if (leftHasImage !== rightHasImage) return leftHasImage ? -1 : 1;
    return left.productName.localeCompare(right.productName, "es", { numeric: true });
  });
  for (const entry of [...sortedPrimary, ...fallback]) {
    const key = entry.priceChartingId || `${normalize(entry.productName)}|${normalize(entry.expansionName)}|${normalize(entry.cardNumber)}|${normalize(entry.language || "")}`;
    const identity = catalogPickerIdentity(entry);
    const looseIdentity = catalogPickerLooseIdentity(entry);
    const isReferenceOnly = isTcgCatalogEntry(entry) && (entry.loosePriceUsd === null || entry.loosePriceUsd === undefined);
    if (seen.has(key)) continue;
    if (isReferenceOnly && seenCatalogIdentity.has(identity)) continue;
    if (isReferenceOnly && seenLooseIdentity.has(looseIdentity)) continue;
    seen.add(key);
    seenCatalogIdentity.add(identity);
    seenLooseIdentity.add(looseIdentity);
    merged.push(entry);
    if (merged.length >= limit) break;
  }
  return merged;
}

function isTcgCatalogEntry(entry: PriceChartingCacheEntry) {
  return entry.priceChartingId.startsWith("tcgcsv-") || entry.canonicalUrl.includes("tcgplayer.com");
}

function catalogSourceLabel(entry: PriceChartingCacheEntry) {
  if (isTcgCatalogEntry(entry)) return "TCGPlayer";
  return "PriceCharting";
}

function cleanCatalogPickerName(entry: PriceChartingCacheEntry) {
  const name = entry.productName.replace(/\s+-\s+\d+\s*\/\s*\d+\s*$/i, "").trim();
  return name || entry.productName;
}

function cleanCatalogPickerExpansion(entry: PriceChartingCacheEntry) {
  const expansion = entry.expansionName.replace(/^[A-Z]{1,5}\d*:\s*/i, "").trim();
  return expansion || entry.expansionName;
}

function catalogPickerIdentity(entry: PriceChartingCacheEntry) {
  return [
    normalize(cleanCatalogPickerName(entry)),
    normalize(entry.normalizedExpansion || cleanCatalogPickerExpansion(entry)),
    primaryCardNumber(entry.cardNumber || ""),
    normalize(entry.language || entry.languageGroup || ""),
    normalize(entry.finish || "normal")
  ].join("|");
}

function catalogPickerLooseIdentity(entry: PriceChartingCacheEntry) {
  return [
    normalize(cleanCatalogPickerName(entry)),
    primaryCardNumber(entry.cardNumber || ""),
    normalize(entry.language || entry.languageGroup || ""),
    normalize(entry.finish || "normal")
  ].join("|");
}

function CurrencyToggle({ value, onChange }: { value: "USD" | "ARS"; onChange: (value: "USD" | "ARS") => void }) {
  return (
    <div className="catalog-currency-toggle" aria-label="Moneda del catalogo">
      <span>Moneda:</span>
      {(["USD", "ARS"] as const).map((currency) => (
        <button className={value === currency ? "active" : ""} key={currency} type="button" onClick={() => onChange(currency)}>
          {currency}
        </button>
      ))}
    </div>
  );
}

function CatalogPickerPrices({ entry, blueRate, currency }: { entry: PriceChartingCacheEntry; blueRate: BlueExchangeRate; currency: "USD" | "ARS" }) {
  const pc = entry.loosePriceUsd ?? null;
  const tcg = entry.tcgplayerPriceUsd ?? null;
  return (
    <div className="catalog-picker-prices">
      <CatalogPickerPriceLine label="PC" description="Precio de PriceCharting" valueUsd={pc} blueRate={blueRate} currency={currency} missingLabel="Sin precio PC" />
      <CatalogPickerPriceLine label="TCG" description="Precio de TCGPlayer" valueUsd={tcg} blueRate={blueRate} currency={currency} missingLabel="Sin precio TCG" note={entry.tcgplayerSubtype || ""} />
    </div>
  );
}

function CatalogPickerPriceLine({ label, description, valueUsd, blueRate, currency, missingLabel, note = "" }: { label: string; description: string; valueUsd: number | null; blueRate: BlueExchangeRate; currency: "USD" | "ARS"; missingLabel: string; note?: string }) {
  const hasPrice = valueUsd !== null && valueUsd !== undefined && Number.isFinite(valueUsd);
  return (
    <span className={`catalog-picker-price-line ${hasPrice ? "" : "missing"}`} title={`${label}: ${description}`}>
      <small>{label}</small>
      <strong>{hasPrice ? formatCatalogCurrency(Number(valueUsd), blueRate, currency) : missingLabel}</strong>
      {note && hasPrice ? <em>{note}</em> : null}
    </span>
  );
}

function formatCatalogCurrency(valueUsd: number, blueRate: BlueExchangeRate, currency: "USD" | "ARS") {
  return currency === "USD" ? formatUsd(valueUsd) : formatArs(toBlueArs(valueUsd, blueRate));
}

function finishLabel(value: string) {
  const normalized = normalize(value);
  if (normalized === "reverse holo" || normalized === "reverse") return "Reverse";
  if (normalized === "cosmos holo") return "Cosmos";
  if (normalized === "master ball" || normalized === "masterball") return "Master Ball";
  if (normalized === "poke ball" || normalized === "pokeball") return "Poke Ball";
  if (normalized === "holo") return "Holo";
  return value;
}

const arsFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
function formatArs(value: number) {
  return arsFormatter.format(value);
}

function fallbackBlueRate(): BlueExchangeRate {
  return {
    buy: null,
    sell: fallbackBlueRateSell,
    source: "fallback local",
    updatedAt: "",
    fallback: true
  };
}

function toBlueArs(valueUsd: number | null | undefined, blueRate: BlueExchangeRate) {
  if (!valueUsd || valueUsd <= 0) return 0;
  return valueUsd * blueRate.sell;
}

function fromBlueArs(valueArs: number | null | undefined, blueRate: BlueExchangeRate) {
  if (!valueArs || valueArs <= 0 || blueRate.sell <= 0) return 0;
  return valueArs / blueRate.sell;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatUsd(value: number | null) {
  if (value === null) return "Sin precio";
  return usdFormatter.format(value);
}

function roundUsd(value: number) {
  return Math.round(value * 100) / 100;
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function imageModeLabel(mode: ImageResolverMode) {
  if (mode === "external-index") return "URLs por indice externo";
  return mode === "pokemon-tcg" ? "API Pokemon TCG" : "Fuentes automaticas";
}

function cardIndexStatusLabel(status: CardIndexEntry["matchStatus"]) {
  if (status === "matched") return "Match fuerte";
  if (status === "weak_match") return "Revisar match";
  if (status === "conflict") return "Conflicto";
  if (status === "manual") return "Manual";
  return "Solo PriceCharting";
}

function cardIndexReviewStatusLabel(status: CardIndexEntry["reviewStatus"]) {
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Marcado incorrecto";
  if (status === "manual") return "Corregido manual";
  return "Pendiente";
}

function catalogImageSourceLabel(source: string) {
  if (!source) return "Sin imagen";
  if (source === "tcgplayer") return "TCGplayer";
  if (source === "local") return "Local";
  if (source === "pokemontcg") return "PokemonTCG";
  if (source === "tcgdex") return "TCGdex";
  if (source === "pricecharting") return "PriceCharting";
  return source;
}

function cardIndexEvidenceLabel(entry: CardIndexEntry) {
  const evidence = entry.evidence || {};
  const reasons = Array.isArray(evidence.reasons) ? evidence.reasons.map(String).filter(Boolean) : [];
  if (reasons.length) return `Coincidio por ${reasons.join(", ")}`;
  if (entry.matchStatus === "pricecharting_only") return "Todavia no se encontro link externo";
  if (entry.matchStatus === "conflict") return "Hay mas de un candidato para revisar";
  return "Sin detalle de evidencia";
}

function shortError(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120) || "Sin detalle";
}

function assetUrl(value: string) {
  if (!value.startsWith("/pricecharting-images/")) return value;
  return buildApiRequestUrl(value);
}

function canvasAssetUrl(value: string) {
  const resolved = assetUrl(value);
  if (/^https?:\/\//i.test(resolved)) return buildApiRequestUrl(`/image-proxy?url=${encodeURIComponent(resolved)}`);
  return resolved;
}

function exportInventoryCsv(items: StockRow[]) {
  downloadCsv("ultimoturno-inventario-vista.csv", [
    ["sku", "name", "expansion", "number", "language", "condition", "finish", "gradingCompany", "grade", "gradingCert", "quantityOnHand", "quantityReserved", "availableQuantity", "priceArs", "priceUsd", "lastPurchaseArs", "lastPurchaseAt", "location", "intakeBatch", "inventoryStatus", "tags", "priceChartingId", "priceChartingUrl", "imageUrl"],
    ...items.map((item) => {
      const priceCharting = item.product.identifiers.find((identifier) => identifier.source === "pricecharting");
      return [
        item.sku,
        item.product.name,
        item.product.expansion,
        item.product.number || "",
        item.variant.language,
        item.variant.condition,
        item.variant.finish,
        item.variant.gradingCompany || "",
        item.variant.grade || "",
        item.variant.gradingCert || "",
        item.quantityOnHand,
        item.quantityReserved,
        item.availableQuantity,
        item.priceArs,
        item.priceUsd ?? "",
        item.lastPurchaseArs ?? "",
        item.lastPurchaseAt || "",
        item.location,
        item.intakeBatch || "",
        item.inventoryStatus || "available",
        item.tags || "",
        priceCharting?.externalId || "",
        priceCharting?.url || "",
        item.product.imageUrl || ""
      ];
    })
  ]);
}

function exportClaimWorkspaceCsv(workspace: ClaimsWorkspace) {
  const claim = workspace.activeClaim;
  if (!claim) return;
  const sectionNames = new Map(workspace.sections.map((section) => [section.id, section.name]));
  const rows: Array<Array<string | number>> = [
    ["type", "claim", "section", "buyer", "finalName", "name", "expansion", "number", "quantity", "priceArs", "priceUsd", "priceChartingUrl", "priceChartingId", "sku", "imageUrl", "tags", "notes", "status"]
  ];
  for (const card of workspace.cards) {
    rows.push([
      "CARD",
      claim.name,
      sectionNames.get(card.sectionId) || "Sin seccion",
      card.buyer,
      card.finalName || claimFinalName(card, card.finalPriceArs, card.finalPriceUsd),
      card.productName,
      card.expansionName,
      card.cardNumber,
      Math.max(1, card.quantity || 1),
      card.finalPriceArs,
      card.finalPriceUsd,
      card.canonicalUrl,
      card.priceChartingId,
      card.priceChartingId ? `PKM-PC-${card.priceChartingId}` : "",
      card.imageUrl,
      card.tags,
      "",
      card.status
    ]);
  }
  for (const free of workspace.frees) {
    rows.push([
      "FREE",
      claim.name,
      "Frees",
      free.buyer,
      free.finalName,
      free.productName,
      free.expansionName,
      "",
      free.quantity,
      0,
      0,
      free.canonicalUrl,
      free.priceChartingId,
      free.priceChartingId ? `PKM-PC-${free.priceChartingId}` : "",
      "",
      free.tags,
      free.notes,
      "free"
    ]);
  }
  downloadCsv(`ultimoturno-claim-${safeFilePart(claim.name)}.csv`, rows);
}

function exportClaimOrdersPreviewCsv(preview: ClaimOrderPreview) {
  const rows: Array<Array<string | number>> = [
    ["type", "claim", "buyer", "lineType", "displayName", "productName", "expansion", "quantity", "unitPriceArs", "unitPriceUsd", "lineTotalArs", "lineTotalUsd", "priceChartingId", "tags", "sourceReference"]
  ];
  for (const buyer of preview.buyers) {
    for (const line of buyer.lines) {
      rows.push([
        "LINE",
        preview.claimName,
        buyer.buyer,
        line.kind,
        line.displayName,
        line.productName,
        line.expansionName,
        line.quantity,
        line.unitPriceArs,
        line.unitPriceUsd,
        line.lineTotalArs,
        line.lineTotalUsd,
        line.priceChartingId,
        line.tags,
        line.sourceReference
      ]);
    }
    rows.push([
      "BUYER_TOTAL",
      preview.claimName,
      buyer.buyer,
      "",
      "",
      "",
      "",
      buyer.units,
      "",
      "",
      buyer.totalArs,
      buyer.totalUsd,
      "",
      "",
      ""
    ]);
  }
  rows.push([
    "CLAIM_TOTAL",
    preview.claimName,
    "",
    "",
    "",
    "",
    "",
    preview.totals.units,
    "",
    "",
    preview.totals.totalArs,
    preview.totals.totalUsd,
    "",
    "",
    `${preview.totals.buyers} compradores / ${preview.totals.lines} lineas`
  ]);
  downloadCsv(`${safeFilePart(preview.claimName)}-ordenes-preview.csv`, rows);
}

async function generateClaimGridImages(workspace: ClaimsWorkspace): Promise<number> {
  const claim = workspace.activeClaim;
  if (!claim) throw new Error("No hay un claim activo.");
  const cards = orderedClaimCardsForRun(workspace.cards, workspace.sections);
  if (!cards.length) throw new Error("No hay cartas para generar la grilla.");
  const chunkSize = 30;
  const chunks = chunkArray(cards, chunkSize);
  for (let index = 0; index < chunks.length; index++) {
    const blob = await renderClaimGridPng(chunks[index]);
    downloadBlob(`${index + 1}.png`, blob);
  }
  return chunks.length;
}

async function renderClaimGridPng(cards: ClaimCard[]): Promise<Blob> {
  const columns = 5;
  const rows = 6;
  const cardWidth = 220;
  const cardHeight = 308;
  const gap = 16;
  const padding = 24;
  const canvas = document.createElement("canvas");
  canvas.width = padding * 2 + columns * cardWidth + (columns - 1) * gap;
  canvas.height = padding * 2 + rows * cardHeight + (rows - 1) * gap;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la grilla.");

  context.fillStyle = "#060608";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(232, 42, 64, 0.55)";
  context.lineWidth = 6;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

  for (let index = 0; index < columns * rows; index++) {
    const card = cards[index];
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + col * (cardWidth + gap);
    const y = padding + row * (cardHeight + gap);
    context.fillStyle = "#111116";
    context.fillRect(x, y, cardWidth, cardHeight);
    if (!card) continue;
    const image = card.imageUrl ? await loadCanvasImage(canvasAssetUrl(card.imageUrl)) : null;
    if (image) {
      drawCoverImage(context, image, x, y, cardWidth, cardHeight);
    } else {
      drawGridPlaceholder(context, card, x, y, cardWidth, cardHeight);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo exportar la grilla.")), "image/png");
  });
}

function loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawCoverImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  const sourceWidth = sourceRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth;
  const sourceHeight = sourceRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawGridPlaceholder(context: CanvasRenderingContext2D, card: ClaimCard, x: number, y: number, width: number, height: number) {
  context.fillStyle = "#16161c";
  context.fillRect(x, y, width, height);
  context.strokeStyle = "rgba(232, 42, 64, 0.7)";
  context.lineWidth = 2;
  context.strokeRect(x + 8, y + 8, width - 16, height - 16);
  context.fillStyle = "#f5f5f6";
  context.font = "700 20px Arial, sans-serif";
  wrapCanvasText(context, card.productName || "Sin imagen", x + 18, y + 86, width - 36, 25, 4);
  context.fillStyle = "#b0b0b8";
  context.font = "600 15px Arial, sans-serif";
  wrapCanvasText(context, `${card.expansionName} ${card.cardNumber ? `#${card.cardNumber}` : ""}`.trim(), x + 18, y + height - 72, width - 36, 20, 2);
  context.fillStyle = "#ff4b61";
  context.font = "800 14px Arial, sans-serif";
  context.fillText(card.priceChartingId ? `PC ${card.priceChartingId}` : "SIN IMAGEN", x + 18, y + height - 28);
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines++;
      if (lines >= maxLines) return;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) context.fillText(line, x, y + lines * lineHeight);
}

function exportImportIssuesCsv(rows: SnapshotPreviewRow[]) {
  const issueRows = rows.filter((row) => row.action === "invalid" || row.action === "review");
  downloadCsv("ultimoturno-importacion-problemas.csv", [
    ["rowNumber", "action", "name", "expansion", "number", "language", "condition", "finish", "gradingCompany", "grade", "gradingCert", "quantityOnHand", "warnings", "priceChartingCandidates"],
    ...issueRows.map((row) => [
      row.rowNumber,
      snapshotActionLabel(row.action),
      row.name,
      row.expansion,
      row.number,
      row.language,
      row.condition,
      row.finish,
      row.gradingCompany,
      row.grade,
      row.gradingCert,
      row.quantityOnHand,
      row.warnings.join(" | "),
      row.priceChartingCandidates.map((candidate) => `${candidate.productName} ${candidate.expansionName} #${candidate.cardNumber} (${candidate.priceChartingId})`).join(" | ")
    ])
  ]);
}

function mobileEntriesToSnapshotCsv(entries: MobileInventoryEntry[]) {
  return toCsvText([
    ["mobileEntryId", "name", "expansion", "number", "language", "condition", "finish", "gradingCompany", "grade", "location", "intakeBatch", "inventoryStatus", "quantityOnHand", "priceArs", "priceUsd", "sku", "priceChartingId", "imageUrl", "notes"],
    ...entries.map((entry) => [
      entry.id,
      entry.name,
      entry.expansion,
      entry.number,
      entry.language,
      entry.condition,
      entry.finish,
      entry.gradingCompany,
      entry.grade,
      entry.location,
      entry.intakeBatch,
      "available",
      entry.quantityOnHand,
      entry.priceArs,
      entry.priceUsd ?? "",
      entry.sku,
      entry.priceChartingId,
      entry.imageUrl,
      [entry.notes, entry.helperName ? `Cargado por ${entry.helperName}` : "", `Pre-base movil ${formatShortDate(entry.createdAt)}`].filter(Boolean).join(" | ")
    ])
  ]);
}

function safeFilePart(value: string) {
  return String(value || "claim").trim().toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "claim";
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadCsv(fileName: string, rows: Array<Array<string | number>>) {
  const csv = toCsvText(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsvText(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map((cell) => {
    const value = String(cell ?? "");
    return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(",")).join("\n");
}

function formatDelta(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function movementLabel(value: string) {
  const labels: Record<string, string> = {
    manual_adjustment: "Ajuste manual",
    import: "Importacion",
    sale: "Venta",
    reservation: "Reserva creada",
    reservation_sale: "Reserva cobrada",
    reservation_release: "Reserva liberada",
    purchase: "Compra"
  };
  return labels[value] || value;
}

function auditLabel(value: string) {
  const labels: Record<string, string> = {
    "inventory.create": "Producto creado",
    "inventory.update": "Producto editado",
    "inventory.adjust": "Ajuste de stock",
    "sale.create": "Venta registrada",
    "sale.reserve": "Reserva creada",
    "sale.complete": "Reserva cobrada",
    "sale.cancel": "Reserva cancelada",
    "purchase.create": "Compra registrada"
  };
  return labels[value] || value;
}

function snapshotActionLabel(value: SnapshotPreviewRow["action"]) {
  const labels = { create: "Crear", update: "Actualizar", review: "Elegir coincidencia", invalid: "Error" };
  return labels[value];
}

function saleStatusLabel(value: SaleRecord["status"]) {
  return { pending: "Pendiente", packed: "Embalada", paid: "Pagada", delivered: "Entregada", cancelled: "Cancelada" }[value];
}

function buildClaimOrderMessage(order: SaleRecord) {
  const claimDate = formatClaimMessageDate(order.createdAt);
  const paymentDue = order.paymentDueAt ? formatClaimMessageDate(order.paymentDueAt) : "";
  const lines = order.lines.filter((line) => !line.name.toUpperCase().startsWith("FREE -"));
  const frees = order.lines.filter((line) => line.name.toUpperCase().startsWith("FREE -"));
  const paid = order.amountPaidArs || 0;
  const remaining = Math.max(0, order.totalArs - paid);
  return [
    `🧾 Hola! te envio tu resumen del claim del dia ${claimDate} en el grupo Claimo`,
    "",
    ...lines.map((line) => `- ${line.name}${line.quantity > 1 ? ` - hay ${line.quantity}` : ""}`),
    ...(frees.length ? ["", "Frees:", ...frees.map((line) => `- ${line.name.replace(/^FREE - /i, "")}${line.quantity > 1 ? ` - hay ${line.quantity}` : ""}`)] : []),
    "",
    `Total: ${formatOrderTotals(order.totalArs, order.totalUsd)}`,
    paid > 0 ? `Pagado: ${formatArs(paid)}` : "",
    paid > 0 ? `Restante: ${formatArs(remaining)}` : "",
    paymentDue ? `Fecha limite de pago: ${paymentDue}` : "",
    "💸 Podes abonar al siguiente alias: ut.poke a nombre de Melody Castillo",
    "",
    "📍 Podes retirar por microcentro o los sabados en nuestra mesa en lo de charly (caballito)",
    "",
    "📦 Tambien hacemos envios a todo el pais, a cargo del comprador  :D",
    "",
    "✨ avisame cualquier duda, saludos!"
  ].filter((line, index, all) => line || all[index - 1] !== "").join("\n");
}

function formatClaimMessageDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()} de ${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][date.getMonth()]}`;
}

function formatOrderTotals(totalArs: number, totalUsd: number) {
  const parts = [];
  if (totalArs > 0) parts.push(formatArs(totalArs));
  if (totalUsd > 0) parts.push(formatUsd(totalUsd));
  return parts.length ? parts.join(" + ") : formatArs(0);
}

function channelLabel(value: string) {
  const labels: Record<string, string> = { mostrador: "Mostrador", mesa: "Mesa / feria", instagram: "Instagram", whatsapp: "WhatsApp", web: "Web" };
  return labels[value] || value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);




