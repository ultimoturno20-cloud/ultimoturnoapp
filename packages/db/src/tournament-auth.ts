import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { PGlite } from '@electric-sql/pglite';
import { inventoryTransaction, getOperationalDatabaseDriver } from './index.js';
export type TournamentAccount = { id: string; displayName: string; email: string };
const scrypt = promisify(crypto.scrypt);
function fail(message: string,statusCode=400): never {throw Object.assign(new Error(message),{statusCode});}
function emailOf(value: unknown) {
  if(typeof value!=='string' || value.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))fail('Ingresá un email válido.');
  return value.trim().toLowerCase();
}
function passwordOf(value: unknown,register=false) {
  if(typeof value!=='string' || value.length>128 || value.length<(register?10:1))fail(register?'Usá una contraseña de 10 a 128 caracteres.':'Ingresá tu contraseña.');
  return value;
}
const tokenHash=(token:string)=>crypto.createHash('sha256').update(token).digest('hex');
async function passwordHash(password:string) {const salt=crypto.randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return `${salt}:${key.toString('hex')}`;}
async function passwordMatches(password:string,stored:string) {
  const [salt,hash]=stored.split(':');const key=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(hash,'hex');
  return expected.length===key.length&&crypto.timingSafeEqual(expected,key);
}
async function throttle(db:PGlite,email:string,ip:string,action:'login'|'register') {
  // Serializa intentos por IP, incluidos registros concurrentes, en PostgreSQL.
  if(getOperationalDatabaseDriver(db)==='postgres') {
    for(const key of [`tournament-auth-ip:${ip}`,`tournament-auth-email:${email}`].sort()) await db.query('select pg_advisory_xact_lock(hashtext($1))',[key]);
  }
  await db.query("delete from tournament_auth_attempts where attempted_at < now() - interval '1 day'");
  const counts=await db.query<{by_email:string;by_ip:string}>(`select
    count(*) filter (where email=$1)::text as by_email,
    count(*) filter (where $2<>'' and ip=$2)::text as by_ip
    from tournament_auth_attempts where action=$3 and attempted_at > now() - interval '15 minutes'`,[email,ip,action]);
  const r=counts.rows[0];
  if(Number(r.by_email)>=10 || Number(r.by_ip)>=(action==='register'?5:30))fail('Demasiados intentos. Esperá 15 minutos.',429);
  await db.query('insert into tournament_auth_attempts(email,ip,action) values ($1,$2,$3)',[email,ip.slice(0,64),action]);
}
async function attempt(db:PGlite,email:string,ip:string,action:'login'|'register') {
  // El intento se confirma por separado: un login rechazado también consume límite.
  await inventoryTransaction(db,connection=>throttle(connection,email,ip.slice(0,64),action));
}
async function session(db:PGlite,account:TournamentAccount) {
  const token=crypto.randomBytes(32).toString('hex');
  await db.query("insert into tournament_sessions(token_hash,account_id,expires_at) values ($1,$2,now()+interval '30 days')",[tokenHash(token),account.id]);
  return {account,token};
}
export async function registerTournamentAccount(db:PGlite,input:{displayName:string;email:string;password:string},ip='') {
  if(!input || typeof input.displayName!=='string' || !input.displayName.trim() || input.displayName.length>100)fail('Ingresá tu nombre (hasta 100 caracteres).');
  const email=emailOf(input.email),password=passwordOf(input.password,true);
  await attempt(db,email,ip,'register');
  const hash=await passwordHash(password);
  return inventoryTransaction(db,async connection=>{
    const account={id:crypto.randomUUID(),displayName:input.displayName.trim(),email};
    const result=await connection.query('insert into tournament_accounts(id,display_name,email,password_hash) values ($1,$2,$3,$4) on conflict (email) do nothing returning id',[account.id,account.displayName,email,hash]);
    if(!result.rows.length)fail('Ya existe una cuenta con ese email. Iniciá sesión.',409);
    return session(connection,account);
  });
}
export async function loginTournamentAccount(db:PGlite,input:{email:string;password:string},ip='') {
  if(!input)fail('Datos de acceso inválidos.');
  const email=emailOf(input.email),password=passwordOf(input.password);
  await attempt(db,email,ip,'login');
  const result=await db.query<{id:string;display_name:string;email:string;password_hash:string}>('select id,display_name,email,password_hash from tournament_accounts where email=$1',[email]);
  const row=result.rows[0];
  const match=await passwordMatches(password,row?.password_hash??`${'0'.repeat(32)}:${'0'.repeat(128)}`);
  if(!row || !match)fail('Email o contraseña incorrectos.',401);
  return session(db,{id:row.id,displayName:row.display_name,email:row.email});
}
export async function getTournamentAccount(db:PGlite,token:string):Promise<TournamentAccount|null> {
  if(!/^[0-9a-f]{64}$/.test(token))return null;
  const result=await db.query<{id:string;display_name:string;email:string}>(`select a.id,a.display_name,a.email from tournament_sessions s join tournament_accounts a on a.id=s.account_id where s.token_hash=$1 and s.expires_at>now()`,[tokenHash(token)]);
  const row=result.rows[0];return row?{id:row.id,displayName:row.display_name,email:row.email}:null;
}
export async function logoutTournamentAccount(db:PGlite,token:string) {
  if(/^[0-9a-f]{64}$/.test(token))await db.query('delete from tournament_sessions where token_hash=$1',[tokenHash(token)]);
}
