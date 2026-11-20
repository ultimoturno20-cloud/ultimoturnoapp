import type { PGlite } from "@electric-sql/pglite";
import { getMaultConnection, saveMaultConnection, claimMaultLease, releaseMaultLease, stageMaultPage, listMaultCopies, listMaultQueue,
  recordMaultResolution, maultPolicyReasons, applyMaultCopies, requireMaultAdmin, inventoryTransaction, type AuthenticatedUser } from "@ultimoturno/db";
import { maultCopyFingerprint, normalizeMaultCopy, type MaultCopyView } from "@ultimoturno/domain";
import { maultSource, resolveMaultImage, verifyMaultImage } from "./mault-source.js";

type PrivateSource = { baseUrl: string; apiKey: string };
function fail(message: string, statusCode = 400): never { throw Object.assign(new Error(message), { statusCode }); }
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("Solicitud Mault invalida.");
  return value as Record<string, unknown>;
};
export function maultService(db: PGlite, actor: AuthenticatedUser, source: PrivateSource | null,
  { fetcher = fetch, invalidate = () => {} }: { fetcher?: typeof fetch; invalidate?: () => void } = {}) {
  requireMaultAdmin(actor);
  const client = () => source ? maultSource(source, fetcher) : fail("Mault no esta configurado para este negocio.", 503);
  async function prepare(row: MaultCopyView, conditionConfirmed: boolean, history: boolean) {
    if (row.status === "baseline" && !history) return { copyId: row.copyId, ready: false, reasons: ["history_confirmation_required"] };
    const { config } = await getMaultConnection(db, actor);
    const reasons = maultPolicyReasons(row.copy, config, conditionConfirmed);
    let resolved = row.resolved;
    if (!reasons.length) {
      try {
        if (resolved && resolved.verifiedFingerprint === maultCopyFingerprint(row.copy)) await verifyMaultImage(resolved.imageUrl, row.copy.sourceLanguage, fetcher);
        else resolved = await resolveMaultImage(row.copy, fetcher);
      } catch (error) { resolved = null; reasons.push(error instanceof Error ? error.message : "Imagen pendiente de verificacion."); }
    }
    await recordMaultResolution(db, actor, row.copy, resolved, reasons, history);
    return { copyId: row.copyId, ready: !reasons.length && Boolean(resolved), reasons };
  }
  return {
    async collections() { return { collections: await client().collections() }; },
    async status() { const connection = await getMaultConnection(db, actor); return { configured: Boolean(source), config: connection.config,
      version: connection.version, baselineComplete: connection.baseline_complete, lastSyncAt: connection.last_sync_at,
      morePages: Boolean(connection.next_page), totals: (await listMaultCopies(db, actor)).totals }; },
    async configure(input: unknown) {
      const body = object(input);
      if (Object.keys(body).some(k => !["version", "config"].includes(k))) fail("Solicitud Mault invalida.");
      return saveMaultConnection(db, actor, body.config, Number(body.version));
    },
    async preview(query: Record<string, unknown>) {
      return listMaultCopies(db, actor, { status: String(query.status || "all"), offset: Number(query.offset || 0) });
    },
    async run() {
      const provider = client();
      const { token, connection } = await claimMaultLease(db, actor);
      try {
        if (!connection.config.enabled) fail("La conexion Mault esta deshabilitada.", 409);
        const collections = await provider.collections();
        if (connection.config.collections.some(c => !collections.some(source => source.id === c.id))) fail("Una coleccion configurada no pertenece a la clave Mault.", 409);
        const page = await provider.page(connection.next_page, connection.watermark);
        const staged = await stageMaultPage(db, actor, token, page);
        const prepared = [];
        let imported = 0;
        for (const row of await listMaultQueue(db, actor)) {
          let current: unknown;
          try { current = await provider.card(row.copyId); }
          catch {
            await recordMaultResolution(db, actor, row.copy, null, ["source_unavailable"]);
            prepared.push({ copyId: row.copyId, ready: false, reasons: ["source_unavailable"] });
            continue;
          }
          await stageMaultPage(db, actor, token, { cards: [current], nextPage: null, nextSince: new Date().toISOString() }, false);
          const fresh = (await listMaultCopies(db, actor, { ids: [row.copyId] })).copies[0];
          const normalized = normalizeMaultCopy(current);
          if (!connection.config.collections.some(c => c.id === normalized.collectionId)) {
            await recordMaultResolution(db, actor, row.copy, null, ["collection_not_enabled"]); continue;
          }
          const result = await prepare(fresh, false, false); prepared.push(result);
          if (connection.config.autoImport && result.ready) {
            try { const receipt = await applyMaultCopies(db, actor, [row.copyId], { confirmHistory: false, conditionConfirmed: false, leaseToken: token }); imported += receipt.imported; }
            catch { await recordMaultResolution(db, actor, fresh.copy, fresh.resolved, ["import_requires_review"]); }
            finally { invalidate(); }
          }
        }
        return { ...staged, prepared, imported };
      } finally { await releaseMaultLease(db, actor, token); }
    },
    async prepareSelection(input: unknown) {
      const body = object(input);
      if (Object.keys(body).some(k => !["copyIds", "conditionConfirmed"].includes(k)) || !Array.isArray(body.copyIds)
        || (body.conditionConfirmed !== undefined && typeof body.conditionConfirmed !== "boolean")) fail("Solicitud Mault invalida.");
      const rows = await listMaultCopies(db, actor, { ids: body.copyIds as string[] });
      if (rows.copies.length !== new Set(body.copyIds).size) fail("Una copia no pertenece al negocio.", 404);
      const { token, connection } = await claimMaultLease(db, actor);
      try {
        const prepared = [];
        for (const row of rows.copies) {
          if (row.appliedAt) continue;
          const raw = await client().card(row.copyId), copy = normalizeMaultCopy(raw);
          if (!connection.config.collections.some(c => c.id === copy.collectionId)) fail("Coleccion no habilitada.", 409);
          await stageMaultPage(db, actor, token, { cards: [raw], nextPage: null, nextSince: new Date().toISOString() }, false);
          prepared.push(await prepare((await listMaultCopies(db, actor, { ids: [copy.copyId] })).copies[0], body.conditionConfirmed === true, true));
        }
        return { prepared };
      } finally { await releaseMaultLease(db, actor, token); }
    },
    async apply(input: unknown) {
      client();
      const body = object(input);
      if (Object.keys(body).some(k => !["copyIds", "confirmHistory", "conditionConfirmed"].includes(k)) || !Array.isArray(body.copyIds)
        || (body.confirmHistory !== undefined && typeof body.confirmHistory !== "boolean")
        || (body.conditionConfirmed !== undefined && typeof body.conditionConfirmed !== "boolean")) fail("Solicitud Mault invalida.");
      const ids = body.copyIds as string[], options = { confirmHistory: body.confirmHistory === true, conditionConfirmed: body.conditionConfirmed === true };
      const rows = await listMaultCopies(db, actor, { ids });
      if (rows.copies.length !== new Set(ids).size) fail("Una copia Mault no pertenece al negocio.", 404);
      const { token, connection } = await claimMaultLease(db, actor);
      try {
        for (const row of rows.copies) if (!row.appliedAt) {
          const raw = await client().card(row.copyId), copy = normalizeMaultCopy(raw);
          if (!connection.config.collections.some(c => c.id === copy.collectionId)) fail("La copia cambio a una coleccion no habilitada.", 409);
          await stageMaultPage(db, actor, token, { cards: [raw], nextPage: null, nextSince: new Date().toISOString() }, false);
          const fresh = (await listMaultCopies(db, actor, { ids: [row.copyId] })).copies[0];
          await prepare(fresh, options.conditionConfirmed, options.confirmHistory);
        }
        return await applyMaultCopies(db, actor, ids, { ...options, leaseToken: token });
      } finally { invalidate(); await releaseMaultLease(db, actor, token); }
    },
    async verifyImage(input: unknown) {
      const body = object(input);
      if (Object.keys(body).some(k => !["copyId", "imageUrl", "confirmIdentity", "stamp"].includes(k)) || typeof body.copyId !== "string"
        || typeof body.imageUrl !== "string" || body.confirmIdentity !== true) fail("Confirma explicitamente la identidad de la imagen.");
      const row = (await listMaultCopies(db, actor, { ids: [body.copyId] })).copies[0];
      if (!row || row.appliedAt) fail("Copia pendiente no encontrada.", 404);
      if ((body.stamp ?? null) !== row.copy.stamp) fail("La estampa confirmada no coincide con Mault.");
      const imageUrl = await verifyMaultImage(body.imageUrl, row.copy.sourceLanguage, fetcher);
      const { config } = await getMaultConnection(db, actor);
      await inventoryTransaction(db, async tx => {
        await recordMaultResolution(tx, actor, row.copy, { imageUrl, name: row.copy.name, expansion: row.copy.setName || row.copy.setCode,
          verifiedFingerprint: maultCopyFingerprint(row.copy), verifiedBy: "admin" }, maultPolicyReasons(row.copy, config), true);
        await tx.query(`insert into audit_log(id,business_id,actor_user_id,action,entity_type,entity_id,after_data)
          values($1,$2,$3,'mault.verify_image','mault_copy',$4,$5::jsonb)`, [crypto.randomUUID(), actor.businessId, actor.id, row.copyId,
          JSON.stringify({ fingerprint: maultCopyFingerprint(row.copy), stamp: row.copy.stamp, identityConfirmed: true })]);
      });
      return { verified: true };
    },
  };
}
