import React, {useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TournamentsView} from './tournaments.js';
import './styles.css';
import './tournament-space.css';
const sessionKey='ultimoturno.tournaments.session.v1';
type Account={id:string;displayName:string;email:string};
type Options={method?:string;body?:unknown;signal?:AbortSignal};
function readToken(){try{return localStorage.getItem(sessionKey)||'';}catch{return '';}}
function saveToken(token:string){try{if(token)localStorage.setItem(sessionKey,token);else localStorage.removeItem(sessionKey);}catch{/* La sesión actual sigue disponible en memoria. */}}
async function spaceApi<T>(path:string,token:string,options:Options={}):Promise<T>{
  const base=String(import.meta.env.VITE_API_BASE_URL||'/api').replace(/\/$/,'');
  const response=await fetch(`${base}/tournament-space${path}`,{method:options.method||'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:options.body?JSON.stringify(options.body):undefined,signal:options.signal,cache:'no-store'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const error=Object.assign(new Error(payload.error||'No se pudo conectar con Torneos.'),{status:response.status});throw error;}
  return payload as T;
}
export function TournamentSpace(){
  const [token,setToken]=useState(readToken);
  const [account,setAccount]=useState<Account|null>(null);
  const [checking,setChecking]=useState(!!token);
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [error,setError]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!token){setAccount(null);setChecking(false);return;}
    const controller=new AbortController();setChecking(true);setError('');
    void spaceApi<{account:Account}>('/me',token,{signal:controller.signal}).then(r=>setAccount(r.account)).catch(e=>{
      if(controller.signal.aborted)return;
      if(e.status===401){saveToken('');setToken('');setAccount(null);setError('Tu sesión venció. Volvé a ingresar.');}
      else setError(e.message);
    }).finally(()=>{if(!controller.signal.aborted)setChecking(false);});
    return ()=>controller.abort();
  },[token,retry]);
  useEffect(()=>{
    function storage(e:StorageEvent){if(e.key===sessionKey){setAccount(null);setToken(e.newValue||'');}}
    window.addEventListener('storage',storage);return ()=>window.removeEventListener('storage',storage);
  },[]);
  const request=useCallback(async<T,>(path:string,options:Options={})=>{
    try{return await spaceApi<T>(path,token,options);}catch(e){if((e as {status?:number}).status===401){saveToken('');setToken('');setAccount(null);setError('Tu sesión venció. Volvé a ingresar.');}throw e;}
  },[token]);
  async function submit(e:React.FormEvent){
    e.preventDefault();if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
    try{
      const result=await spaceApi<{account:Account;token:string}>(`/${mode}`,'',{method:'POST',body:mode==='register'?{displayName,email,password}:{email,password}});
      saveToken(result.token);setAccount(result.account);setToken(result.token);setPassword('');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo ingresar.');}finally{busyRef.current=false;setBusy(false);}
  }
  async function logout(){
    if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
    try{await spaceApi('/logout',token,{method:'POST'});saveToken('');setToken('');setAccount(null);setPassword('');const url=new URL(window.location.href);url.searchParams.delete('torneo');window.history.replaceState({},'',url);}
    catch(e){setError(e instanceof Error?e.message:'No se pudo cerrar la sesión.');}finally{busyRef.current=false;setBusy(false);}
  }
  return <main className="shell tournament-space">
    <header className="app-header space-header"><div className="brand-lockup"><img className="brand-mark" src="/brand/ultimo-turno-logo.jpeg" alt="UltimoTurno"/><div><p className="eyebrow">Tu espacio de juego</p><h1>UltimoTurno <span>Torneos</span></h1></div></div>{account?<div className="space-account"><span>{account.displayName}</span><button className="secondary-action" disabled={busy} onClick={()=>void logout()}>Cerrar sesión</button></div>:<span className="profile-badge">Pokémon TCG</span>}</header>
    {error?<div className="space-error feedback error" role="alert">{error}</div>:null}
    {checking?<div className="space-loading" role="status">Abriendo tu espacio…</div>:account?<TournamentsView key={account.id} request={request}/>:token?<div className="space-loading"><p>No se pudo abrir tu espacio.</p><button className="primary-action" onClick={()=>setRetry(n=>n+1)}>Volver a intentar</button></div>:<section className="space-welcome">
      <div className="space-intro"><p className="eyebrow">De la primera ronda a la final</p><h2>Tu torneo.<br/>Tu último turno.</h2><p>Organizá tus torneos Pokémon TCG, cargá resultados y seguí jugando desde cualquier PC.</p><div className="space-features"><span>Rondas Swiss</span><span>Top cut</span><span>Posiciones</span></div></div>
      <form className="space-login panel" onSubmit={e=>void submit(e)}><h2>{mode==='login'?'Entrá a tu espacio':'Creá tu cuenta'}</h2><p>Una cuenta de UltimoTurno Torneos para guardar y continuar tus eventos.</p><fieldset disabled={busy}>{mode==='register'?<label>Tu nombre<input value={displayName} required maxLength={100} autoComplete="name" onChange={e=>setDisplayName(e.target.value)}/></label>:null}<label>Email<input type="email" value={email} required maxLength={254} autoComplete="email" onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" value={password} required minLength={mode==='register'?10:1} maxLength={128} autoComplete={mode==='register'?'new-password':'current-password'} onChange={e=>setPassword(e.target.value)}/></label>{mode==='register'?<small>Usá al menos 10 caracteres.</small>:null}<button className="primary-action" type="submit">{busy?'Un momento…':mode==='login'?'Entrar':'Crear mi cuenta'}</button><button className="space-switch" type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setPassword('');setError('');}}>{mode==='login'?'¿Primera vez? Creá tu cuenta':'Ya tengo una cuenta'}</button></fieldset></form>
    </section>}
    <footer className="space-footer">UltimoTurno Torneos · Hecho para tu comunidad TCG.</footer>
  </main>;
}
if(document.getElementById('root'))createRoot(document.getElementById('root')!).render(<TournamentSpace/>);
