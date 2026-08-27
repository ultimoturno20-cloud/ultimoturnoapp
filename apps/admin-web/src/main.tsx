import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type View = "dashboard" | "inventory" | "claims" | "claim-live" | "orders" | "sales" | "purchases" | "catalog" | "movements" | "import" | "admin";
type AvailabilityFilter = "all" | "available" | "reserved" | "out";
type SortMode = "name" | "expansion" | "number" | "price" | "quantity";
type IssueFilter = "all" | "missingImage" | "missingPriceCharting" | "zeroPrice" | "lowStock" | "duplicates";
type InventoryPriceSource = "sale" | "pricecharting" | "tcgplayer" | "coolstuff";
type InventoryDensity = "comfortable" | "compact";
type InventoryBatchPatch = {
  location?: string;
  intakeBatch?: string;
  inventoryStatus?: string;
  priceSource?: InventoryPriceSource;
};
type CardIndexFilter = "all" | "matched" | "pending_review" | "weak_match" | "conflict" | "pricecharting_only" | "missing_tcg" | "missing_image" | "approved" | "rejected" | "manual";
type OrderFilter = "all" | "pending" | "packed" | "paid" | "debt" | "message" | "note";
type InventoryFilters = {
  query: string;
  expansion: string;
  language: string;
  condition: string;
  location: string;
  intakeBatch: string;
  inventoryStatus: string;
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
  id: string;
  businessId: string;
  sku: string;
  location: string;
  intakeBatch: string;
  inventoryStatus: string;
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
  expansionName: string;
  cardNumber: string;
  loosePriceUsd: number | null;
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
  sku: string;
  name: string;
  expansion: string;
  number: string;
  imageUrl: string;
  language: string;
  condition: string;
  finish: string;
  gradingCompany: string;
  grade: string;
  gradingCert: string;
  location: string;
  intakeBatch: string;
  inventoryStatus: string;
  quantityOnHand: number;
  quantityReserved: number;
  priceArs: number;
  priceUsd: number | null;
  notes: string;
};

const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";
const accessKeyStorageKey = "ultimoturno_access_key";
const accessKeyCookieName = "ultimoturno_access_key";
const importDraftStorageKey = "ultimoturno_import_stock_draft_v2";
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
  const [userName, setUserName] = useState("");
  const [environment, setEnvironment] = useState<AppEnvironment>({ dataProfile: "EJEMPLOS", allowExamples: true });
  const [blueRate, setBlueRate] = useState<BlueExchangeRate>(() => fallbackBlueRate());
  const [view, setView] = useState<View>("dashboard");
  const [stock, setStock] = useState<{ summary: StockSummary; items: StockRow[] }>({ summary: emptySummary(), items: [] });
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [importRuns, setImportRuns] = useState<ImportRunRow[]>([]);
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
  const [purchaseCart, setPurchaseCart] = useState<PurchaseCartLine[]>([]);
  const [purchaseSeller, setPurchaseSeller] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [importResolutions, setImportResolutions] = useState<Record<number, ImportResolution>>({});
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [expansion, setExpansion] = useState("all");
  const [language, setLanguage] = useState("all");
  const [condition, setCondition] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState("all");
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
  const [showImageCatalog, setShowImageCatalog] = useState(false);
  const [imageCatalog, setImageCatalog] = useState<{ entries: ImageCatalogEntry[]; total: number }>({ entries: [], total: 0 });
  const [imageCatalogLoading, setImageCatalogLoading] = useState(false);
  const [imageCatalogFilter, setImageCatalogFilter] = useState<"all" | "downloaded" | "url_found" | "failed" | "pending">("all");
  const [imageCatalogSearch, setImageCatalogSearch] = useState("");

  async function fetchOperationalData() {
    const [stockData, movementData, auditData, me] = await Promise.all([
      api<{ summary: StockSummary; items: StockRow[] }>("/stock"),
      api<{ movements: MovementRow[] }>("/movements"),
      api<{ audit: AuditRow[] }>("/audit"),
      api<{ user: { displayName: string }; environment?: AppEnvironment }>("/auth/me")
    ]);
    const [salesData, purchasesData, importData, claimsData, priceChartingData, priceChartingAutoRefreshData, tcgplayerPriceData, tcgplayerPriceAutoRefreshData, cardIndexData, cardIndexListData, blueRateData] = await Promise.all([
      api<{ sales: SaleRecord[] }>("/sales").catch(() => ({ sales: [] })),
      api<{ purchases: PurchaseRecord[] }>("/purchases").catch(() => ({ purchases: [] })),
      api<{ imports: ImportRunRow[] }>("/imports").catch(() => ({ imports: [] })),
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
    return { stockData, movementData, auditData, salesData, purchasesData, importData, claimsData, priceChartingData, priceChartingAutoRefreshData, tcgplayerPriceData, tcgplayerPriceAutoRefreshData, priceChartingImageData, cardIndexData, cardIndexListData, blueRateData, me };
  }

  async function refresh(seedExamplesIfEmpty = false) {
    let { stockData, movementData, auditData, salesData, purchasesData, importData, claimsData, priceChartingData, priceChartingAutoRefreshData, tcgplayerPriceData, tcgplayerPriceAutoRefreshData, priceChartingImageData, cardIndexData, cardIndexListData, blueRateData, me } = await fetchOperationalData();
    if (seedExamplesIfEmpty && stockData.items.length === 0 && me.environment?.allowExamples !== false) {
      const result = await api<{ created: number; skipped: number }>("/examples/inventory", { method: "POST" });
      ({ stockData, movementData, auditData, salesData, purchasesData, importData, claimsData, priceChartingData, priceChartingAutoRefreshData, tcgplayerPriceData, tcgplayerPriceAutoRefreshData, priceChartingImageData, cardIndexData, cardIndexListData, blueRateData, me } = await fetchOperationalData());
      if (result.created > 0) showMessage(`Cargue ${result.created} ejemplos para que puedas revisar el flujo.`);
    }
    setStock(stockData);
    setMovements(movementData.movements);
    setAudit(auditData.audit);
    setSales(salesData.sales);
    setPurchases(purchasesData.purchases);
    setImportRuns(importData.imports);
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
    refresh(true).catch((nextError) => {
      if (isAccessError(nextError)) setAccessRequired(true);
      else setError(errorMessage(nextError));
    });
  }, [initialExamplesChecked]);

  useEffect(() => {
    if (!["catalog", "admin"].includes(view) || priceChartingImages.totalEntries) return;
    refreshPriceChartingImageStatus().catch(() => undefined);
  }, [priceChartingImages.totalEntries, view]);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, error ? 6000 : 3500);
    return () => window.clearTimeout(timeout);
  }, [error, message]);

  useEffect(() => {
    window.localStorage.setItem(importDraftStorageKey, JSON.stringify({ csvText, batch: importBatch }));
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
    inventoryStatuses: unique(stock.items.map((item) => item.inventoryStatus || "available"))
  }), [stock.items]);
  const visibleItems = useMemo(() => {
    const parsedSearch = parseUiSearchQuery(query);
    return stock.items
      .map((item) => ({ item, searchScore: scoreStockSearch(item, parsedSearch) }))
      .filter(({ item, searchScore }) => {
        return (!parsedSearch.tokens.length || searchScore > 0) &&
          (expansion === "all" || item.product.expansion === expansion) &&
          (language === "all" || item.variant.language === language) &&
          (condition === "all" || item.variant.condition === condition) &&
          (locationFilter === "all" || item.location === locationFilter) &&
          (batchFilter === "all" || item.intakeBatch === batchFilter) &&
          (inventoryStatusFilter === "all" || (item.inventoryStatus || "available") === inventoryStatusFilter) &&
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
  }, [availability, batchFilter, blueRate, condition, duplicateKeys, expansion, inventoryPriceSource, inventoryStatusFilter, issue, language, locationFilter, query, sortMode, stock.items]);

  function showMessage(text: string) {
    setMessage(text);
    setError("");
  }

  function showError(nextError: unknown) {
    setError(errorMessage(nextError));
    setMessage("");
  }

  function startCreate() {
    setEditingId("");
    setForm(blankForm());
    setView("inventory");
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
    setProductModalOpen(false);
    setEditingId("");
    setProductSaving(false);
    setProductImageForcing("");
    setForm(blankForm());
  }

  async function saveProduct(event: React.FormEvent) {
    event.preventDefault();
    if (productSaving) return;
    setProductSaving(true);
    try {
      const result = await api<{ item: StockRow }>(editingId ? `/inventory/${editingId}` : "/inventory", {
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
      showMessage(editingId ? "Producto actualizado." : "Producto creado.");
      setForm(blankForm());
      setEditingId("");
      setProductModalOpen(false);
      void refresh().catch(() => undefined);
    } catch (nextError) {
      showError(nextError);
    } finally {
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

  async function searchPriceChartingCache(search: string) {
    try {
      const result = await api<{ entries: PriceChartingCacheEntry[]; status: PriceChartingCacheStatus }>(`/pricecharting-cache?query=${encodeURIComponent(search)}&limit=60`);
      setPriceChartingCache(result);
    } catch (nextError) {
      showError(nextError);
    }
  }

  async function searchCardIndex(search: string, filter: CardIndexFilter = "all") {
    try {
      const result = await api<{ entries: CardIndexEntry[]; status: CardIndexStatus }>(`/card-index?query=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&limit=120`);
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
      const result = await api<{ status: CardIndexStatus }>("/card-index/rebuild-pricecharting", { method: "POST" });
      setCardIndexStatus(result.status);
      await searchCardIndex("");
      showMessage(`Indice maestro reconstruido: ${result.status.totalEntries.toLocaleString("es-AR")} cartas.`);
    } catch (nextError) {
      showError(nextError);
    } finally {
      setCardIndexSyncing(false);
    }
  }

  async function syncCardIndexTcgCsv() {
    setCardIndexSyncing(true);
    try {
      const result = await api<{ started: boolean; alreadyRunning?: boolean; pid?: number; progress?: unknown; progressPath: string }>("/card-index/sync-tcgcsv", {
        method: "POST",
        body: { groupOffset: cardIndexNextGroupOffset || 0, groupLimit: 5, loop: true }
      });
      showMessage(result.alreadyRunning ? "El worker TCGCSV ya esta corriendo." : `Worker TCGCSV iniciado${result.pid ? ` (PID ${result.pid})` : ""}.`);
      setCardIndexNextGroupOffset(null);
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

  async function previewSnapshot(nextCsvText = csvText) {
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

  async function applySnapshot() {
    try {
      await api("/imports/snapshot/apply", {
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
      window.localStorage.removeItem(importDraftStorageKey);
      showMessage("Importacion aplicada.");
      await refresh();
    } catch (nextError) {
      showError(nextError);
    }
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
    <main className="shell">
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
        <NavButton icon="inventory" active={view === "inventory"} onClick={() => setView("inventory")}>Inventario / Venta</NavButton>
        <NavButton icon="purchases" active={view === "purchases"} onClick={() => setView("purchases")}>Compras</NavButton>
        <NavButton icon="claims" active={view === "claims"} onClick={() => setView("claims")}>Claims</NavButton>
        <NavButton icon="play" active={view === "claim-live"} onClick={() => setView("claim-live")}>Claim en vivo</NavButton>
        <NavButton icon="orders" active={view === "orders"} onClick={() => setView("orders")}>Ordenes</NavButton>
        <NavButton icon="sales" active={view === "sales"} onClick={() => setView("sales")}>Caja</NavButton>
        <NavButton icon="import" active={view === "import"} onClick={() => setView("import")}>Importar</NavButton>
        <NavButton icon="palette" active={view === "catalog"} onClick={() => setView("catalog")}>Calidad</NavButton>
        <NavButton icon="activity" active={view === "movements"} onClick={() => setView("movements")}>Movimientos</NavButton>
        <NavButton icon="settings" active={view === "admin"} onClick={() => setView("admin")}>Admin</NavButton>
      </nav>

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
          onGoInventory={() => setView("inventory")}
          onGoOrders={() => setView("orders")}
          onGoSales={() => setView("sales")}
          onOpenInventoryIssue={(nextIssue) => {
            setQuery("");
            setExpansion("all");
            setLanguage("all");
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
          filters={{ query, expansion, language, condition, location: locationFilter, intakeBatch: batchFilter, inventoryStatus: inventoryStatusFilter, availability, priceSource: inventoryPriceSource, sortMode, issue }}
          density={inventoryDensity}
          quality={quality}
          adjustment={adjustment}
          cart={cart}
          cartMode={cartMode}
          customerName={customerName}
          saleChannel={saleChannel}
          onFilterChange={(patch) => {
            if (patch.query !== undefined) setQuery(patch.query);
            if (patch.expansion !== undefined) setExpansion(patch.expansion);
            if (patch.language !== undefined) setLanguage(patch.language);
            if (patch.condition !== undefined) setCondition(patch.condition);
            if (patch.location !== undefined) setLocationFilter(patch.location);
            if (patch.intakeBatch !== undefined) setBatchFilter(patch.intakeBatch);
            if (patch.inventoryStatus !== undefined) setInventoryStatusFilter(patch.inventoryStatus);
            if (patch.availability !== undefined) setAvailability(patch.availability);
            if (patch.priceSource !== undefined) setInventoryPriceSource(patch.priceSource);
            if (patch.sortMode !== undefined) setSortMode(patch.sortMode);
            if (patch.issue !== undefined) setIssue(patch.issue);
          }}
          onClearFilters={() => {
            setQuery("");
            setExpansion("all");
            setLanguage("all");
            setCondition("all");
            setLocationFilter("all");
            setBatchFilter("all");
            setInventoryStatusFilter("all");
            setAvailability("all");
            setInventoryPriceSource("sale");
            setSortMode("name");
            setIssue("all");
          }}
          onDensityChange={setInventoryDensity}
          onBatchUpdate={(items, patch) => void updateInventoryBatch(items, patch)}
          onSelect={(item) => setSelectedId(item.id)}
          onEdit={startEdit}
          onCreate={startCreate}
          onAdjustmentChange={setAdjustment}
          onAdjustmentSubmit={saveAdjustment}
          onAvailableQuantitySet={setAvailableQuantity}
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
      {view === "orders" ? <OrdersView sales={sales} claims={claims} blueRate={blueRate} onComplete={(id) => updateOrder(id, "complete")} onCancel={(id) => updateOrder(id, "cancel")} onPacked={(id) => updateOrder(id, "packed")} onDelivered={(id) => updateOrder(id, "delivered")} onPayment={updateOrderPayment} onNote={(id, note) => void updateOrderNote(id, note)} onMessageSent={updateOrderMessageSent} onLinePacked={(id, packed) => void updateOrderLinePacked(id, packed)} /> : null}
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
          blueRate={blueRate}
          onPriceChartingSearch={(search) => void searchPriceChartingCache(search)}
          onCardIndexSearch={(search, filter) => void searchCardIndex(search, filter)}
          onCardIndexReview={(cardIndexId, input) => void reviewCardIndex(cardIndexId, input)}
          onCardIndexApproveByConfidence={(minimumConfidence, search, filter) => void approveCardIndexByConfidence(minimumConfidence, search, filter)}
          onPriceChartingSync={() => void syncPriceChartingCache()}
          onCardIndexRebuild={() => void rebuildCardIndex()}
          onCardIndexTcgCsvSync={() => void syncCardIndexTcgCsv()}
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
        />
      ) : null}
      {view === "movements" ? <MovementsView movements={movements} audit={audit} /> : null}
      {view === "import" ? (
        <ImportView csvText={csvText} rows={previewRows} resolutions={importResolutions} importBatch={importBatch} importRuns={importRuns} blueRate={blueRate} onTextChange={setCsvText} onBatchChange={setImportBatch} onPreview={() => void previewSnapshot()} onPreviewText={(text) => void previewSnapshot(text)} onApply={applySnapshot} onLoadExampleCsv={environment.allowExamples ? () => setCsvText(exampleSnapshotCsv) : undefined} onResolve={(rowNumber, resolution) => setImportResolutions((current) => ({ ...current, [rowNumber]: resolution }))} onResolveMany={(nextResolutions) => setImportResolutions((current) => ({ ...current, ...nextResolutions }))} />
      ) : null}
      {productModalOpen ? (
        <ProductModal
          form={form}
          editing={Boolean(editingId)}
          onChange={setForm}
          onSubmit={saveProduct}
          onClose={closeProductModal}
          blueRate={blueRate}
          saving={productSaving}
          imageForcing={productImageForcing}
          onForceImage={() => void forceProductImage()}
          onForceManualImage={forceProductImageManual}
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
            <button className="primary-action" onClick={onCreate}><Icon name="plus" />Crear producto</button>
            {onLoadExamples ? <button className="secondary-action" onClick={onLoadExamples}>Cargar ejemplos</button> : null}
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

function InventoryView(props: {
  items: StockRow[];
  allItems: StockRow[];
  selected?: StockRow;
  selectedMovements: MovementRow[];
  options: { expansions: string[]; languages: string[]; conditions: string[]; locations: string[]; intakeBatches: string[]; inventoryStatuses: string[] };
  filters: InventoryFilters;
  density: InventoryDensity;
  quality: StockQualitySummary;
  adjustment: { quantityDelta: number; note: string };
  cart: CartLine[];
  cartMode: "sale" | "reservation";
  customerName: string;
  saleChannel: string;
  onFilterChange: (patch: Partial<InventoryFilters>) => void;
  onClearFilters: () => void;
  onDensityChange: (density: InventoryDensity) => void;
  onBatchUpdate: (items: StockRow[], patch: InventoryBatchPatch) => void;
  onSelect: (item: StockRow) => void;
  onEdit: (item: StockRow) => void;
  onCreate: () => void;
  onAdjustmentChange: (adjustment: { quantityDelta: number; note: string }) => void;
  onAdjustmentSubmit: (event: React.FormEvent) => void;
  onAvailableQuantitySet: (item: StockRow, targetAvailable: number) => Promise<void>;
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
  const [sideTab, setSideTab] = useState<"detail" | "cart">("detail");
  const [quickStockOpen, setQuickStockOpen] = useState(false);
  const [quickStockDraft, setQuickStockDraft] = useState("");
  const [quickStockSaving, setQuickStockSaving] = useState(false);
  const [batchSelection, setBatchSelection] = useState<string[]>([]);
  const [batchLocation, setBatchLocation] = useState("");
  const [batchIntakeBatch, setBatchIntakeBatch] = useState("");
  const [batchInventoryStatus, setBatchInventoryStatus] = useState("");
  const [batchPriceSource, setBatchPriceSource] = useState<"none" | InventoryPriceSource>("none");
  const activeFilters = [filters.expansion, filters.language, filters.condition, filters.location, filters.intakeBatch, filters.inventoryStatus, filters.availability, filters.issue].filter((value) => value !== "all").length
    + (filters.priceSource !== "sale" ? 1 : 0);
  const availabilityCounts = {
    all: allItems.length,
    available: allItems.filter((item) => item.availableQuantity > 0).length,
    reserved: allItems.filter((item) => item.quantityReserved > 0).length,
    out: allItems.filter((item) => item.availableQuantity === 0).length
  };
  const priceSourceCounts = {
    sale: allItems.filter((item) => inventoryPriceDisplay(item, "sale", props.blueRate).hasPrice).length,
    pricecharting: allItems.filter((item) => inventoryPriceDisplay(item, "pricecharting", props.blueRate).hasPrice).length,
    tcgplayer: allItems.filter((item) => inventoryPriceDisplay(item, "tcgplayer", props.blueRate).hasPrice).length,
    coolstuff: allItems.filter((item) => inventoryPriceDisplay(item, "coolstuff", props.blueRate).hasPrice).length
  };
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
    if (batchPriceSource !== "none") patch.priceSource = batchPriceSource;
    if (!Object.keys(patch).length) {
      window.alert("Elegí al menos una accion para aplicar al lote.");
      return;
    }
    props.onBatchUpdate(selectedBatchItems, patch);
    setBatchSelection([]);
  };
  return (
    <section className="view stock-layout">
      <div className="panel inventory-toolbar">
        <div className="section-heading">
          <div>
            <h2>Inventario</h2>
            <p>Consulta stock, arma ventas y administra productos desde un solo lugar.</p>
          </div>
          <div className="toolbar-actions">
            <div className="density-toggle" aria-label="Densidad de inventario">
              <button className={props.density === "comfortable" ? "active" : ""} type="button" onClick={() => props.onDensityChange("comfortable")}>Grande</button>
              <button className={props.density === "compact" ? "active" : ""} type="button" onClick={() => props.onDensityChange("compact")}>Compacta</button>
            </div>
            <button className={`secondary-action filter-toggle ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen((open) => !open)}><Icon name="filter" />Filtros{activeFilters ? ` (${activeFilters})` : ""}</button>
            <button className="secondary-action" disabled={!items.length} onClick={() => exportInventoryCsv(items)}><Icon name="download" />Exportar vista</button>
            <button className="primary-action" onClick={props.onCreate}><Icon name="plus" />Nuevo producto</button>
          </div>
        </div>
        <div className="inventory-search-row">
          <label className="inventory-search">Buscar en el inventario<input value={filters.query} onChange={(event) => props.onFilterChange({ query: event.target.value })} placeholder="Nombre, SKU, expansion o numero..." /></label>
          <div className="result-count"><strong>{items.length}</strong><span>de {allItems.length} productos</span></div>
          <label className="sort-control">Ordenar<select value={filters.sortMode} onChange={(event) => props.onFilterChange({ sortMode: event.target.value as SortMode })}><option value="name">Nombre</option><option value="expansion">Expansion</option><option value="number">Numero</option><option value="price">Mayor precio</option><option value="quantity">Mayor cantidad</option></select></label>
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
          <label>Disponibilidad<select value={filters.availability} onChange={(event) => props.onFilterChange({ availability: event.target.value as AvailabilityFilter })}><option value="all">Todas</option><option value="available">Con disponible</option><option value="reserved">Con reserva</option><option value="out">Sin disponible</option></select></label>
          <button className="clear-action" onClick={props.onClearFilters}>Limpiar filtros</button>
        </div> : null}
      </div>

      <div className="stock-content inventory-workspace">
        <section className="panel product-list-panel">
          <div className="section-heading">
            <div><h3>Productos</h3><p>Selecciona una carta para ver detalles o agregala directamente.</p></div>
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
              {items.map((item) => {
                const displayPrice = inventoryPriceDisplay(item, filters.priceSource, props.blueRate);
                return (
                  <article className={`inventory-card ${selected?.id === item.id ? "selected" : ""} ${item.availableQuantity <= 0 ? "sold-out" : ""}`} key={item.id}>
                    <label className="inventory-card-checkbox" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={batchSelection.includes(item.id)} onChange={() => toggleBatchItem(item.id)} />
                    </label>
                    <button className="inventory-card-main" onClick={() => handleSelect(item)}>
                      <div className="inventory-card-image-wrap">
                        <CardArt src={item.product.imageUrl} alt={item.product.name} label={item.product.name} className="inventory-card-image" fallbackClassName="inventory-card-image placeholder" />
                        <span className={`inventory-stock-badge ${item.availableQuantity > 0 ? "" : "out-of-stock"}`}>{item.availableQuantity} disp.</span>
                      </div>
                      <div className="inventory-card-body">
                        <strong>{item.product.name}</strong>
                        <span>{item.product.expansion} #{item.product.number || "-"}</span>
                        <small>{inventoryVariantLabel(item)}</small>
                        <div className={`inventory-big-price ${displayPrice.hasPrice ? "" : "missing"}`}>
                          <span>{displayPrice.label}</span>
                          <strong>{displayPrice.hasPrice ? formatArs(displayPrice.ars || 0) : "Sin precio"}</strong>
                          <small>{displayPrice.helper}</small>
                        </div>
                      </div>
                    </button>
                    <button className="cart-chip inventory-card-add" disabled={item.availableQuantity <= 0} onClick={() => handleAdd(item)}><Icon name="cart" />Agregar</button>
                  </article>
                );
              })}
            </div>
          ) : <EmptyState title="Sin productos" body="Crea un producto o importa un snapshot para empezar." />}
        </section>

        <aside className="workspace-side">
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
                <div className="detail-actions"><button className="secondary-action" onClick={() => props.onEdit(selected)}><Icon name="edit" />Editar</button><button className="primary-action" disabled={selected.availableQuantity <= 0} onClick={() => handleAdd(selected)}><Icon name="cart" />Agregar al carrito</button></div>
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
        </aside>
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

function ProductModal({ form, editing, onChange, onSubmit, onClose, blueRate, saving, imageForcing, onForceImage, onForceManualImage }: {
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
          <div><span className="eyebrow">Inventario</span><h2 id="product-modal-title">{editing ? "Editar producto" : "Nuevo producto"}</h2><p>{editing ? "Actualiza la informacion y guarda los cambios." : "Carga la carta y su stock inicial."}</p></div>
          <button className="modal-close" aria-label="Cerrar formulario" title="Cerrar" onClick={onClose}><Icon name="close" /></button>
        </header>
        <InventoryForm form={form} onChange={onChange} onSubmit={onSubmit} onCancel={onClose} submitLabel={editing ? "Guardar cambios" : "Crear producto"} blueRate={blueRate} saving={saving} editing={editing} imageForcing={imageForcing} onForceImage={onForceImage} onForceManualImage={onForceManualImage} />
      </section>
    </div>
  );
}

function InventoryForm({ form, onChange, onSubmit, onCancel, submitLabel, blueRate, saving, editing, imageForcing, onForceImage, onForceManualImage }: {
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
}) {
  const set = (patch: Partial<InventoryFormState>) => onChange({ ...form, ...patch });
  const isGraded = Boolean(form.gradingCompany || form.grade || form.condition === "GRADED");
  const available = Math.max(0, form.quantityOnHand - form.quantityReserved);
  const convertedArs = form.priceUsd ? Math.round(toBlueArs(form.priceUsd, blueRate)) : 0;
  const setPresentation = (presentation: "RAW" | "GRADED") => {
    if (presentation === "GRADED") set({ condition: "GRADED", gradingCompany: form.gradingCompany || "PSA", grade: form.grade || "10" });
    else set({ condition: form.condition === "GRADED" ? "NM" : form.condition, gradingCompany: "", grade: "", gradingCert: "" });
  };
  return (
    <form className="modal-form-shell" onSubmit={onSubmit}>
      <div className="inventory-edit-layout">
        <aside className="inventory-edit-preview">
          <CardArt src={form.imageUrl} alt={form.name || "Carta"} label={form.name || "Sin nombre"} className="inventory-edit-art" fallbackClassName="inventory-edit-art image-placeholder" />
          <div className="inventory-edit-preview-copy">
            <span className="eyebrow">{isGraded ? "Graded" : "RAW"}</span>
            <h3>{form.name || "Sin nombre"}</h3>
            <p>{form.expansion || "Sin expansion"} {form.number ? `#${form.number}` : ""}</p>
            <div className="inventory-edit-badges">
              <span>{form.language || "EN"}</span>
              <span>{isGraded ? [form.gradingCompany, form.grade].filter(Boolean).join(" ") || "Graded" : form.condition || "NM"}</span>
              <span>{available} disp.</span>
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
              <label>Estado<select value={form.inventoryStatus} onChange={(event) => set({ inventoryStatus: event.target.value })}>{inventoryStatusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <label>Precio USD<input type="number" min={0} step={0.01} value={form.priceUsd ?? ""} onChange={(event) => set({ priceUsd: event.target.value ? Number(event.target.value) : null })} /></label>
              <label>Precio ARS<input type="number" min={0} value={form.priceArs} onChange={(event) => set({ priceArs: Number(event.target.value) })} /></label>
              <div className="price-helper"><span>Blue actual</span><strong>{formatArs(blueRate.sell)}</strong>{convertedArs ? <button type="button" className="secondary-action" onClick={() => set({ priceArs: convertedArs })}>Usar {formatArs(convertedArs)}</button> : null}</div>
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
        </div>
      </div>
      <div className="modal-footer"><button type="button" className="secondary-action" disabled={saving} onClick={onCancel}><Icon name="close" />Cancelar</button><button className="primary-action" disabled={saving}><Icon name="check" />{saving ? "Guardando..." : submitLabel}</button></div>
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

function OrdersView({ sales, claims, blueRate, onComplete, onCancel, onPacked, onDelivered, onPayment, onNote, onMessageSent, onLinePacked }: { sales: SaleRecord[]; claims: ClaimsWorkspace; blueRate: BlueExchangeRate; onComplete: (id: string) => Promise<void>; onCancel: (id: string) => Promise<void>; onPacked: (id: string) => Promise<void>; onDelivered: (id: string) => Promise<void>; onPayment: (id: string, amount: number, paymentDueAt?: string) => Promise<void>; onNote: (id: string, note: string) => void; onMessageSent: (id: string, sent: boolean) => Promise<void>; onLinePacked: (id: string, packed: boolean) => void }) {
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
    { value: "message", label: "Mensaje" },
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
    if (filter === "message") return Boolean(order.messageSentAt);
    if (filter === "note") return Boolean(order.internalNote);
    return true;
  };
  const visibleOrders = orders.filter((order) => matchesBoard(order) && matchesOrderSearch(order) && matchesOrderFilter(order, orderFilter));
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
        <div className="orders-title"><h2>Ordenes</h2><p className="muted">Trabaja por tablero: claims cerrados o pedidos sueltos.</p></div>
        <div className="orders-tools">
          <label className="orders-search"><Icon name="search" /><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Buscar comprador o carta" /></label>
          <div className="order-board-tabs">{orderBoards.map((board) => <button className={selectedBoard === board.id ? "active" : ""} key={board.id} onClick={() => setSelectedBoard(board.id)}>{board.label}<span>{board.count}</span></button>)}</div>
          <div className="orders-filters">{orderFilterOptions.map((option) => <button className={`secondary-action filter-toggle ${orderFilter === option.value ? "active" : ""}`} key={option.value} onClick={() => setOrderFilter(option.value)}>{option.label} <span>{filterCounts.get(option.value) || 0}</span></button>)}</div>
        </div>
        <div className="orders-side-info"><strong>{visibleOrders.length}/{orders.length} {showingDelivered ? "entregas" : "ordenes"}</strong><div className="orders-color-guide"><span><i className="guide-dot pending"></i>Pendiente</span><span><i className="guide-dot message"></i>Mensaje</span><span><i className="guide-dot packed"></i>Embalada</span><span><i className="guide-dot paid"></i>Pagada</span><span><i className="guide-dot delivered"></i>Entregada</span></div></div>
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

function OrderCard({ order, boardLabel, blueRate, open, focused, selected, copied, onToggle, onSelectedChange, onComplete, onCancel, onPacked, onDelivered, onPayment, onNote, onMessageSent, onLinePacked, onCopy }: { order: SaleRecord; boardLabel: string; blueRate: BlueExchangeRate; open: boolean; focused: boolean; selected: boolean; copied: boolean; onToggle: () => void; onSelectedChange: () => void; onComplete: (id: string) => Promise<void>; onCancel: (id: string) => Promise<void>; onPacked: (id: string) => Promise<void>; onDelivered: (id: string) => Promise<void>; onPayment: (id: string, amount: number, paymentDueAt?: string) => Promise<void>; onNote: (id: string, note: string) => void; onMessageSent: (sent: boolean) => void; onLinePacked: (id: string, packed: boolean) => void; onCopy: () => void }) {
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
              {canEdit ? <button className="secondary-action" onClick={() => onPacked(order.id)}><Icon name="check" />Marcar embalada</button> : null}
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
            <div className="order-lines">{order.lines.map((line) => <label className={`order-line ${line.packed ? "packed" : ""}`} key={line.saleItemId || `${order.id}-${line.inventoryItemId}-${line.name}`}><input type="checkbox" disabled={!canEdit || !line.saleItemId} checked={line.packed} onChange={(event) => onLinePacked(line.saleItemId, event.target.checked)} /><CardArt src={line.imageUrl} alt={line.name} label={line.name} className="order-line-image" fallbackClassName="order-line-image order-line-image-placeholder" /><span>{line.quantity} x {line.name}</span><MoneyStack ars={line.lineTotalArs || null} usd={line.lineTotalUsd || null} blueRate={blueRate} compact /></label>)}</div>
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
          <p>Stock valorizado, cobros pendientes, compras y ventas cobradas en un solo lugar.</p>
        </div>
        <div className="cash-hero-total"><span>Capital visible</span><strong>{formatArs(stockSaleValue + totalReceivable)}</strong><small>stock disponible + deuda a cobrar</small></div>
      </section>
      <div className="cash-metrics">
        <Metric label="Cobrado total" value={formatArs(totalCollected)} helper={`${paid.length} venta(s) cobradas`} />
        <Metric label="A cobrar" value={formatArs(totalReceivable)} helper={`${receivables.length} orden(es), ${overdueReceivables.length} vencida(s)`} />
        <Metric label="A pagar estimado" value={formatArs(purchaseTotal)} helper="compras registradas" />
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
  blueRate: BlueExchangeRate;
  onPriceChartingSearch: (search: string) => void;
  onCardIndexSearch: (search: string, filter?: CardIndexFilter) => void;
  onCardIndexReview: (cardIndexId: string, input: { action: "approve" | "reject" | "manual"; tcgplayerProductId?: string; tcgplayerUrl?: string; imageUrl?: string; note?: string }) => void;
  onCardIndexApproveByConfidence: (minimumConfidence: number, search: string, filter: CardIndexFilter) => void;
  onPriceChartingSync: () => void;
  onCardIndexRebuild: () => void;
  onCardIndexTcgCsvSync: () => void;
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

function ImportView({ csvText, rows, resolutions, importBatch, importRuns, blueRate, onTextChange, onBatchChange, onPreview, onPreviewText, onApply, onLoadExampleCsv, onResolve, onResolveMany }: {
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
          <label>Ubicacion por defecto<input value={importBatch.defaultLocation} onChange={(event) => patchBatch({ defaultLocation: event.target.value })} placeholder="Caja A, Binder 1, PSA..." /></label>
          <label>Estado inicial<select value={importBatch.defaultInventoryStatus} onChange={(event) => patchBatch({ defaultInventoryStatus: event.target.value })}>{inventoryStatusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          <label className="span-2">Nota del lote<input value={importBatch.note} onChange={(event) => patchBatch({ note: event.target.value })} placeholder="Ej.: cargado desde caja fisica, falta revisar holos" /></label>
        </section>
        <div className="import-steps">
          <div className={csvText.trim() ? "done" : "active"}><span>1</span><strong>Preparar CSV</strong><small>Plantilla o archivo propio</small></div>
          <div className={rows.length ? "done" : csvText.trim() ? "active" : ""}><span>2</span><strong>Vista previa</strong><small>Detecta errores</small></div>
          <div className={unresolved || invalid ? "active" : rows.length ? "done" : ""}><span>3</span><strong>Resolver</strong><small>Conflictos y errores</small></div>
          <div className={canApply ? "active" : ""}><span>4</span><strong>Importar</strong><small>Guarda stock</small></div>
        </div>
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
          <button className="secondary-action" disabled={!csvText.trim()} onClick={onPreview}><Icon name="search" />Generar vista previa</button>
          {rows.length ? <button className="secondary-action" disabled={!autoResolvable.length} onClick={acceptAutomaticMatches}><Icon name="check" />Resolver seguras ({autoResolvable.length})</button> : null}
          {rows.length ? <button className="secondary-action" disabled={!localCreatable} onClick={createVisibleLocal}><Icon name="plus" />Crear locales visibles ({localCreatable})</button> : null}
          {rows.length ? <button className="secondary-action" disabled={!visible.some((row) => row.action === "review" && !resolutions[row.rowNumber])} onClick={ignoreVisibleRows}><Icon name="close" />Ignorar dudas visibles</button> : null}
          {rows.length ? <button className="secondary-action" disabled={!invalid && !review} onClick={() => exportImportIssuesCsv(rows)}><Icon name="download" />Exportar problemas</button> : null}
          <button className="primary-action" disabled={!canApply} onClick={onApply}><Icon name="check" />Confirmar e importar</button>
        </div>
      </section>
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

function getStoredAccessKey() {
  try {
    return window.localStorage.getItem(accessKeyStorageKey) || "";
  } catch {
    return "";
  }
}

function setStoredAccessKey(value: string) {
  try {
    window.localStorage.setItem(accessKeyStorageKey, value);
    document.cookie = `${accessKeyCookieName}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
  } catch {
    // El header igualmente queda cubierto por localStorage cuando esta disponible.
  }
}

function clearStoredAccessKey() {
  try {
    window.localStorage.removeItem(accessKeyStorageKey);
    document.cookie = `${accessKeyCookieName}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Sin accion: es solo limpieza de credencial local.
  }
}

function isAccessError(error: unknown) {
  return Boolean(error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 401);
}

async function api<T>(path: string, options: { token?: string; method?: string; body?: unknown } = {}): Promise<T> {
  const accessKey = getStoredAccessKey();
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessKey ? { "X-UltimoTurno-Access-Key": accessKey } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(payload.error || `Error ${response.status}`));
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return payload as T;
}

function blankForm(): InventoryFormState {
  return {
    sku: "",
    name: "",
    expansion: "",
    number: "",
    imageUrl: "",
    language: "EN",
    condition: "NM",
    finish: "normal",
    gradingCompany: "",
    grade: "",
    gradingCert: "",
    location: "",
    intakeBatch: "",
    inventoryStatus: "available",
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
    const parsed = JSON.parse(window.localStorage.getItem(importDraftStorageKey) || "{}") as { csvText?: string; batch?: Partial<ImportBatchState> };
    return {
      csvText: String(parsed.csvText || ""),
      batch: { ...defaultImportBatch(), ...(parsed.batch || {}) }
    };
  } catch {
    return { csvText: "", batch: defaultImportBatch() };
  }
}

function formFromItem(item: StockRow): InventoryFormState {
  return {
    sku: item.sku,
    name: item.product.name,
    expansion: item.product.expansion,
    number: item.product.number || "",
    imageUrl: item.product.imageUrl || "",
    language: item.variant.language,
    condition: item.variant.condition,
    finish: item.variant.finish,
    gradingCompany: item.variant.gradingCompany || "",
    grade: item.variant.grade || "",
    gradingCert: item.variant.gradingCert || "",
    location: item.location,
    intakeBatch: item.intakeBatch || "",
    inventoryStatus: item.inventoryStatus || "available",
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
  const tokens = raw.split(" ").filter(Boolean);
  const numberTokens = [...new Set(tokens
    .map((token) => token.replace(/^#/, ""))
    .filter((token) => /^[0-9]+[a-z]?$/i.test(token))
    .map((token) => token.replace(/^0+([0-9])/, "$1")))].slice(0, 1);
  const textTokens = [...new Set(tokens.filter((token) => !/^[0-9]+[a-z]?$/i.test(token.replace(/^#/, ""))))];
  return { raw, tokens, textTokens, numberTokens };
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
    item.product.identifiers.map((identifier) => `${identifier.source} ${identifier.externalId} ${identifier.url || ""}`).join(" ")
  ].join(" "));
  const haystack = `${name} ${expansionText} ${skuText} ${miscText}`;
  let score = 0;
  for (const token of query.textTokens) {
    if (nameWords.includes(token)) score += 50;
    else if (name.includes(token)) score += 34;
    else if (skuText.includes(token)) score += 24;
    else if (expansionText.includes(token)) score += 16;
    else if (miscText.includes(token)) score += 7;
    else if (haystack.includes(token)) score += 3;
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

function formatArs(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
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
  return `${apiBase}${value}`;
}

function canvasAssetUrl(value: string) {
  const resolved = assetUrl(value);
  if (/^https?:\/\//i.test(resolved)) return `${apiBase}/image-proxy?url=${encodeURIComponent(resolved)}`;
  return resolved;
}

function exportInventoryCsv(items: StockRow[]) {
  downloadCsv("ultimoturno-inventario-vista.csv", [
    ["sku", "name", "expansion", "number", "language", "condition", "finish", "gradingCompany", "grade", "gradingCert", "quantityOnHand", "quantityReserved", "availableQuantity", "priceArs", "priceUsd", "lastPurchaseArs", "lastPurchaseAt", "location", "intakeBatch", "inventoryStatus", "priceChartingId", "priceChartingUrl", "imageUrl"],
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
  const csv = rows.map((row) => row.map((cell) => {
    const value = String(cell ?? "");
    return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(",")).join("\n");
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
