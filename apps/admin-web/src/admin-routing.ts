export type AdminView = "dashboard" | "inventory" | "stock-intake" | "claims" | "claim-planner" | "claim-live" | "orders" | "sales" | "purchases" | "catalog" | "movements" | "import" | "mobile-intake" | "resellers" | "admin";

export const adminViewPaths: Record<AdminView, string> = {
  dashboard: "/admin",
  inventory: "/admin/inventario",
  "stock-intake": "/admin/inventario/cargar-stock",
  claims: "/admin/claims",
  "claim-planner": "/admin/claims/planificar",
  "claim-live": "/admin/claims/en-vivo",
  orders: "/admin/ordenes",
  sales: "/admin/caja",
  purchases: "/admin/compras",
  catalog: "/admin/calidad",
  movements: "/admin/movimientos",
  import: "/admin/importar",
  "mobile-intake": "/admin/carga-movil",
  resellers: "/admin/revendedores",
  admin: "/admin/configuracion"
};

export function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isResellerPortalPath(pathname: string) {
  return pathname === "/portal-revendedor" || pathname.startsWith("/portal-revendedor/");
}

export function adminViewFromUrl(url: URL): AdminView {
  if (!isAdminPath(url.pathname)) return "dashboard";
  if (url.searchParams.get("mobile") === "1" || url.hash === "#mobile") return "mobile-intake";
  const path = url.pathname.replace(/\/+$/, "");
  return (Object.entries(adminViewPaths).find(([, route]) => route === path)?.[0] as AdminView | undefined) || "dashboard";
}
