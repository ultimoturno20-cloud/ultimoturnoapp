export type TournamentPlayer = { id: number; name: string; playerId: string; active: boolean; dropRound: number | null };
export type TournamentMatch = { a: number; b: number | null; result: 'A' | 'B' | 'T' | null };
export type TournamentState = { name: string; swissCount: number; cutSize: number; players: TournamentPlayer[]; swiss: TournamentMatch[][]; cut: TournamentMatch[][]; seeds: number[] };
export type TournamentCommand =
  | { type: 'configure'; name: string; swissCount: number; cutSize: number }
  | { type: 'addPlayer'; name: string; playerId: string }
  | { type: 'setActive'; player: number; active: boolean }
  | { type: 'nextSwiss' } | { type: 'startCut' } | { type: 'nextCut' }
  | { type: 'result'; phase: 'swiss' | 'cut'; match: number; result: TournamentMatch['result'] };
export const tournamentHeaders = ['Standing','Name','Flight','Drop Round','Match Record','Match Points',"Opponents' Win %","Opponents' Opponents' Win %"];
function fail(message: string): never { throw Object.assign(new Error(message), { statusCode: 400 }); }
function text(value: unknown, max: number, required = true): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail('Texto vacío o demasiado largo.');
  return value.trim();
}
function settings(name: unknown, rounds: unknown, cut: unknown) {
  if (!Number.isSafeInteger(rounds) || Number(rounds) < 1 || Number(rounds) > 20 || ![0,2,4,8,16].includes(Number(cut)) || typeof cut !== 'number') fail('Rondas: 1 a 20. Top cut: 0, 2, 4, 8 o 16.');
  return { name: text(name,120), swissCount: Number(rounds), cutSize: Number(cut) };
}
export function newTournament(name: unknown, rounds: unknown, cut: unknown): TournamentState {
  return { ...settings(name,rounds,cut), players: [], swiss: [], cut: [], seeds: [] };
}
export function roundComplete(round: TournamentMatch[]) { return round.every(m => m.result !== null); }
export function tournamentStandings(t: TournamentState) {
  const rows = t.players.map(p => ({ ...p, w: 0, l: 0, ties: 0, points: 0, byes: 0, opponents: [] as number[], wp: .25, owp: 0, oowp: 0 }));
  const byId = new Map(rows.map(r => [r.id,r]));
  for (const round of t.swiss) for (const m of round) {
    if (m.result === null) continue;
    const a = byId.get(m.a)!;
    if (m.b === null) { a.w++; a.points += 3; a.byes++; continue; }
    const b = byId.get(m.b)!;
    a.opponents.push(b.id); b.opponents.push(a.id);
    if (m.result === 'T') { a.ties++; b.ties++; a.points++; b.points++; }
    else { const [w,l] = m.result === 'A' ? [a,b] : [b,a]; w.w++; w.points += 3; l.l++; }
  }
  for (const r of rows) {
    const games = r.w+r.l+r.ties-r.byes;
    const cap = !r.active && r.dropRound !== null && r.dropRound < t.swissCount ? .75 : 1;
    r.wp = Math.min(cap,Math.max(.25,games ? (r.w-r.byes)/games : .25));
  }
  for (const r of rows) r.owp = r.opponents.length ? r.opponents.reduce((s,id) => s+byId.get(id)!.wp,0)/r.opponents.length : 0;
  for (const r of rows) r.oowp = r.opponents.length ? r.opponents.reduce((s,id) => s+byId.get(id)!.owp,0)/r.opponents.length : 0;
  return rows.sort((a,b) => b.points-a.points || b.owp-a.owp || b.oowp-a.oowp || a.id-b.id);
}
export function tournamentRows(t: TournamentState): Array<Array<string | number>> {
  return tournamentStandings(t).map((r,i) => [i+1,r.name,1,r.dropRound ?? '',`${r.w}/${r.l}/${r.ties} (${r.points})`,r.points,`${(r.owp*100).toFixed(2)}%`,`${(r.oowp*100).toFixed(2)}%`]);
}
export function cutPairs(seeds: number[]): TournamentMatch[] {
  let order = [1,2];
  while (order.length < seeds.length) { const n = order.length*2; order = order.flatMap(s => [s,n+1-s]); }
  return Array.from({ length: seeds.length/2 },(_,i) => ({ a: seeds[order[i*2]-1], b: seeds[order[i*2+1]-1], result: null }));
}
export function applyTournamentCommand(original: TournamentState, cmd: TournamentCommand): TournamentState {
  if (!cmd || typeof cmd !== 'object') fail('Acción inválida.');
  const t = structuredClone(original);
  switch (cmd.type) {
    case 'configure':
      if (t.swiss.length) fail('La configuración se cierra al iniciar Swiss.');
      Object.assign(t,settings(cmd.name,cmd.swissCount,cmd.cutSize)); break;
    case 'addPlayer': {
      if (t.swiss.length) fail('La inscripción está cerrada.');
      if (t.players.length >= 128) fail('Esta versión admite hasta 128 jugadores.');
      const name = text(cmd.name,100), playerId = text(cmd.playerId,50,false);
      if (playerId && t.players.some(p => p.playerId === playerId)) fail('Player ID duplicado.');
      t.players.push({ id: Math.max(0,...t.players.map(p => p.id))+1, name, playerId, active: true, dropRound: null }); break;
    }
    case 'setActive': {
      if (t.cut.length || (t.swiss.length && !roundComplete(t.swiss.at(-1)!))) fail('Las bajas se registran entre rondas Swiss.');
      const p = t.players.find(p => p.id === cmd.player);
      if (!p || typeof cmd.active !== 'boolean') fail('Jugador inválido.');
      p.active = cmd.active; p.dropRound = cmd.active ? null : t.swiss.length; break;
    }
    case 'result': {
      if (!['swiss','cut'].includes(cmd.phase)) fail('Fase inválida.');
      const rounds = cmd.phase === 'swiss' ? t.swiss : t.cut;
      const m = Number.isSafeInteger(cmd.match) ? rounds.at(-1)?.[cmd.match] : undefined;
      if (!m || m.b === null || (cmd.phase === 'swiss' && t.cut.length)) fail('Mesa inválida o ronda cerrada.');
      if (![null,'A','B','T'].includes(cmd.result) || (cmd.phase === 'cut' && cmd.result === 'T')) fail('Resultado inválido. Top cut no admite empate.');
      m.result = cmd.result; break;
    }
    case 'nextSwiss': {
      if (t.cut.length || t.swiss.length >= t.swissCount) fail('Swiss ya terminó.');
      if (t.swiss.length && !roundComplete(t.swiss.at(-1)!)) fail('Completá todos los resultados antes de avanzar.');
      const rows = tournamentStandings(t).filter(r => r.active);
      if (rows.length < 2) fail('Se necesitan al menos dos jugadores activos.');
      if (!t.swiss.length && rows.length < t.cutSize) fail('El top cut supera la cantidad de jugadores activos.');
      if (!t.swiss.length) for (let i=rows.length-1;i>0;i--) { const j = Math.floor(Math.random()*(i+1)); [rows[i],rows[j]] = [rows[j],rows[i]]; }
      const points = new Map(rows.map(r => [r.id,r.points]));
      const key = (a: number,b: number) => `${Math.min(a,b)}:${Math.max(a,b)}`;
      const previous = new Set(t.swiss.flatMap(r => r.filter(m => m.b !== null).map(m => key(m.a,m.b!))));
      let budget = 200000;
      function pair(ids: number[]): TournamentMatch[] | null {
        if (--budget <= 0) fail('La búsqueda alcanzó su límite. No se creó una ronda parcial.');
        if (!ids.length) return [];
        const a = ids[0];
        const candidates = ids.slice(1).sort((b,c) => Math.abs(points.get(a)!-points.get(b)!)-Math.abs(points.get(a)!-points.get(c)!));
        for (const b of candidates) {
          if (previous.has(key(a,b))) continue;
          const tail = pair(ids.slice(1).filter(i => i !== b));
          if (tail) return [{ a,b,result: null },...tail];
        }
        return null;
      }
      const ids = rows.map(r => r.id);
      let matches: TournamentMatch[] | null = null;
      if (ids.length%2) {
        const candidates = [...rows].sort((a,b) => a.byes-b.byes || a.points-b.points || a.owp-b.owp || a.oowp-b.oowp);
        for (const r of candidates) { matches = pair(ids.filter(id => id !== r.id)); if (matches) { matches.push({ a:r.id,b:null,result:'A' }); break; } }
      } else matches = pair(ids);
      if (!matches) fail('No hay emparejamiento posible sin repetir rivales.');
      t.swiss.push(matches); break;
    }
    case 'startCut': {
      if (t.cut.length || t.swiss.length !== t.swissCount || !roundComplete(t.swiss.at(-1)!)) fail('Completá Swiss antes de iniciar el top cut.');
      const eligible = tournamentStandings(t).filter(r => r.active);
      if (![2,4,8,16].includes(t.cutSize) || t.cutSize > eligible.length) fail('Top cut inválido o jugadores insuficientes.');
      t.seeds = eligible.slice(0,t.cutSize).map(r => r.id); t.cut.push(cutPairs(t.seeds)); break;
    }
    case 'nextCut': {
      const last = t.cut.at(-1);
      if (!last || !roundComplete(last)) fail('Completá todos los resultados del top cut.');
      if (last.length === 1) fail('El torneo ya tiene campeón.');
      const winners = last.map(m => m.result === 'A' ? m.a : m.b!);
      t.cut.push(Array.from({length:winners.length/2},(_,i) => ({a:winners[2*i],b:winners[2*i+1],result:null}))); break;
    }
    default: fail('Acción de torneo desconocida.');
  }
  return t;
}
// Importa tanto el JSON del escritorio como una copia de seguridad web.
export function importTournament(value: unknown): TournamentState {
  if (!value || typeof value !== 'object') fail('Archivo de torneo inválido.');
  const d = value as Record<string, unknown>;
  const t = newTournament(d.name,d.swissCount ?? d.swiss_count,d.cutSize ?? d.cut_size);
  if (!Array.isArray(d.players) || d.players.length > 128 || !Array.isArray(d.swiss) || d.swiss.length > t.swissCount || !Array.isArray(d.cut) || d.cut.length > 4 || !Array.isArray(d.seeds)) fail('Estructura inválida.');
  t.players = d.players.map((p: Record<string,unknown>) => {
    if (!p || !Number.isSafeInteger(p.id) || Number(p.id) < 1 || typeof p.active !== 'boolean') fail('Jugador inválido.');
    return {id:Number(p.id),name:text(p.name,100),playerId:text(p.playerId ?? p.player_id ?? '',50,false),active:p.active,dropRound:(p.dropRound ?? p.drop_round ?? null) as number | null};
  });
  const ids = new Set(t.players.map(p => p.id));
  const playerIds = t.players.map(p => p.playerId).filter(Boolean);
  if (ids.size !== t.players.length || new Set(playerIds).size !== playerIds.length) fail('Jugadores duplicados.');
  const previous = new Set<string>();
  function rounds(value: unknown[], cut: boolean): TournamentMatch[][] {
    return value.map((r,index) => {
      if (!Array.isArray(r) || !r.length || r.length > 64) fail('Ronda inválida.');
      const used = new Set<number>();
      const matches = r.map((m: TournamentMatch) => {
        if (!m || !ids.has(m.a) || (m.b !== null && (!ids.has(m.b) || m.b === m.a)) || ![null,'A','B','T'].includes(m.result)) fail('Mesa inválida.');
        for (const id of m.b === null ? [m.a] : [m.a,m.b]) { if (used.has(id)) fail('Jugador repetido en una ronda.'); used.add(id); }
        if (m.b === null && (cut || m.result !== 'A')) fail('Bye inválido.');
        if (cut && m.result === 'T') fail('Top cut no admite empate.');
        if (!cut && m.b !== null) { const key = [m.a,m.b].sort((a,b) => a-b).join(':'); if (previous.has(key)) fail('El archivo contiene rivales repetidos.'); previous.add(key); }
        return {a:m.a,b:m.b,result:m.result};
      });
      if (index < value.length-1 && !roundComplete(matches)) fail('Ronda anterior incompleta.');
      return matches;
    });
  }
  t.swiss = rounds(d.swiss,false); t.cut = rounds(d.cut,true); t.seeds = d.seeds as number[];
  for (const p of t.players) {
    if (!p.active && p.dropRound === null) p.dropRound = Math.max(0,...t.swiss.flatMap((r,i) => r.some(m => m.a===p.id || m.b===p.id) ? [i+1] : []));
    if (p.dropRound !== null && (!Number.isSafeInteger(p.dropRound) || p.dropRound < 0 || p.dropRound > t.swiss.length || p.active)) fail('Ronda de baja inválida.');
  }
  if (t.cut.length) {
    if (t.swiss.length !== t.swissCount || !roundComplete(t.swiss.at(-1)!) || t.seeds.length !== t.cutSize || ![2,4,8,16].includes(t.cutSize) || new Set(t.seeds).size !== t.seeds.length || t.seeds.some(id => !ids.has(id))) fail('Top cut inválido.');
    let expected = cutPairs(t.seeds);
    for (const r of t.cut) {
      if (r.length !== expected.length || r.some((m,i) => m.a !== expected[i].a || m.b !== expected[i].b)) fail('Cuadro top cut inválido.');
      const winners = r.map(m => m.result === 'A' ? m.a : m.b!);
      expected = Array.from({length:winners.length/2},(_,i) => ({a:winners[i*2],b:winners[i*2+1],result:null}));
    }
  } else if (t.seeds.length) fail('Semillas sin top cut.');
  return t;
}
