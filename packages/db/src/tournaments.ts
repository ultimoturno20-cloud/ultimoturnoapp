import type { PGlite } from '@electric-sql/pglite';
import { applyTournamentCommand, importTournament, newTournament, type TournamentState, type TournamentCommand } from '@ultimoturno/domain';
import { inventoryTransaction, type AuthenticatedUser } from './index.js';
export type TournamentDocument = { id: string; version: number; state: TournamentState; updatedAt: string };
function error(message: string, statusCode: number): never { throw Object.assign(new Error(message),{statusCode}); }
function admin(actor: AuthenticatedUser) { if (!actor.roles?.includes('admin')) error('Se requiere rol administrador para torneos.',403); }
function uuid(id: unknown): string { if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) error('Identificador inválido.',400); return id.toLowerCase(); }
type Row = { id: string; version: number; state: TournamentState; updated_at: string };
function document(r: Row): TournamentDocument { return {id:r.id,version:Number(r.version),state:r.state,updatedAt:String(r.updated_at)}; }
export async function listTournaments(db: PGlite,actor: AuthenticatedUser) {
  admin(actor);
  const result = await db.query<Row>("select id,version,state,updated_at::text from tournaments where business_id=$1 order by updated_at desc limit 200",[actor.businessId]);
  return result.rows.map(r => ({id:r.id,version:Number(r.version),name:r.state.name,players:r.state.players.length,swissRounds:r.state.swiss.length,swissCount:r.state.swissCount,cutStarted:!!r.state.cut.length,updatedAt:String(r.updated_at)}));
}
export async function getTournament(db: PGlite,id: string,actor: AuthenticatedUser): Promise<TournamentDocument> {
  admin(actor);
  const result = await db.query<Row>('select id,version,state,updated_at::text from tournaments where id=$1 and business_id=$2',[uuid(id),actor.businessId]);
  if (!result.rows[0]) error('Torneo no encontrado.',404);
  return document(result.rows[0]);
}
export async function createTournament(db: PGlite,input: { id: string; name?: string; swissCount?: number; cutSize?: number; imported?: unknown },actor: AuthenticatedUser): Promise<TournamentDocument> {
  admin(actor);
  const id=uuid(input.id);
  const state = input.imported !== undefined ? importTournament(input.imported) : newTournament(input.name,input.swissCount,input.cutSize);
  return inventoryTransaction(db,async connection => {
    const inserted = await connection.query<Row>('insert into tournaments (id,business_id,created_by,state) values ($1,$2,$3,$4::jsonb) on conflict (id) do nothing returning id,version,state,updated_at::text',[id,actor.businessId,actor.id,JSON.stringify(state)]);
    if (inserted.rows[0]) return document(inserted.rows[0]);
    const existing = await getTournament(connection,id,actor);
    // Recupera un alta cuya respuesta se perdió, sin duplicar ni reemplazar datos.
    if (existing.version !== 1 || JSON.stringify(existing.state) !== JSON.stringify(state)) {
      // JSONB ordena claves: comparar canónicamente en SQL, sin depender del orden del JSON.
      const same = await connection.query('select id from tournaments where id=$1 and business_id=$2 and version=1 and state=$3::jsonb',[id,actor.businessId,JSON.stringify(state)]);
      if (!same.rows.length) error('El identificador ya corresponde a otro torneo. Recargá la lista.',409);
    }
    return existing;
  });
}
export async function commandTournament(db: PGlite,id: string,input: { version: number; command: TournamentCommand },actor: AuthenticatedUser): Promise<TournamentDocument> {
  admin(actor);
  if (!Number.isSafeInteger(input.version) || input.version < 1) error('Versión inválida.',400);
  return inventoryTransaction(db,async connection => {
    const current = await getTournament(connection,id,actor);
    if (current.version !== input.version) error('Otro equipo modificó el torneo. Recargá antes de continuar.',409);
    const next = applyTournamentCommand(current.state,input.command);
    const result = await connection.query<Row>('update tournaments set state=$1::jsonb,version=version+1,updated_at=now() where id=$2 and business_id=$3 and version=$4 returning id,version,state,updated_at::text',[JSON.stringify(next),uuid(id),actor.businessId,input.version]);
    if (!result.rows[0]) error('Otro equipo modificó el torneo. Recargá antes de continuar.',409);
    return document(result.rows[0]);
  });
}
