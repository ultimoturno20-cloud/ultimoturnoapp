import React, { useEffect, useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import type { StoreSettings } from "@ultimoturno/domain";
import "./store-settings.css";
export function StoreSettingsPanel({request}:{request:<T>(path:string,options?:{method?:string;body?:unknown})=>Promise<T>}) {
  const [settings,setSettings]=useState<StoreSettings|null>(null),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
  async function load(){setBusy(true);setFeedback('');try{setSettings(await request<StoreSettings>('/store-settings'));}catch(error){setFeedback(error instanceof Error?error.message:'No se pudo cargar la tienda.');}finally{setBusy(false);}}
  useEffect(()=>{void load();},[]);
  async function save(event:React.FormEvent){
    event.preventDefault();if(!settings||busy)return;
    if(settings.enabled&&!window.confirm('Se habilitaran pedidos reales con estas instrucciones de pago, entrega y plazo de reserva. Confirmar apertura de la tienda?'))return;
    setBusy(true);setFeedback('');
    try{setSettings(await request<StoreSettings>('/store-settings',{method:'PUT',body:settings}));setFeedback('Configuracion de tienda guardada.');}catch(error){setFeedback(error instanceof Error?error.message:'No se pudo guardar. Recarga para comprobar el estado.');}finally{setBusy(false);}
  }
  return <section className="panel store-settings-panel"><div className="section-heading"><h3>Tienda y pedidos web</h3><button type="button" className="secondary-action" disabled={busy} onClick={()=>void load()}><RotateCcw/>Recargar</button></div>
    {settings?<form onSubmit={event=>void save(event)}><fieldset disabled={busy}>
      <label className="store-settings-check"><input type="checkbox" checked={settings.enabled} onChange={event=>setSettings({...settings,enabled:event.target.checked})}/>Aceptar pedidos web</label>
      <label>Reserva sin pago<select value={settings.reservationMinutes} onChange={event=>setSettings({...settings,reservationMinutes:Number(event.target.value)})}>{[30,120,1440,...(![30,120,1440].includes(settings.reservationMinutes)?[settings.reservationMinutes]:[])].map(minutes=><option key={minutes} value={minutes}>{minutes===30?'30 minutos':minutes===120?'2 horas':minutes===1440?'24 horas':`${minutes} minutos`}</option>)}</select></label>
      <div className="store-settings-delivery"><label className="store-settings-check"><input type="checkbox" checked={settings.pickup} onChange={event=>setSettings({...settings,pickup:event.target.checked})}/>Retiro a coordinar</label><label className="store-settings-check"><input type="checkbox" checked={settings.shipping} onChange={event=>setSettings({...settings,shipping:event.target.checked})}/>Envio a coordinar, cotizado aparte</label></div>
      <label>Instrucciones de pago publicas<textarea required={settings.enabled} maxLength={2000} rows={3} value={settings.paymentInstructions} onChange={event=>setSettings({...settings,paymentInstructions:event.target.value})}/></label>
      <label>Contacto y condiciones de entrega publicas<textarea required={settings.enabled} maxLength={2000} rows={3} value={settings.contactInstructions} onChange={event=>setSettings({...settings,contactInstructions:event.target.value})}/></label>
      <button type="submit" className="primary-action"><Save/>{busy?'Guardando...':'Guardar tienda'}</button>
    </fieldset></form>:null}{feedback?<p role="status">{feedback}</p>:null}
  </section>;
}
