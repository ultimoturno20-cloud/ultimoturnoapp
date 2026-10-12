import React, { useEffect, useRef, useState } from "react";
import { ShieldUser, ShieldCheck, X, LogIn, LogOut, Save, RotateCcw, Pencil } from "lucide-react";
import type { StoreAdminSession, StoreAdminPrice, StoreCatalogItem } from "@ultimoturno/domain";
import { readSharedAdminSession, sharedAdminSessionKey, notifyStorePriceChange, storePricePreview } from "./store-admin-state.js";
const money=new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0,maximumFractionDigits:2});
class StoreAdminError extends Error { constructor(message:string,readonly status:number){super(message);} }
async function request<T>(path:string,token:string,options:{method?:string;body?:unknown;signal?:AbortSignal}={}):Promise<T> {
  const response=await fetch(`/api/store-admin/${path}`,{method:options.method||'GET',credentials:'omit',cache:'no-store',signal:options.signal,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new StoreAdminError(data.error||'No se pudo completar la operacion.',response.status);
  return data;
}
export function useStoreAdmin() {
  const [admin,setAdmin]=useState<StoreAdminSession|null>(null),[checking,setChecking]=useState(false);
  const generation=useRef(0),controller=useRef<AbortController|null>(null);
  function token(){try{return readSharedAdminSession(localStorage);}catch{return '';}}
  async function check(){
    const current=token(),revision=++generation.current;controller.current?.abort();
    if(!current){setAdmin(null);setChecking(false);return;}
    controller.current=new AbortController();setChecking(true);
    try{const result=await request<{admin:StoreAdminSession}>('session',current,{signal:controller.current.signal});if(revision===generation.current&&token()===current)setAdmin(result.admin);}
    catch(error){if(revision!==generation.current)return;setAdmin(null);if(error instanceof StoreAdminError&&error.status===401&&token()===current){try{localStorage.removeItem(sharedAdminSessionKey);}catch{/* Storage bloqueado. */}}}
    finally{if(revision===generation.current)setChecking(false);}
  }
  useEffect(()=>{
    const sync=()=>{void check();},changed=(event:StorageEvent)=>{if(event.key===sharedAdminSessionKey||event.key===null){setAdmin(null);sync();}};
    sync();window.addEventListener('storage',changed);window.addEventListener('focus',sync);
    const timer=setInterval(()=>{if(document.visibilityState==='visible'&&token())sync();},15000);
    return()=>{++generation.current;controller.current?.abort();clearInterval(timer);window.removeEventListener('storage',changed);window.removeEventListener('focus',sync);};
  },[]);
  async function login(email:string,password:string){
    const result=await request<{token:string;admin:StoreAdminSession}>('login','',{method:'POST',body:{email,password}});
    try{localStorage.setItem(sharedAdminSessionKey,result.token);}catch{await fetch('/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${result.token}`},credentials:'omit'}).catch(()=>undefined);throw new Error('Habilita almacenamiento para compartir la sesion con el panel.');}
    ++generation.current;controller.current?.abort();setChecking(false);setAdmin(result.admin);
  }
  async function logout(){const current=token();await fetch('/api/auth/logout',{method:'POST',headers:{Authorization:`Bearer ${current}`},credentials:'omit',cache:'no-store'});if(token()===current){try{localStorage.removeItem(sharedAdminSessionKey);}catch{/* Storage bloqueado. */}++generation.current;controller.current?.abort();setChecking(false);setAdmin(null);}}
  async function adminRequest<T>(path:string,options:{method?:string;body?:unknown}={}){
    const current=token();if(!current){setAdmin(null);throw new Error('Ingresa como admin para editar precios.');}
    try{return await request<T>(path,current,options);}catch(error){if(error instanceof StoreAdminError&&[401,403].includes(error.status))await check();throw error;}
  }
  return {admin,checking,login,logout,request:adminRequest};
}
type Access=ReturnType<typeof useStoreAdmin>;
export function StoreAdminAccess({access}:{access:Access}){
  const [opened,setOpened]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),sending=useRef(false);
  useEffect(()=>{if(!opened){dialog.current?.close();return;}dialog.current?.showModal();const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before;};},[opened]);
  const close=()=>{if(busy)return;setOpened(false);setPassword('');setError('');};
  async function submit(event:React.FormEvent){event.preventDefault();if(sending.current)return;sending.current=true;setBusy(true);setError('');try{await access.login(email,password);setPassword('');setOpened(false);}catch(error){setError(error instanceof Error?error.message:'No se pudo ingresar.');}finally{sending.current=false;setBusy(false);}}
  async function logout(){setBusy(true);setError('');try{await access.logout();setOpened(false);}catch{setError('No se pudo confirmar el cierre de sesion. Reintenta.');}finally{setBusy(false);}}
  return <><button type="button" className={`shop-icon-button shop-admin-access ${access.admin?'active':''}`} disabled={access.checking} title={access.admin?`Admin: ${access.admin.displayName}`:'Acceso admin'} aria-label={access.admin?`Cuenta admin: ${access.admin.displayName}`:'Acceso admin'} onClick={()=>setOpened(true)}>{access.admin?<ShieldCheck/>:<ShieldUser/>}</button>
    <dialog ref={dialog} className="shop-admin-dialog" aria-label="Acceso de administracion" onCancel={event=>{if(busy)event.preventDefault();else close();}} onClose={()=>setOpened(false)}><div className="shop-modal-heading"><h2>{access.admin?'Administrador':'Acceso admin'}</h2><button type="button" className="shop-icon-button" disabled={busy} title="Cerrar acceso admin" aria-label="Cerrar acceso admin" onClick={close}><X/></button></div>
      {access.admin?<div className="shop-admin-account"><strong>{access.admin.displayName}</strong><a className="shop-reset" href="/admin">Abrir panel</a><button type="button" className="shop-reset" disabled={busy} onClick={()=>void logout()}><LogOut/>Cerrar sesion</button></div>:<form className="shop-admin-form" onSubmit={event=>void submit(event)}><fieldset disabled={busy}><label>Email admin<input type="email" required maxLength={254} autoComplete="username" autoFocus value={email} onChange={event=>setEmail(event.target.value)}/></label><label>Contrasena<input type="password" required maxLength={128} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></label></fieldset><button type="submit" className="shop-primary-action" disabled={busy}><LogIn/>{busy?'Ingresando...':'Ingresar'}</button></form>}
      {error?<p className="shop-admin-problem" role="alert">{error}</p>:null}
    </dialog></>;
}
export function StoreEditPriceButton({item,disabled,onClick}:{item:StoreCatalogItem;disabled?:boolean;onClick:()=>void}){return <button type="button" className="shop-icon-button shop-edit-price" disabled={disabled} title="Editar precio de venta" aria-label={`Editar precio de ${item.name}`} onClick={onClick}><Pencil/></button>;}
export function StorePriceEditor({item,access,onClose,onSaved}:{item:StoreCatalogItem;access:Access;onClose:()=>void;onSaved:(price:StoreAdminPrice)=>void}){
  const dialog=useRef<HTMLDialogElement>(null),sending=useRef(false),priceInput=useRef<HTMLInputElement>(null);
  const [current,setCurrent]=useState(item.priceArs),[draft,setDraft]=useState(String(item.priceArs)),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
  const target=storePricePreview(draft);
  async function reload(){setLoading(true);setError('');try{const result=await access.request<{price:StoreAdminPrice}>(`items/${encodeURIComponent(item.id)}/price`);setCurrent(result.price.priceArs);setDraft(String(result.price.priceArs));setUncertain(false);}catch(error){setError(error instanceof Error?error.message:'No se pudo leer el precio.');}finally{setLoading(false);}}
  useEffect(()=>{dialog.current?.showModal();const before=document.body.style.overflow;document.body.style.overflow='hidden';void reload();return()=>{dialog.current?.close();document.body.style.overflow=before;};},[]);
  useEffect(()=>{if(!loading){priceInput.current?.focus();priceInput.current?.select();}},[loading]);
  async function save(event:React.FormEvent){event.preventDefault();if(sending.current||target===null)return;sending.current=true;setBusy(true);setError('');try{const result=await access.request<{price:StoreAdminPrice}>(`items/${encodeURIComponent(item.id)}/price`,{method:'PUT',body:{priceArs:target,expectedPriceArs:current}});try{notifyStorePriceChange(localStorage);}catch{/* Guardado confirmado; sin aviso entre pestanas. */}onSaved(result.price);onClose();}catch(error){setError(error instanceof Error?error.message:'Respuesta sin confirmar.');setUncertain(!(error instanceof StoreAdminError&&[400,401,403,404,409].includes(error.status)));}finally{sending.current=false;setBusy(false);}}
  return <dialog ref={dialog} className="shop-admin-dialog" aria-label="Editar precio de venta" onCancel={event=>{if(busy)event.preventDefault();else onClose();}} onClose={()=>{if(!busy)onClose();}}><div className="shop-modal-heading"><h2>Precio de venta</h2><button type="button" className="shop-icon-button" disabled={busy} aria-label="Cerrar editor de precio" title="Cerrar editor de precio" onClick={onClose}><X/></button></div><h3 className="shop-price-item-name">{item.name}</h3>
    <form className="shop-admin-form" onSubmit={event=>void save(event)}><label>Precio ARS<input ref={priceInput} type="number" inputMode="decimal" min={800} max={9999999900} step="0.01" disabled={busy||loading||uncertain} autoFocus value={draft} onFocus={event=>event.currentTarget.select()} onChange={event=>setDraft(event.target.value)}/></label><div className="shop-price-preview"><span>Precio final</span><output>{target!==null?money.format(target):'-'}</output></div><div className="shop-price-editor-actions"><button type="button" className="shop-reset" disabled={busy||loading} onClick={()=>void reload()}><RotateCcw/>Recargar precio</button><button type="submit" className="shop-primary-action" disabled={busy||loading||target===null||!uncertain&&target===current}><Save/>{busy?'Guardando...':uncertain?'Reintentar precio':'Guardar precio'}</button></div></form>
    {error?<p className="shop-admin-problem" role="alert">{error}</p>:null}
  </dialog>;
}
