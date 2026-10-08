import crypto from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import {
  applyResellerStockAssignment, applyResellerStockRequest, getResellerDashboard,
  inventoryTransaction, applyResellerStockResolution,
  type AuthenticatedUser, type ResellerDashboard
} from "./index.js";

export type ResellerBatchLine = { inventoryItemId: string; quantity: number };
export type ResellerBatchInput = { idempotencyKey: string; lines: ResellerBatchLine[] };
export type ResellerResolutionBatchInput = {
  idempotencyKey: string; action: "approve" | "reject";
  lines: Array<{ requestId: string; quantity?: number; priceArs?: number }>;
};
export type ResellerBatchResult = { dashboard: ResellerDashboard; processedCount: number; replayed: boolean };

function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("Identificador de lote invalido.");
  return value.toLowerCase();
}

function validateLines<T>(lines: T[], key: (line: T) => string): T[] {
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) throw new Error("Selecciona entre 1 y 100 cartas para el lote.");
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line || typeof line !== "object") throw new Error("Linea de lote invalida.");
    const id = key(line);
    if (seen.has(id)) throw new Error("Una carta o solicitud no puede repetirse en el lote.");
    seen.add(id);
  }
  return [...lines].sort((a, b) => key(a).localeCompare(key(b)));
}

function stockLines(input: ResellerBatchInput) {
  return validateLines(input.lines, (line) => uuid(line.inventoryItemId)).map((line) => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("La cantidad debe ser un entero positivo.");
    return { inventoryItemId: uuid(line.inventoryItemId), quantity: line.quantity };
  });
}

async function runBatch(
  db: PGlite, actor: AuthenticatedUser, resellerUserId: string, idempotencyKey: string,
  payload: unknown, count: number, work: (connection: PGlite) => Promise<void>
): Promise<ResellerBatchResult> {
  const key = uuid(idempotencyKey);
  const target = uuid(resellerUserId);
  const hash = crypto.createHash("sha256").update(JSON.stringify({ target, payload })).digest("hex");
  return inventoryTransaction(db, async (connection) => {
    const profile = await connection.query("select 1 from reseller_profiles rp join app_users u on u.id = rp.user_id where rp.business_id = $1 and rp.user_id = $2 and u.active = true for update of rp", [actor.businessId, target]);
    if (!profile.rows.length) throw new Error("Revendedor no encontrado.");
    const inserted = await connection.query(`
      insert into reseller_batch_receipts (id, business_id, actor_user_id, idempotency_key, request_hash)
      values ($1, $2, $3, $4, $5)
      on conflict (business_id, actor_user_id, idempotency_key) do nothing returning id
    `, [crypto.randomUUID(), actor.businessId, actor.id, key, hash]);
    const replayed = !inserted.rows.length;
    if (replayed) {
      const receipt = await connection.query<{ request_hash: string }>("select request_hash from reseller_batch_receipts where business_id = $1 and actor_user_id = $2 and idempotency_key = $3", [actor.businessId, actor.id, key]);
      if (receipt.rows[0]?.request_hash !== hash) throw new Error("Este identificador ya se uso para otro lote.");
    } else {
      await work(connection);
      await connection.query("update stock_read_snapshots set refreshed_at = '1970-01-01'::timestamptz where business_id = $1", [actor.businessId]);
    }
    return { dashboard: await getResellerDashboard(connection, target, actor.businessId), processedCount: count, replayed };
  });
}

export async function createResellerStockRequestBatch(db: PGlite, input: ResellerBatchInput, actor: AuthenticatedUser) {
  if (actor.roles && !actor.roles.includes("reseller")) throw new Error("Se requiere rol revendedor.");
  const lines = stockLines(input);
  return runBatch(db, actor, actor.id, input.idempotencyKey, { operation: "request", lines }, lines.length, async (connection) => {
    // Apply reductions first so replacing pending requests uses the final credit fairly.
    const pending = await connection.query<{ inventory_item_id: string; quantity_requested: number }>("select inventory_item_id, quantity_requested from reseller_stock_requests where business_id = $1 and reseller_user_id = $2 and status = 'pending'", [actor.businessId, actor.id]);
    const quantities = new Map(pending.rows.map((row) => [row.inventory_item_id, Number(row.quantity_requested)]));
    await connection.query("select id from inventory_items where business_id = $1 and id = any($2::uuid[]) order by id for update", [actor.businessId, lines.map((line) => line.inventoryItemId)]);
    const ordered = [...lines].sort((a, b) => Number(b.quantity < (quantities.get(b.inventoryItemId) || 0)) - Number(a.quantity < (quantities.get(a.inventoryItemId) || 0)) || a.inventoryItemId.localeCompare(b.inventoryItemId));
    for (const line of ordered) await applyResellerStockRequest(connection, line, actor);
  });
}

export async function assignResellerStockBatch(db: PGlite, resellerUserId: string, input: ResellerBatchInput, actor: AuthenticatedUser) {
  if (actor.roles && !actor.roles.some((role) => role === "admin" || role === "stock_owner")) throw new Error("No podes asignar mercaderia.");
  const lines = stockLines(input);
  return runBatch(db, actor, resellerUserId, input.idempotencyKey, { operation: "assign", lines }, lines.length, async (connection) => {
    for (const line of lines) await applyResellerStockAssignment(connection, resellerUserId, line.inventoryItemId, line.quantity, actor);
  });
}

export async function resolveResellerStockRequestBatch(db: PGlite, resellerUserId: string, input: ResellerResolutionBatchInput, actor: AuthenticatedUser) {
  if (actor.roles && !actor.roles.includes("admin")) throw new Error("Se requiere rol administrador.");
  if (!["approve", "reject"].includes(input.action)) throw new Error("Accion de solicitud invalida.");
  const lines = validateLines(input.lines, (line) => uuid(line.requestId)).map((line) => {
    if (input.action === "reject") return { requestId: uuid(line.requestId) };
    if (line.quantity != null && (!Number.isSafeInteger(line.quantity) || line.quantity <= 0)) throw new Error("La cantidad aprobada debe ser un entero positivo.");
    if (line.priceArs != null && (!Number.isFinite(line.priceArs) || line.priceArs < 0)) throw new Error("El precio aprobado no es valido.");
    return { requestId: uuid(line.requestId), quantity: line.quantity, priceArs: line.priceArs };
  });
  return runBatch(db, actor, resellerUserId, input.idempotencyKey, { operation: input.action, lines }, lines.length, async (connection) => {
    const requests = await connection.query<{ id: string; inventory_item_id: string; quantity_requested: number }>(`
      select id, inventory_item_id, quantity_requested from reseller_stock_requests
      where business_id = $1 and reseller_user_id = $2 and id = any($3::uuid[]) and status = 'pending'
      order by inventory_item_id, id for update
    `, [actor.businessId, resellerUserId, lines.map((line) => line.requestId)]);
    if (requests.rows.length !== lines.length) throw new Error("Una solicitud no pertenece al revendedor o ya fue resuelta. Actualiza la seleccion.");
    for (const request of requests.rows) {
      const line = lines.find((item) => item.requestId === request.id)!;
      if (input.action === "approve" && line.quantity != null && line.quantity > Number(request.quantity_requested)) throw new Error("No podes aprobar mas unidades de las solicitadas.");
      await applyResellerStockResolution(connection, line.requestId, { action: input.action, ...line }, actor);
    }
  });
}
