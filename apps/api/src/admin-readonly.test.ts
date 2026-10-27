import assert from "node:assert/strict";
import test from "node:test";
import { readOnlyAdminRouteAllowed } from "./admin-readonly.js";
import { canReadAdmin, isReadOnlyAdmin } from "@ultimoturno/domain";

test("observer role is explicit, never an alias granting admin", () => {
  assert.equal(canReadAdmin(["admin_readonly"]), true);
  assert.equal(isReadOnlyAdmin(["admin_readonly"]), true);
  assert.equal(isReadOnlyAdmin(["admin", "admin_readonly"]), true);
  for (const roles of [undefined, [], ["stock_owner"], ["reseller"], ["viewer"]]) assert.equal(canReadAdmin(roles), false);
  assert.equal(canReadAdmin(["admin"]), true);
  assert.equal(isReadOnlyAdmin(["admin"]), false);
});

test("observer allowlist rejects all business writes, unsafe GET and new routes", () => {
  for (const path of ["/sales", "/users", "/claims/close", "/inventory/intake", "/store/orders", "/store-admin/items/id/price", "/order-boards", "/examples/inventory", "/resellers", "/imports", "/stock"]) {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "CONNECT"]) assert.equal(readOnlyAdminRouteAllowed(path, method), false, method + " " + path);
  }
  for (const path of ["/cron/pricecharting-refresh", "/cron/tcgplayer-refresh", "/cron/price-history-snapshot", "/future/write-route", "/health", "/sales/complete", "/inventory/reset-stock", "/store-admin/session"]) assert.equal(readOnlyAdminRouteAllowed(path, "GET"), false, path);
  for (const path of ["/stock", "/sales", "/auth/me", "/claims", "/order-boards", "/inventory/view", "/users", "/store-settings"]) assert.equal(readOnlyAdminRouteAllowed(path, "GET"), true, path);
  assert.equal(readOnlyAdminRouteAllowed("/auth/logout", "POST"), true);
  assert.equal(readOnlyAdminRouteAllowed("/auth/login", "POST"), true);
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(readOnlyAdminRouteAllowed(`/inventory/${id}/contents`, "GET"), true);
  assert.equal(readOnlyAdminRouteAllowed(`/inventory/${id}/contents/template-151`, "GET"), false);
  assert.equal(readOnlyAdminRouteAllowed("/pricecharting-images/files/card.jpg", "HEAD"), true);
  assert.equal(readOnlyAdminRouteAllowed("/pricecharting-images/files/../secret.jpg", "GET"), false);
});
