import React, { useEffect, useRef, useState } from "react";
import { ShoppingCart, X, Plus, Minus, Trash2, Check, RotateCcw } from "lucide-react";
import { defaultStoreSettings, type StoreCatalogItem, type StoreCatalogPage, type StoreSettings, type StoreOrderInput, type StoreOrderReceipt } from "@ultimoturno/domain";
import { readStoreCart, writeStoreCart, storeCartTotal, readPendingStoreOrder, pendingStoreOrderKey, type StoreCartLine } from "./store-cart-state.js";
const money=new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:2,minimumFractionDigits:0});
export function useStoreCart() {
  const [lines,setLines]=useState<StoreCartLine[]>(()=>{try{return readStoreCart(localStorage);}catch{return [];}});
  const [opened,setOpened]=useState(false),[notice,setNotice]=useState("");
  const [feedback,setFeedback]=useState<{id:string;version:number}|null>(null);
  const [pending,setPending]=useState<StoreOrderInput|null>(()=>{try{return readPendingStoreOrder(sessionStorage);}catch{return null;}});
  const [settings,setSettings]=useState<StoreSettings>({...defaultStoreSettings});
  useEffect(()=>{try{writeStoreCart(localStorage,lines);}catch{/* Sin storage. */}},[lines]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{if(!feedback)return;const timer=setTimeout(()=>setFeedback(null),1000);return()=>clearTimeout(timer);},[feedback]);
  useEffect(()=>{const controller=new AbortController();fetch('/api/store/settings',{credentials:'omit',cache:'no-store',signal:controller.signal}).then(response=>{if(!response.ok)throw new Error();return response.json();}).then(setSettings).catch(()=>undefined);return()=>controller.abort();},[]);
  function add(item:StoreCatalogItem){
    if(pending){setFeedback(null);setNotice("Hay un pedido sin confirmar. Abri el carrito para recuperar el mismo envio.");setOpened(true);return;}
    const current=lines.find(line=>line.item.id===item.id);
    if(current && current.quantity>=Math.min(99,item.availableQuantity)){setFeedback(null);setNotice("Alcanzaste las unidades disponibles o el limite por articulo.");return;}
    if(!current && lines.length>=30){setFeedback(null);setNotice("El carrito admite hasta 30 articulos distintos.");return;}
    setLines(values=>current?values.map(line=>line.item.id===item.id?{item,quantity:line.quantity+1}:line):[...values,{item,quantity:1}]);
    setFeedback(previous=>({id:item.id,version:(previous?.version||0)+1}));
    setNotice(`${item.name} agregado al carrito.`);
  }
  return {lines,setLines,opened,setOpened,notice,setNotice,settings,add,pending,setPending,feedback,count:lines.reduce((sum,line)=>sum+line.quantity,0)};
}
type Cart=ReturnType<typeof useStoreCart>;
export function StoreCartButton({cart}:{cart:Cart}){return <button type="button" className="shop-cart-button" data-has-items={cart.count>0} onClick={()=>cart.setOpened(true)} aria-label={`Carrito, ${cart.count} articulos`}><ShoppingCart aria-hidden="true"/><span>Carrito</span><b key={cart.count}>{cart.count}</b></button>;}
export function StoreCartDialog({cart}:{cart:Cart}){
  const dialog=useRef<HTMLDialogElement>(null),submitting=useRef(false);
  const [stage,setStage]=useState<'cart'|'checkout'>(cart.pending?'checkout':'cart'),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
  const {pending,setPending}=cart;
  const [receipt,setReceipt]=useState<StoreOrderReceipt|null>(null);
  const [buyer,setBuyer]=useState(cart.pending?{customerName:cart.pending.customerName,email:cart.pending.email,phone:cart.pending.phone,fulfillment:cart.pending.fulfillment,address:cart.pending.address}:{customerName:'',email:'',phone:'',fulfillment:'pickup' as 'pickup'|'shipping',address:''});
  useEffect(()=>{if(cart.opened){dialog.current?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};}dialog.current?.close();},[cart.opened]);
  async function refresh(){
    if(!cart.lines.length)return;
    setRefreshing(true);setError('');
    try{
      const response=await fetch(`/api/store/catalog?ids=${cart.lines.map(line=>line.item.id).join(',')}`,{credentials:'omit',cache:'no-store'});
      if(!response.ok)throw new Error('No se pudo actualizar el carrito.');
      const data:StoreCatalogPage=await response.json();
      cart.setLines(lines=>lines.map(line=>{const item=data.items.find(item=>item.id===line.item.id);return{...line,item:item||{...line.item,availableQuantity:0}};}));
    }catch(error){setError(error instanceof Error?error.message:'No se pudo actualizar el carrito.');}finally{setRefreshing(false);}
  }
  useEffect(()=>{if(cart.opened&&!pending&&!receipt)void refresh();},[cart.opened]);
  function close(){if(busy||refreshing)return;cart.setOpened(false);}
  const invalid=cart.lines.some(line=>line.quantity>line.item.availableQuantity);
  const locked=busy||refreshing||Boolean(pending);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(submitting.current)return;
    submitting.current=true;setBusy(true);setError('');
    const request:StoreOrderInput=pending||{...buyer,fulfillment:cart.settings.pickup?buyer.fulfillment:'shipping',idempotencyKey:crypto.randomUUID(),lines:cart.lines.map(line=>({inventoryItemId:line.item.id,quantity:line.quantity,expectedPriceArs:line.item.priceArs}))};
    let sent=false;
    try{
      try { sessionStorage.setItem(pendingStoreOrderKey,JSON.stringify(request)); } catch { throw new Error('Habilita el almacenamiento de esta pestana para confirmar el pedido sin duplicados.'); }
      setPending(request);sent=true;
      const response=await fetch('/api/store/orders',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',body:JSON.stringify(request)});
      const data=await response.json();
      if(!response.ok){if(([400,409,413,415,429].includes(response.status)&&!String(data.error).includes("Este intento pertenece"))||(response.status===503&&String(data.error).includes("pedidos web estan pausados"))){setPending(null);sessionStorage.removeItem(pendingStoreOrderKey);}throw new Error(data.error||'No se pudo confirmar el pedido. Reintenta el mismo envio.');}
      if(!data.receipt?.reference)throw new Error('Respuesta no confirmada. Reintenta el mismo envio.');
      setReceipt(data.receipt);setPending(null);sessionStorage.removeItem(pendingStoreOrderKey);cart.setLines([]);try{writeStoreCart(localStorage,[]);}catch{/* Sin storage. */}setBuyer({customerName:'',email:'',phone:'',fulfillment:'pickup',address:''});
    }catch(error){if(!sent)setPending(null);setError(error instanceof Error?error.message:'Respuesta no confirmada. Reintenta el mismo envio.');}finally{setBusy(false);submitting.current=false;}
  }
  return <dialog ref={dialog} className="shop-cart-dialog" aria-label="Carrito y pedido" onCancel={event=>{if(busy||refreshing)event.preventDefault();else close();}} onClose={()=>cart.setOpened(false)}>
    <div className="shop-modal-heading"><h2>{receipt?'Pedido registrado':stage==='checkout'?'Confirmar pedido':'Carrito'}</h2><button type="button" className="shop-icon-button" disabled={busy||refreshing} title="Cerrar carrito" aria-label="Cerrar carrito" autoFocus onClick={close}><X/></button></div>
    {receipt?<section className="shop-order-receipt"><Check aria-hidden="true"/><h3>{receipt.reference}</h3><strong>{money.format(receipt.totalArs)}</strong><p>{receipt.status==='cancelled'?'Pedido cancelado o vencido.':receipt.status==='paid'||receipt.status==='delivered'?'Pago confirmado.':receipt.status==='payment_recorded'?'Pago registrado. Coordina el saldo restante con el equipo.':'Pago pendiente de confirmacion.'}</p>{['pending','packed'].includes(receipt.status)?<><p>Reserva hasta {new Date(receipt.expiresAt).toLocaleString('es-AR')}</p><h4>Pago</h4><p>{receipt.paymentInstructions}</p></>:null}<h4>Contacto y entrega</h4><p>{receipt.contactInstructions}</p><button type="button" className="shop-primary-action" onClick={()=>{setReceipt(null);setStage('cart');close();}}>Seguir comprando</button></section>:<>
      {stage==='cart'?<>
        {!cart.lines.length?<p className="shop-cart-empty">Tu carrito esta vacio.</p>:<div className="shop-cart-lines">{cart.lines.map(line=><article className="shop-cart-line" key={line.item.id}>
          <div className="shop-cart-thumb">{line.item.imageUrl?<img src={line.item.imageUrl} alt={line.item.name} referrerPolicy="no-referrer"/>:null}</div>
          <div className="shop-cart-line-copy"><strong>{line.item.name}</strong><small>{line.item.language} / {line.item.condition} / {line.item.finish}</small><span>{money.format(line.item.priceArs)}</span>{line.quantity>line.item.availableQuantity?<small className="shop-cart-problem">{line.item.availableQuantity?`Quedan ${line.item.availableQuantity} unidades`:'No disponible'}</small>:null}</div>
          <div className="shop-cart-quantity"><button type="button" className="shop-icon-button" disabled={locked||line.quantity<=1} aria-label={`Restar ${line.item.name}`} title="Restar" onClick={()=>cart.setLines(lines=>lines.map(value=>value.item.id===line.item.id?{...value,quantity:value.quantity-1}:value))}><Minus/></button><output>{line.quantity}</output><button type="button" className="shop-icon-button" disabled={locked||line.quantity>=Math.min(99,line.item.availableQuantity)} aria-label={`Sumar ${line.item.name}`} title="Sumar" onClick={()=>cart.setLines(lines=>lines.map(value=>value.item.id===line.item.id?{...value,quantity:value.quantity+1}:value))}><Plus/></button><button type="button" className="shop-icon-button" disabled={locked} aria-label={`Quitar ${line.item.name}`} title="Quitar" onClick={()=>cart.setLines(lines=>lines.filter(value=>value.item.id!==line.item.id))}><Trash2/></button></div>
        </article>)}</div>}
        {cart.lines.length?<><div className="shop-cart-total"><span>Total de productos</span><strong>{money.format(storeCartTotal(cart.lines))}</strong></div><button type="button" className="shop-reset" disabled={locked} onClick={()=>void refresh()}><RotateCcw/>Actualizar carrito</button><button type="button" className="shop-primary-action" disabled={locked||invalid||!cart.settings.enabled} onClick={()=>{setStage('checkout');setError('');}}>Continuar pedido</button>{!cart.settings.enabled?<p>Los pedidos web estan pausados.</p>:null}</>:null}
      </>:<form className="shop-checkout-form" onSubmit={event=>void submit(event)}>
        <fieldset disabled={locked}><label>Nombre y apellido<input required maxLength={100} autoComplete="name" value={buyer.customerName} onChange={event=>setBuyer({...buyer,customerName:event.target.value})}/></label><label>Email<input type="email" required maxLength={254} autoComplete="email" value={buyer.email} onChange={event=>setBuyer({...buyer,email:event.target.value})}/></label><label>Telefono / WhatsApp<input type="tel" required minLength={7} maxLength={40} autoComplete="tel" value={buyer.phone} onChange={event=>setBuyer({...buyer,phone:event.target.value})}/></label><label>Entrega<select aria-label="Entrega" value={cart.settings.pickup?buyer.fulfillment:'shipping'} onChange={event=>setBuyer({...buyer,fulfillment:event.target.value as 'pickup'|'shipping'})}>{cart.settings.pickup?<option value="pickup">Retiro a coordinar</option>:null}{cart.settings.shipping?<option value="shipping">Envio a coordinar</option>:null}</select></label>{buyer.fulfillment==='shipping'||!cart.settings.pickup?<label>Direccion, localidad y codigo postal<input required maxLength={300} autoComplete="street-address" value={buyer.address} onChange={event=>setBuyer({...buyer,address:event.target.value})}/></label>:null}</fieldset>
        <div className="shop-cart-total"><span>Productos</span><strong>{money.format(storeCartTotal(cart.lines))}</strong></div>
        <p>Pago manual. Reserva por {cart.settings.reservationMinutes} minutos.{buyer.fulfillment==='shipping'||!cart.settings.pickup?' El envio se cotiza por separado; no esta incluido en este total.':''}</p><p className="shop-checkout-instructions">{cart.settings.contactInstructions}</p>
        {pending&&!busy?<p role="status">Pedido sin confirmar. Reintenta el mismo envio.</p>:null}
        <div className="shop-checkout-actions"><button type="button" className="shop-reset" disabled={locked} onClick={()=>setStage('cart')}>Volver al carrito</button><button type="submit" className="shop-primary-action" disabled={busy||refreshing||!pending&&(invalid||!cart.lines.length)}>{busy?'Confirmando...':pending?'Reintentar mismo pedido':'Confirmar pedido'}</button></div>
      </form>}
      {error?<p className="shop-cart-problem" role="alert">{error}</p>:null}
    </>}
  </dialog>;
}
