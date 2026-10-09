import React, { useEffect, useRef, useState } from 'react';
import { tournamentHeaders, tournamentRows, tournamentStandings, roundComplete, type TournamentState, type TournamentCommand, type TournamentMatch } from '@ultimoturno/domain';
import './tournaments.css';
import {ManualRoundEditor} from './manual-round.js';
import { tournamentCsv, tournamentPrintHtml } from './tournament-exports.js';

type Document = { id: string; version: number; state: TournamentState; updatedAt: string };
type Summary = { id: string; version: number; name: string; players: number; swissRounds: number; swissCount: number; cutStarted: boolean; updatedAt: string };
type Request = <T>(path: string, options?: { method?: string; body?: unknown; signal?: AbortSignal }) => Promise<T>;
function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content],{type}));
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url),1000);
}
function titleOf(t: TournamentState) {
  const final=t.cut.at(-1);
  if (final?.length===1 && roundComplete(final)) { const m=final[0]; return `Campeón: ${t.players.find(p=>p.id===(m.result==='A'?m.a:m.b))?.name}`; }
  if (final) return `Top ${final.length*2}`;
  if (t.swiss.length===t.swissCount && roundComplete(t.swiss.at(-1)!)) return 'Swiss finalizado';
  return t.swiss.length ? `Swiss · Ronda ${t.swiss.length}/${t.swissCount}` : 'Inscripción abierta';
}
export function TournamentsView({request}: {request: Request}) {
  const [list,setList]=useState<Summary[]>([]);
  const [current,setCurrent]=useState<Document|null>(null);
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const [uncertain,setUncertain]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [name,setName]=useState('Torneo UltimoTurno');
  const [swissCount,setSwissCount]=useState(3);
  const [cutSize,setCutSize]=useState(0);
  const [playerName,setPlayerName]=useState('');
  const [playerId,setPlayerId]=useState('');
  const [tab,setTab]=useState<'players'|'rounds'|'standings'>('players');
  const [round,setRound]=useState('');
  const [manual,setManual]=useState<'append'|'replace'|null>(null);
  const createKey=useRef<string|null>(null);
  const importInput=useRef<HTMLInputElement>(null);
  async function loadList(signal?: AbortSignal) { const r=await request<{tournaments:Summary[]}>('/tournaments',{signal}); setList(r.tournaments); }
  useEffect(()=>{
    const controller=new AbortController();
    async function start() {
      try {
        await loadList(controller.signal);
        const id=new URLSearchParams(window.location.search).get('torneo');
        if (id) { const r=await request<{tournament:Document}>(`/tournaments/${encodeURIComponent(id)}`,{signal:controller.signal}); setCurrent(r.tournament); }
      } catch(e) { if (!controller.signal.aborted) setError(e instanceof Error?e.message:'No se pudieron cargar los torneos.'); }
    }
    void start(); return ()=>controller.abort();
  },[request]);
  useEffect(()=>{
    if (!current) return;
    const t=current.state; setName(t.name); setSwissCount(t.swissCount); setCutSize(t.cutSize);
    setRound(t.cut.length ? `cut:${t.cut.length-1}` : t.swiss.length ? `swiss:${t.swiss.length-1}` : '');
  },[current?.id,current?.version]);
  async function run(work:()=>Promise<void>,mutation=false) {
    if (busyRef.current) return;
    busyRef.current=true; setBusy(true); setError(''); setMessage('');
    try { await work(); }
    catch(e) {
      const status=(e as {status?:number})?.status;
      if (mutation && (status===409 || status===undefined || status>=500)) { setUncertain(true); setError('La operación no quedó confirmada o el torneo cambió en otra PC. Recargá antes de volver a editar. '+(e instanceof Error?e.message:'')); }
      else setError(e instanceof Error?e.message:'No se pudo completar la operación.');
    } finally {busyRef.current=false;setBusy(false);}
  }
  function remember(id:string|null) { const url=new URL(window.location.href); if (id) url.searchParams.set('torneo',id); else url.searchParams.delete('torneo'); window.history.replaceState({},'',url); }
  async function open(id:string) { await run(async()=>{const r=await request<{tournament:Document}>(`/tournaments/${id}`);setCurrent(r.tournament);setUncertain(false);remember(id);setTab('players');setManual(null);}); }
  async function refresh() { await run(async()=>{ if(current) { const r=await request<{tournament:Document}>(`/tournaments/${current.id}`);setCurrent(r.tournament); } await loadList();setUncertain(false);setMessage('Datos actualizados desde el servidor.'); }); }
  async function command(command:TournamentCommand) {
    if(!current || uncertain) return;
    await run(async()=>{
      const r=await request<{tournament:Document}>(`/tournaments/${current.id}`,{method:'PUT',body:{version:current.version,command}});
      setCurrent(r.tournament);setMessage('Cambios guardados.');
      if(command.type==='addPlayer'){setPlayerName('');setPlayerId('');}
      if(['nextSwiss','manualSwiss','startCut','nextCut'].includes(command.type)) {setTab('rounds');setManual(null);}
    },true);
  }
  async function create(imported?:unknown) {
    if (uncertain) return;
    const id=createKey.current??crypto.randomUUID(); createKey.current=id;
    await run(async()=>{
      const body=imported===undefined?{id,name,swissCount,cutSize}:{id,imported};
      const r=await request<{tournament:Document}>('/tournaments',{method:'POST',body});
      setCurrent(r.tournament);remember(r.tournament.id);createKey.current=null;setTab('players');setMessage('Torneo guardado.');
    },true);
  }
  async function importFile(file:File) {
    if(file.size>1000000){setError('El archivo supera 1 MB.');return;}
    let data:unknown;try{data=JSON.parse(await file.text());}catch{setError('Archivo JSON inválido.');return;}
    await create(data);
  }
  const t=current?.state;
  const [phase,roundIndex]=round.split(':');
  const history=t ? [...t.swiss.map((_,i)=>({key:`swiss:${i}`,label:`Swiss · Ronda ${i+1}`})),...t.cut.map((r,i)=>({key:`cut:${i}`,label:`Top cut · Top ${r.length*2}`}))] : [];
  const selectedRound=t ? (phase==='cut'?t.cut:t.swiss)[Number(roundIndex)] : undefined;
  const latest=t ? (t.cut.length?`cut:${t.cut.length-1}`:t.swiss.length?`swiss:${t.swiss.length-1}`:'') : '';
  const editable=round===latest && !uncertain;
  const names=new Map(t?.players.map(p=>[p.id,p.name])??[]);
  const standings=t?tournamentStandings(t):[];
  function exportData(kind:'json'|'csv'|'html') {
    if(!t)return;
    const content=kind==='json'?JSON.stringify(t,null,2):kind==='csv'?tournamentCsv(t):tournamentPrintHtml(t);
    download(content,kind==='json'?'application/json':kind==='csv'?'text/csv;charset=utf-8':'text/html;charset=utf-8',`ultimoturno-torneo.${kind}`);
  }
  return <section className="view tournaments-view">
    <div className="tournament-heading"><div><p className="eyebrow">UltimoTurno · Pokémon TCG</p><h2>Torneos</h2><p className="subtitle">Swiss, resultados y top cut, guardados para continuar desde otra PC.</p></div><button className="secondary-action" disabled={busy} onClick={()=>void refresh()}>Recargar datos</button></div>
    {error?<div className="feedback error" role="alert">{error}</div>:null}
    {message?<div className="feedback ok" role="status">{message}</div>:null}
    {uncertain?<p className="tournament-notice">Edición pausada hasta recargar. Revisá el estado actualizado para confirmar si la última operación se guardó.</p>:null}
    {busy?<p role="status">Guardando / cargando…</p>:null}
    {!current?<>
      <form className="panel tournament-form" onSubmit={e=>{e.preventDefault();void create();}}><h3>Nuevo torneo</h3><fieldset disabled={busy||uncertain}><label>Nombre<input value={name} required maxLength={120} onChange={e=>setName(e.target.value)}/></label><label>Rondas Swiss<input type="number" min={1} max={20} value={swissCount} onChange={e=>setSwissCount(Number(e.target.value))}/></label><label>Top cut<select value={cutSize} onChange={e=>setCutSize(Number(e.target.value))}>{[0,2,4,8,16].map(n=><option key={n} value={n}>{n?`Top ${n}`:'Sin top cut'}</option>)}</select></label><button className="primary-action" type="submit">Crear torneo</button><button className="secondary-action" type="button" onClick={()=>importInput.current?.click()}>Importar torneo JSON</button><input ref={importInput} hidden type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void importFile(f);}}/></fieldset></form>
      <div className="panel"><h3>Torneos guardados</h3>{!list.length?<p>Todavía no hay torneos guardados.</p>:<div className="tournament-list">{list.map(item=><button key={item.id} className="secondary-action" disabled={busy} onClick={()=>void open(item.id)}><span><strong>{item.name}</strong><small>{item.players} jugadores · Swiss {item.swissRounds}/{item.swissCount}{item.cutStarted?' · Top cut':''}</small></span><span>Abrir →</span></button>)}</div>}</div>
    </>:<>
      <div className="panel tournament-current"><div><h3>{t!.name}</h3><p>{titleOf(t!)} · {t!.players.length} jugadores</p><small>Versión {current.version} · Los cambios se guardan al confirmar cada acción.</small></div><div className="tournament-actions"><button className="secondary-action" disabled={busy} onClick={()=>{setCurrent(null);remember(null);createKey.current=null;setName('Torneo UltimoTurno');setUncertain(false);void run(()=>loadList());}}>Volver a torneos</button><button className="secondary-action" onClick={()=>exportData('json')}>Copia JSON</button><button className="secondary-action" onClick={()=>exportData('csv')}>Exportar CSV</button><button className="secondary-action" onClick={()=>exportData('html')}>Tabla para imprimir</button></div></div>
      <div className="tournament-tabs" role="tablist" aria-label="Secciones del torneo">{(['players','rounds','standings'] as const).map(key=><button key={key} id={`tournament-tab-${key}`} role="tab" aria-selected={tab===key} aria-controls="tournament-content" className={tab===key?'primary-action':'secondary-action'} onClick={()=>setTab(key)}>{({players:'Jugadores',rounds:'Rondas y resultados',standings:'Posiciones Swiss'})[key]}</button>)}</div>
      <div id="tournament-content" role="tabpanel" aria-labelledby={`tournament-tab-${tab}`}>
      {tab==='players'?<div className="panel">
        {!t!.swiss.length?<><form className="tournament-form" onSubmit={e=>{e.preventDefault();void command({type:'configure',name,swissCount,cutSize});}}><fieldset disabled={busy||uncertain}><label>Nombre<input value={name} required maxLength={120} onChange={e=>setName(e.target.value)}/></label><label>Rondas Swiss<input type="number" min={1} max={20} value={swissCount} onChange={e=>setSwissCount(Number(e.target.value))}/></label><label>Top cut<select value={cutSize} onChange={e=>setCutSize(Number(e.target.value))}>{[0,2,4,8,16].map(n=><option key={n} value={n}>{n?`Top ${n}`:'Sin top cut'}</option>)}</select></label><button type="submit" className="secondary-action">Guardar configuración</button></fieldset></form></>:<p>{t!.swissCount} rondas Swiss · {t!.cutSize?`Top ${t!.cutSize}`:'Sin top cut'}</p>}
        {!t!.cut.length?<><form className="tournament-form" onSubmit={e=>{e.preventDefault();void command({type:'addPlayer',name:playerName,playerId});}}><fieldset disabled={busy||uncertain}><label>Jugador<input value={playerName} required maxLength={100} onChange={e=>setPlayerName(e.target.value)}/></label><label>Player ID (opcional)<input value={playerId} maxLength={50} onChange={e=>setPlayerId(e.target.value)}/></label><button type="submit" className="primary-action">Inscribir jugador</button></fieldset></form>{t!.swiss.length?<p className="tournament-notice">Ingreso tardío: empieza con 0 puntos. Las mesas y resultados existentes se conservan. Podés incluirlo en la ronda actual con “Editar ronda actual a mano”, o en la siguiente ronda.</p>:null}</>:<p>Inscripción cerrada: el top cut ya comenzó.</p>}
        {t!.swiss.length&&!t!.cut.length?<p>La baja conserva la mesa y el resultado de esta ronda. Cargá el resultado correspondiente en Rondas y resultados; el jugador no será emparejado en las siguientes rondas.</p>:null}
        <div className="tournament-player-list">{t!.players.map(p=><div key={p.id}><span><strong>{p.name}</strong><small>{p.playerId?`Player ID ${p.playerId} · `:''}{p.active?'Activo':`Baja · ronda ${p.dropRound??'—'}`}</small></span><button className="secondary-action" disabled={busy||uncertain||!!t!.cut.length||(!p.active&&!!t!.swiss.length&&!roundComplete(t!.swiss.at(-1)!))} onClick={()=>void command({type:'setActive',player:p.id,active:!p.active})}>{p.active?'Dar de baja':'Reactivar'}</button></div>)}</div>
      </div>:null}
      {tab==='rounds'?<div className="panel">
        <div className="tournament-actions"><button className="primary-action" disabled={busy||uncertain||!!t!.cut.length||t!.swiss.length>=t!.swissCount||(!!t!.swiss.length&&!roundComplete(t!.swiss.at(-1)!))} onClick={()=>void command({type:'nextSwiss'})}>{t!.swiss.length?'Generar siguiente Swiss':'Iniciar Swiss'}</button><button className="secondary-action" disabled={busy||uncertain||!!t!.cut.length||!t!.cutSize||t!.swiss.length!==t!.swissCount||!roundComplete(t!.swiss.at(-1)??[])} onClick={()=>void command({type:'startCut'})}>Iniciar top cut</button><button className="secondary-action" disabled={busy||uncertain||!t!.cut.length||t!.cut.at(-1)!.length===1||!roundComplete(t!.cut.at(-1)!)} onClick={()=>void command({type:'nextCut'})}>Avanzar top cut</button></div>
        <div className="tournament-actions manual-actions"><button className="secondary-action" disabled={busy||uncertain||!!t!.cut.length||t!.swiss.length>=t!.swissCount||(!!t!.swiss.length&&!roundComplete(t!.swiss.at(-1)!))} onClick={()=>setManual('append')}>Cargar ronda manual</button><button className="secondary-action" disabled={busy||uncertain||!!t!.cut.length||!t!.swiss.length} onClick={()=>setManual('replace')}>Editar ronda actual a mano</button></div>
        {manual?<ManualRoundEditor key={`${current.id}:${current.version}:${manual}`} state={t!} mode={manual} disabled={busy||uncertain} onCancel={()=>setManual(null)} onSave={matches=>void command({type:'manualSwiss',mode:manual,matches})}/>:null}
        {history.length?<label className="tournament-history">Consultar ronda<select value={round} onChange={e=>setRound(e.target.value)}>{history.map(h=><option key={h.key} value={h.key}>{h.label}</option>)}</select></label>:<p>Inscribí a los jugadores y guardá la configuración antes de iniciar Swiss.</p>}
        <div className="tournament-matches">{selectedRound?.map((m,index)=><article key={index} className="tournament-match"><div className="tournament-match-title"><strong>Mesa {index+1}</strong><span>{m.b===null?'Bye · +3 puntos':m.result===null?'Pendiente':m.result==='T'?'Empate':`Ganó ${names.get(m.result==='A'?m.a:m.b!)}`}</span></div><div className="tournament-versus"><div><small>Jugador A</small><strong>{names.get(m.a)}</strong></div><span>vs.</span><div><small>Jugador B</small><strong>{m.b===null?'BYE':names.get(m.b)}</strong></div></div>{m.b!==null?<div className="tournament-actions">{([{label:'Gana A',value:'A'},{label:'Empate',value:'T'},{label:'Gana B',value:'B'},{label:'Limpiar',value:null}] as Array<{label:string;value:TournamentMatch['result']}>).filter(r=>phase!=='cut'||r.value!=='T').map(r=><button key={r.label} className={m.result===r.value&&r.value!==null?'primary-action':'secondary-action'} disabled={busy||!editable} onClick={()=>void command({type:'result',phase:phase as 'swiss'|'cut',match:index,result:r.value})}>{r.label}</button>)}</div>:null}</article>)}</div>
        {t!.cut.length?<div className="tournament-bracket"><h3>Cuadro top cut</h3><div>{t!.cut.map((r,i)=><section key={i}><h4>Top {r.length*2}</h4>{r.map((m,j)=><div key={j}><span>{names.get(m.a)}</span><span>{names.get(m.b!)}</span><small>{m.result?`Ganó ${names.get(m.result==='A'?m.a:m.b!)}`:'Pendiente'}</small></div>)}</section>)}</div></div>:null}
      </div>:null}
      {tab==='standings'?<div className="panel"><h3>Posiciones Swiss</h3><p>{t!.swiss.length===t!.swissCount&&roundComplete(t!.swiss.at(-1)!)?'Swiss finalizado':'Posiciones provisionales; cambian al completar resultados.'}</p><div className="tournament-table-scroll"><table><thead><tr>{tournamentHeaders.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{tournamentRows(t!).map((r,i)=><tr key={standings[i].id}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div><p className="subtitle">Flight 1: grupo único. Récord: victorias/derrotas/empates (puntos). Los empates exactos usan orden de inscripción. La clasificación del top cut se consulta en su cuadro.</p></div>:null}
      </div>
    </>}
    <p className="subtitle tournament-footer">Torneos locales · Hasta 128 jugadores · Una categoría · Sincronización al abrir o recargar datos.</p>
  </section>;
}
