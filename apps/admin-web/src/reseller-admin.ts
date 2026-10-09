export type ResellerAdminTab = "resumen" | "mercaderia" | "solicitudes" | "ventas" | "cuenta" | "configuracion";
export type ResellerTeamFilter = "all" | "pending" | "balance" | "restricted" | "inactive";
export type ResellerTeamSort = "name" | "balance" | "stock" | "sales";
export type ResellerAdminRecord = {
  reseller: { userId: string; displayName: string; email: string; phone: string; active: boolean };
  stockRequests: unknown[];
  sales: Array<{ id: string; customerName: string; status: string; grossTotalArs: number; netDueArs: number; soldAt: string }>;
  settlements: Array<{ id: string; amountArs: number; note: string; settledAt: string }>;
  summary: { remainingUnits: number; sellableUnits: number; assignedValueArs: number; outstandingArs: number };
};

const monthFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" });
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;

export function resellerMonthlySales(record: ResellerAdminRecord, now = new Date()): number {
  const month = monthFormatter.format(now);
  return record.sales.reduce((sum, sale) => sale.status === "confirmed" && time(sale.soldAt) && monthFormatter.format(new Date(sale.soldAt)) === month ? sum + sale.grossTotalArs : sum, 0);
}

export function filterResellerTeam<T extends ResellerAdminRecord>(records: T[], search: string, filter: ResellerTeamFilter, sort: ResellerTeamSort, now = new Date()): T[] {
  const tokens = normalize(search).trim().split(/\s+/).filter(Boolean);
  const monthly = new Map(records.map((record) => [record.reseller.userId, resellerMonthlySales(record, now)]));
  return records.filter((record) => {
    const identity = normalize([record.reseller.displayName, record.reseller.email, record.reseller.phone].join(" "));
    return tokens.every((token) => identity.includes(token))
      && (filter === "all" || (filter === "pending" && record.stockRequests.length > 0)
        || (filter === "balance" && record.summary.outstandingArs > 0)
        || (filter === "restricted" && record.summary.sellableUnits < record.summary.remainingUnits)
        || (filter === "inactive" && !record.reseller.active));
  }).sort((a, b) => {
    const comparison = sort === "balance" ? b.summary.outstandingArs - a.summary.outstandingArs
      : sort === "stock" ? b.summary.assignedValueArs - a.summary.assignedValueArs
      : sort === "sales" ? (monthly.get(b.reseller.userId) || 0) - (monthly.get(a.reseller.userId) || 0) : 0;
    return comparison || a.reseller.displayName.localeCompare(b.reseller.displayName, "es", { numeric: true }) || a.reseller.userId.localeCompare(b.reseller.userId);
  });
}

export function resellerTeamTotals(records: ResellerAdminRecord[], now = new Date()) {
  return records.reduce((total, record) => ({
    units: total.units + record.summary.remainingUnits,
    stockValueArs: total.stockValueArs + record.summary.assignedValueArs,
    requests: total.requests + record.stockRequests.length,
    outstandingArs: total.outstandingArs + record.summary.outstandingArs,
    monthlySalesArs: total.monthlySalesArs + resellerMonthlySales(record, now)
  }), { units: 0, stockValueArs: 0, requests: 0, outstandingArs: 0, monthlySalesArs: 0 });
}

export function resellerAccountMovements(record: ResellerAdminRecord) {
  return [
    ...record.sales.filter((sale) => sale.status === "confirmed").map((sale) => ({ id: `sale:${sale.id}`, date: sale.soldAt, kind: "sale" as const, label: sale.customerName || "Venta sin nombre", debit: sale.netDueArs, credit: 0 })),
    ...record.settlements.map((payment) => ({ id: `payment:${payment.id}`, date: payment.settledAt, kind: "payment" as const, label: payment.note || "Rendicion", debit: 0, credit: payment.amountArs }))
  ].sort((a, b) => time(b.date) - time(a.date) || a.id.localeCompare(b.id));
}

export function resellerAdminLocation(search: string, assignmentOnly = false): { id: string; tab: ResellerAdminTab } {
  const params = new URLSearchParams(search);
  const id = params.get("revendedor") || "";
  const allowed: ResellerAdminTab[] = assignmentOnly ? ["resumen", "mercaderia"] : ["resumen", "mercaderia", "solicitudes", "ventas", "cuenta", "configuracion"];
  const tab = params.get("vista") as ResellerAdminTab;
  return { id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : "", tab: allowed.includes(tab) ? tab : "resumen" };
}
