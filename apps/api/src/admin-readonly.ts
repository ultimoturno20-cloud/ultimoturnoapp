const readPaths = new Set([
  "/auth/me", "/exchange-rate/blue", "/users", "/store-settings", "/store/settings", "/store/catalog",
  "/stock", "/inventory/view", "/inventory/items", "/inventory/intake-search",
  "/movements", "/audit", "/operational-history", "/sales", "/purchases", "/order-boards",
  "/claims", "/claims/orders/preview", "/claim-plans", "/resellers", "/tournaments",
  "/mobile-intake/view", "/mobile-intake/search", "/mobile-intake/entries", "/mobile-intake/pending", "/mobile-intake/pending-match",
  "/card-index", "/card-index/status", "/card-index/tcgcsv-progress", "/card-index/image-progress", "/pricecharting-cache", "/catalog-cards",
  "/pricecharting-cache/status", "/pricecharting-cache/auto-refresh/status",
  "/tcgplayer-prices/status", "/tcgplayer-prices/auto-refresh/status", "/coolstuff-prices/status",
  "/coolstuff-prices/lookup", "/price-history", "/price-history/changes",
  "/pricecharting-images/status", "/database-quality/images", "/stock-images/review",
  "/pricecharting-images/catalog", "/pricecharting-images/external-index/status", "/imports", "/image-proxy"
]);
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const detail = new RegExp(`^/(?:resellers/${uuid}|tournaments/${uuid}|inventory/${uuid}/contents)$`, "i");
const image = /^\/pricecharting-images\/files\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/;

export function readOnlyAdminRouteAllowed(path: string, method: string) {
  if (method === "POST" && (path === "/auth/login" || path === "/auth/logout")) return true;
  if (image.test(path)) return method === "GET" || method === "HEAD";
  return method === "GET" && (readPaths.has(path) || detail.test(path));
}
