import assert from 'node:assert/strict';
import { it } from 'node:test';
import { newTournament, applyTournamentCommand as act, tournamentStandings, importTournament, tournamentRows, type TournamentState } from './tournaments.js';
function tournament(n=8,rounds=3,cut=4) {
  let t=newTournament('Local',rounds,cut);
  for(let i=0;i<n;i++)t=act(t,{type:'addPlayer',name:`Jugador ${i}`,playerId:String(i)});
  return t;
}
function finish(t:TournamentState,result:'A'|'B'|'T'='A') {
  for(let i=0;i<t.swiss.at(-1)!.length;i++)if(t.swiss.at(-1)![i].b!==null)t=act(t,{type:'result',phase:'swiss',match:i,result});
  return t;
}
it('Swiss pairs everyone once per round, never repeats opponents, and seeds top cut',()=>{
  let t=tournament(); const played=new Set<string>();
  for(let i=0;i<3;i++){
    t=act(t,{type:'nextSwiss'});
    assert.equal(new Set(t.swiss.at(-1)!.flatMap(m=>[m.a,m.b])).size,8);
    for(const m of t.swiss.at(-1)!){const key=[m.a,m.b].sort().join(':');assert.ok(!played.has(key));played.add(key);}
    t=finish(t);
  }
  t=act(t,{type:'startCut'});
  assert.deepEqual(t.cut[0].map(m=>[m.a,m.b]),[[t.seeds[0],t.seeds[3]],[t.seeds[1],t.seeds[2]]]);
  assert.throws(()=>act(t,{type:'result',phase:'cut',match:0,result:'T'}));
  for(let i=0;i<2;i++)t=act(t,{type:'result',phase:'cut',match:i,result:'A'});
  t=act(t,{type:'nextCut'});
  assert.equal(t.cut.at(-1)!.length,1);
  t=act(t,{type:'result',phase:'cut',match:0,result:'B'});
  assert.throws(()=>act(t,{type:'nextCut'}));
  assert.deepEqual(importTournament(t),t);
});
it('byes rotate and score automatically; dropped players keep record and stop pairing',()=>{
  let t=tournament(5,3,0);const byes=new Set<number>();
  for(let i=0;i<3;i++){
    t=act(t,{type:'nextSwiss'});const bye=t.swiss.at(-1)!.find(m=>m.b===null)!;
    assert.ok(!byes.has(bye.a));byes.add(bye.a);assert.equal(bye.result,'A');t=finish(t,'T');
  }
  assert.equal(tournamentStandings(t).reduce((s,r)=>s+r.points,0),21);
  t=tournament(6,2,0);t=finish(act(t,{type:'nextSwiss'}));
  t=act(t,{type:'setActive',player:1,active:false});t=act(t,{type:'nextSwiss'});
  assert.ok(t.swiss.at(-1)!.every(m=>m.a!==1&&m.b!==1));
  assert.equal(t.players[0].dropRound,1);
});
it('invalid actions preserve original state and pending rounds block progression',()=>{
  let t=act(tournament(),{type:'nextSwiss'});const before=structuredClone(t);
  assert.throws(()=>act(t,{type:'nextSwiss'}));assert.throws(()=>act(t,{type:'startCut'}));
  assert.throws(()=>act(t,{type:'addPlayer',name:'Nuevo',playerId:''}));
  assert.throws(()=>act(t,{type:'setActive',player:1,active:false}));
  assert.deepEqual(t,before);
  t=tournament(2,2,0);t=finish(act(t,{type:'nextSwiss'}));assert.throws(()=>act(t,{type:'nextSwiss'}),/sin repetir/);
});
it('resistance counts wins, ignores bye wins, caps early drops and gives exact record columns',()=>{
  const t=tournament(4,3,0);
  t.swiss=[[{a:1,b:2,result:'A'},{a:3,b:4,result:'A'}],[{a:1,b:3,result:'A'},{a:2,b:4,result:'T'}],[{a:1,b:4,result:'B'},{a:2,b:3,result:'A'}]];
  const rows=tournamentStandings(t);assert.deepEqual(rows.map(r=>r.id),[1,2,4,3]);
  assert.equal(rows.find(r=>r.id===2)!.wp,1/3);assert.equal(rows[0].owp,1/3);
  assert.ok(Math.abs(rows[0].oowp-4/9)<1e-12);
  assert.equal(tournamentRows(t)[0][4],'2/1/0 (6)');
  t.swiss=t.swiss.slice(0,2);const dropped=act(t,{type:'setActive',player:1,active:false});
  assert.equal(tournamentStandings(dropped).find(r=>r.id===1)!.wp,.75);
});
it('desktop JSON migration validates rounds, results and legacy drop metadata',()=>{
  let t=tournament(5,1,0);t=finish(act(t,{type:'nextSwiss'}));t=act(t,{type:'setActive',player:1,active:false});
  const desktop={name:t.name,swiss_count:t.swissCount,cut_size:t.cutSize,players:t.players.map(p=>({id:p.id,name:p.name,active:p.active,player_id:p.playerId})),swiss:t.swiss,cut:[],seeds:[]};
  assert.deepEqual(importTournament(desktop),t);
  const bad=structuredClone(desktop);bad.swiss[0][0].b=999;assert.throws(()=>importTournament(bad));
  assert.throws(()=>importTournament({...desktop,swiss:[desktop.swiss[0],desktop.swiss[0]],swiss_count:2}),/repetidos/);
  assert.throws(()=>importTournament({...desktop,players:[desktop.players[0],desktop.players[0]]}),/duplicados/);
});
