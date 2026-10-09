import assert from "node:assert/strict";
import { it } from "node:test";
import { filterResellerTeam, resellerAccountMovements, resellerAdminLocation, resellerMonthlySales, resellerTeamTotals, type ResellerAdminRecord } from "../src/reseller-admin.js";
const now = new Date("2026-10-09T12:00:00Z");
const a: ResellerAdminRecord = {
  reseller: { userId: "a", displayName: "Martin", email: "martin@test.local", phone: "123", active: true }, stockRequests: [{}],
  sales: [{ id: "s1", customerName: "Cliente", status: "confirmed", grossTotalArs: 1000, netDueArs: 800, soldAt: "2026-10-01T02:30:00Z" }, { id: "s2", customerName: "Otro", status: "confirmed", grossTotalArs: 2000, netDueArs: 1600, soldAt: "2026-10-01T03:30:00Z" }, { id: "s3", customerName: "Anulada", status: "cancelled", grossTotalArs: 9000, netDueArs: 7200, soldAt: "2026-10-08T12:00:00Z" }],
  settlements: [{ id: "p1", amountArs: 500, note: "Transferencia", settledAt: "2026-10-08T14:00:00Z" }],
  summary: { remainingUnits: 3, sellableUnits: 1, assignedValueArs: 5000, outstandingArs: 1900 }
};
const b: ResellerAdminRecord = { ...a, reseller: { ...a.reseller, userId: "b", displayName: "Ana", email: "ana@test.local", active: false }, stockRequests: [], sales: [], settlements: [], summary: { remainingUnits: 2, sellableUnits: 2, assignedValueArs: 3000, outstandingArs: 0 } };
it("filters and sorts the team without mutating records", () => {
  const records = [a, b];
  assert.deepEqual(filterResellerTeam(records, "", "all", "name", now).map((r) => r.reseller.userId), ["b", "a"]);
  assert.deepEqual(filterResellerTeam(records, "martín 123", "all", "name", now), [a]);
  for (const filter of ["pending", "balance", "restricted"] as const) assert.deepEqual(filterResellerTeam(records, "", filter, "name", now), [a]);
  assert.deepEqual(filterResellerTeam(records, "", "inactive", "name", now), [b]);
  for (const sort of ["balance", "stock", "sales"] as const) assert.equal(filterResellerTeam(records, "", "all", sort, now)[0], a);
  assert.deepEqual(records, [a, b]);
});
it("counts only confirmed monthly sales in Buenos Aires and keeps stock separate from debt", () => {
  assert.equal(resellerMonthlySales(a, now), 2000);
  assert.deepEqual(resellerTeamTotals([a, b], now), { units: 5, stockValueArs: 8000, requests: 1, outstandingArs: 1900, monthlySalesArs: 2000 });
});
it("shows actual payments without retroactively allocating them to sales", () => {
  const movements = resellerAccountMovements(a);
  assert.equal(movements[0].id, "payment:p1");
  assert.equal(movements.length, 3);
  assert.equal(movements.reduce((sum, item) => sum + item.debit - item.credit, 0), 1900);
  assert.equal(movements.some((item) => item.id === "sale:s3"), false);
});
it("restores valid profile tabs and limits owner navigation", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(resellerAdminLocation(`?revendedor=${id}&vista=cuenta`), { id, tab: "cuenta" });
  assert.deepEqual(resellerAdminLocation(`?revendedor=${id}&vista=cuenta`, true), { id, tab: "resumen" });
  assert.deepEqual(resellerAdminLocation("?revendedor=invalid&vista=unknown"), { id: "", tab: "resumen" });
  assert.equal(resellerAdminLocation("?revendedor=------------------------------------").id, "");
});
