import crypto from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { isLotQuoteId, normalizeLotQuoteSave, type LotQuote, type LotQuoteDraft, type LotQuotePage } from "@ultimoturno/domain";
import { inventoryTransaction, type AuthenticatedUser } from "./index.js";

type Row = { id: string; version: number; document: LotQuoteDraft; last_request_id: string; created_at: string; updated_at: string };
function admin(actor: AuthenticatedUser) {
  if (!actor.roles?.includes("admin")) throw Object.assign(new Error("Se requiere rol administrador."), { statusCode: 403 });
}
function notFound(): never { throw Object.assign(new Error("Presupuesto no encontrado."), { statusCode: 404 }); }
function conflict(): never { throw Object.assign(new Error("El presupuesto cambio. Conserva tu borrador y recarga la version guardada antes de reemplazarla."), { statusCode: 409 }); }
const map = (row: Row): LotQuote => ({ ...row.document, id: row.id, version: Number(row.version), createdAt: String(row.created_at), updatedAt: String(row.updated_at) });
const columns = "id, version, document, last_request_id, created_at::text, updated_at::text";

export async function listLotQuotes(db: PGlite, actor: AuthenticatedUser, input: Record<string, unknown> = {}): Promise<LotQuotePage> {
  admin(actor);
  const offset = Number(input.offset || 0), limit = 30;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw Object.assign(new Error("Pagina invalida."), { statusCode: 400 });
  const rows = await db.query<{ items: Array<Row & { line_count: number }>; total: number }>(`
    with scoped as (select * from lot_quotes where business_id=$1), page as (
      select id, version, document - 'lines' as document, jsonb_array_length(document->'lines') as line_count,
        created_at::text, updated_at::text from scoped order by updated_at desc, id limit $2 offset $3
    ) select (select count(*)::integer from scoped) as total,
      coalesce((select jsonb_agg(to_jsonb(page) order by updated_at desc, id) from page), '[]'::jsonb) as items
  `, [actor.businessId, limit, offset]);
  return { items: rows.rows[0].items.map(row => ({ ...map(row), lineCount: Number(row.line_count) })), total: Number(rows.rows[0].total), limit, offset };
}

export async function getLotQuote(db: PGlite, actor: AuthenticatedUser, id: string): Promise<LotQuote> {
  admin(actor);
  if (!isLotQuoteId(id)) notFound();
  const result = await db.query<Row>(`select ${columns} from lot_quotes where id=$1 and business_id=$2`, [id, actor.businessId]);
  if (!result.rows[0]) notFound();
  return map(result.rows[0]);
}

export async function saveLotQuote(db: PGlite, actor: AuthenticatedUser, id: string, body: unknown): Promise<LotQuote> {
  admin(actor);
  if (!isLotQuoteId(id)) notFound();
  const input = normalizeLotQuoteSave(body);
  const document = JSON.stringify(input.draft);
  return inventoryTransaction(db, async tx => {
    let created = false;
    if (input.version === 0) {
      const insert = await tx.query(`insert into lot_quotes(id,business_id,created_by,version,document,last_request_id)
        values($1,$2,$3,1,$4::jsonb,$5) on conflict(id) do nothing returning id`, [id, actor.businessId, actor.id, document, input.requestId]);
      created = insert.rows.length === 1;
    }
    const result = await tx.query<Row>(`select ${columns} from lot_quotes where id=$1 and business_id=$2 for update`, [id, actor.businessId]);
    const row = result.rows[0];
    if (!row) notFound();
    if (!created && row.last_request_id === input.requestId) {
      if (row.version !== input.version + 1 || JSON.stringify(normalizeLotQuoteSave({ ...input, draft: row.document }).draft) !== document) conflict();
      return map(row);
    }
    if (!created && row.version !== input.version) conflict();
    if (!created) await tx.query(`update lot_quotes set document=$3::jsonb, version=version+1, last_request_id=$4, updated_at=clock_timestamp() where id=$1 and business_id=$2`, [id, actor.businessId, document, input.requestId]);
    await tx.query(`insert into audit_log(id,business_id,actor_user_id,action,entity_type,entity_id,after_data)
      values($1,$2,$3,$4,'lot_quote',$5,$6::jsonb)`, [crypto.randomUUID(), actor.businessId, actor.id, created ? "lot_quote.create" : "lot_quote.save", id,
      JSON.stringify({ name: input.draft.name, version: created ? 1 : row.version + 1, lines: input.draft.lines.length, status: input.draft.status })]);
    return getLotQuote(tx, actor, id);
  });
}
