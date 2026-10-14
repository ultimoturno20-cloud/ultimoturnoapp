import { gunzipSync, gzipSync } from "node:zlib";
import { listStockForBusiness, type createOperationalDatabase } from "@ultimoturno/db";

type Database = Awaited<ReturnType<typeof createOperationalDatabase>>;
type Stock = Awaited<ReturnType<typeof listStockForBusiness>>;
type Snapshot = { payload: unknown; payload_compressed: string | null; refreshed_at: string; refresh_started_at: string | null };
class SupersededStockRead extends Error {}

export function createStockReadCache<T>(now = Date.now, ttl = 15_000) {
  type Entry = { fresh: boolean; result?: T; expiresAt: number; pending?: Promise<T> };
  const entries = new Map<string, Entry>();

  function read(key: string, load: (fresh: boolean, isCurrent: () => boolean) => Promise<T>, fresh = false, attempt = 0): Promise<T> {
    const cached = entries.get(key);
    if (cached?.pending && (!fresh || cached.fresh)) return cached.pending;
    if (!fresh && cached?.result !== undefined && cached.expiresAt > now()) return Promise.resolve(cached.result);
    const entry: Entry = { fresh, expiresAt: 0 };
    entries.set(key, entry);
    const isCurrent = () => entries.get(key) === entry;
    const recover = () => {
      if (attempt >= 3) throw new Error("El stock cambio durante la lectura. Volve a actualizar.");
      const latest = entries.get(key);
      if (latest?.result !== undefined && latest.expiresAt > now()) return latest.result;
      return read(key, load, true, attempt + 1);
    };
    const pending = Promise.resolve().then(() => load(fresh, isCurrent)).then((result) => {
      if (!isCurrent()) return recover();
      entry.result = result;
      entry.expiresAt = now() + ttl;
      return result;
    }, (error) => {
      if (!isCurrent()) return recover();
      if (error instanceof SupersededStockRead) { entries.delete(key); return recover(); }
      throw error;
    }).finally(() => {
      if (isCurrent()) {
        entry.pending = undefined;
        if (entry.result === undefined) entries.delete(key);
      }
    });
    entry.pending = pending;
    return pending;
  }

  return { read, delete: (key: string) => entries.delete(key), clear: () => entries.clear() };
}

function parseSnapshot(row?: Snapshot): Stock | null {
  if (!row || new Date(row.refreshed_at).getTime() <= 0) return null;
  let payload = row.payload;
  if (row.payload_compressed) {
    try { payload = JSON.parse(gunzipSync(Buffer.from(row.payload_compressed, "base64")).toString("utf8")); }
    catch { return null; }
  }
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Partial<Stock>;
  if (Array.isArray(value.items) && value.items.some((item) => typeof item.storefrontPublished !== "boolean" || (item.itemKind !== "folder" && !item.cardType))) return null;
  return value.summary && Array.isArray(value.items) ? value as Stock : null;
}

async function snapshotRow(db: Database, businessId: string) {
  return (await db.query<Snapshot>("select payload, payload_compressed, refreshed_at, refresh_started_at from stock_read_snapshots where business_id=$1", [businessId])).rows[0];
}

export async function readSharedStockSnapshot(db: Database, businessId: string, isCurrent: () => boolean, load = () => listStockForBusiness(db, businessId)): Promise<Stock> {
  let row = await snapshotRow(db, businessId);
  let shared = parseSnapshot(row);
  if (shared && Date.now() - new Date(row.refreshed_at).getTime() < 15_000) return shared;

  const claimed = await db.query<{ ticket: string }>(`
    insert into stock_read_snapshots (business_id, payload, refreshed_at, refresh_started_at)
    values ($1, null, '1970-01-01'::timestamptz, clock_timestamp())
    on conflict (business_id) do update set refresh_started_at = clock_timestamp()
    where stock_read_snapshots.refreshed_at < now() - interval '15 seconds'
      and (stock_read_snapshots.refresh_started_at is null or stock_read_snapshots.refresh_started_at < now() - interval '2 minutes')
    returning refresh_started_at::text as ticket
  `, [businessId]);
  const ticket = claimed.rows[0]?.ticket;

  if (!ticket) {
    if (shared) return shared;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (!isCurrent()) throw new SupersededStockRead();
      await new Promise((resolve) => setTimeout(resolve, 250));
      row = await snapshotRow(db, businessId);
      shared = parseSnapshot(row);
      if (shared) return shared;
      if (!row?.refresh_started_at) throw new SupersededStockRead();
    }
    // A busy builder does not grant permission to overwrite its snapshot.
    return load();
  }

  try {
    const result = await load();
    if (!isCurrent()) throw new SupersededStockRead();
    const compressed = gzipSync(Buffer.from(JSON.stringify(result), "utf8"), { level: 6 }).toString("base64");
    const published = await db.query(`
      update stock_read_snapshots set payload=null, payload_compressed=$2, refreshed_at=clock_timestamp(), refresh_started_at=null
      where business_id=$1 and refresh_started_at=$3::timestamptz returning business_id
    `, [businessId, compressed, ticket]);
    if (!published.rows.length) throw new SupersededStockRead();
    return result;
  } finally {
    // Invalidation revokes the ticket; old builders cannot release a newer builder's lease.
    await db.query("update stock_read_snapshots set refresh_started_at=null where business_id=$1 and refresh_started_at=$2::timestamptz", [businessId, ticket]).catch(() => undefined);
  }
}
