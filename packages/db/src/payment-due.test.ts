import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  addCalendarDays,
  addInventoryStock,
  calendarDateInArgentina,
  createClaimSession,
  createOperationalDatabase,
  createSale,
  defaultPaymentDueDate,
  getDefaultOperationalUser,
  toIsoDate
} from "./index.js";

function dueDate(value?: string) {
  return toIsoDate(value) || "";
}

test("calendar helper adds whole days without timezone drift", () => {
  assert.equal(addCalendarDays("2026-10-03", 7), "2026-10-10");
  assert.equal(addCalendarDays("2026-12-28", 7), "2027-01-04");
  assert.equal(defaultPaymentDueDate(new Date("2026-10-03T15:00:00-03:00")), "2026-10-10");
});

test("new reservations default to payment due in 7 days and keep an explicit date", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ut-payment-due-"));
  const db = await createOperationalDatabase({ dataDir });
  try {
    const user = await getDefaultOperationalUser(db);
    const item = await addInventoryStock(db, {
      name: "Due Date Test",
      expansion: "Test",
      language: "EN",
      condition: "NM",
      finish: "normal",
      quantityOnHand: 5,
      priceArs: 1000
    }, user);

    const reserved = await createSale(db, {
      customerName: "Cliente plazo",
      saleType: "reservation",
      channel: "whatsapp",
      lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 1000 }]
    }, user);
    assert.equal(dueDate(reserved.paymentDueAt), defaultPaymentDueDate());

    const dated = await createSale(db, {
      customerName: "Cliente 30 dias",
      saleType: "reservation",
      channel: "whatsapp",
      lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 1000 }],
      paymentDueAt: "2026-12-31"
    }, user);
    assert.equal(dueDate(dated.paymentDueAt), "2026-12-31");

    const paid = await createSale(db, {
      customerName: "Mostrador",
      saleType: "sale",
      channel: "mostrador",
      lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 1000 }]
    }, user);
    assert.equal(dueDate(paid.paymentDueAt), "");

    const claim = await createClaimSession(db, { name: "Claim plazo" }, user);
    assert.equal(dueDate(claim.activeClaim?.paymentDueAt), defaultPaymentDueDate());
    assert.equal(calendarDateInArgentina().length, 10);
  } finally {
    await db.close();
  }
});
