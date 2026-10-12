import React, { useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import type { StoreCatalogItem } from "@ultimoturno/domain";
import { groupStoreSearchResults, storeConditionLabel } from "./store-search-results.js";
import { storeLanguageLabel, storeTypeLabels } from "./storefront-filters.js";
import { StoreImage } from "./store-image.js";
import { StoreEditPriceButton } from "./store-admin.js";
import { remainingStoreCartQuantity } from "./store-cart-state.js";
import type { useStoreCart } from "./store-cart.js";

const money=new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0,maximumFractionDigits:2});
type Props = {items:StoreCatalogItem[];loading:boolean;initialLoading:boolean;cart:ReturnType<typeof useStoreCart>;editable:boolean;editingDisabled:boolean;onDetail:(item:StoreCatalogItem)=>void;onEditPrice:(item:StoreCatalogItem)=>void};
function StoreOfferRow({item,loading,cart,editable,editingDisabled,onDetail,onEditPrice}:Omit<Props,"items"|"initialLoading">&{item:StoreCatalogItem}) {
  const [draft,setDraft]=useState("1");
  const remaining=remainingStoreCartQuantity(cart.lines,item),quantity=Number(draft);
  const valid=Number.isInteger(quantity)&&quantity>=1&&quantity<=remaining;
  const inCart=cart.lines.find(line=>line.item.id===item.id)?.quantity||0,added=cart.feedback?.id===item.id;
  return <div className="shop-offer-row" data-item-id={item.id}>
    <div className="shop-offer-stock"><button type="button" className="shop-offer-condition" disabled={loading} onClick={()=>onDetail(item)} title="Ver detalle de esta variante">{item.availableQuantity} {storeConditionLabel(item.condition)}</button><small>{inCart?`${inCart} en carrito`:"Disponible"}</small></div>
    <div className="shop-offer-price"><strong>{money.format(item.priceArs)}</strong>{editable?<StoreEditPriceButton item={item} disabled={loading||editingDisabled} onClick={()=>onEditPrice(item)}/>:null}</div>
    <form className="shop-offer-buy" onSubmit={event=>{event.preventDefault();if(!loading&&!cart.pending&&valid&&cart.add(item,quantity))setDraft("1");}}>
      <label><span className="shop-sr-only">Cantidad de {item.name}, {item.language}, {item.condition}</span><input type="number" inputMode="numeric" min={1} max={remaining||1} step={1} required disabled={loading||!!cart.pending||!remaining} value={draft} aria-invalid={!valid&&remaining>0} onFocus={event=>event.currentTarget.select()} onChange={event=>setDraft(event.target.value)}/></label>
      <button type="submit" className="shop-primary-action shop-add-cart" data-added={added} disabled={loading||!!cart.pending||!valid} title={added?"Agregado al carrito":"Agregar al carrito"} aria-label={`Agregar ${item.name} al carrito`}>{added?<Check key={cart.feedback?.version} aria-hidden="true"/>:<ShoppingCart aria-hidden="true"/>}<span>{added?"Agregado":"Agregar"}</span></button>
    </form>
  </div>;
}
export function StoreSearchList(props:Props) {
  const groups=groupStoreSearchResults(props.items);
  return <section className="shop-search-list" aria-label="Articulos" aria-busy={props.loading}>
    {props.initialLoading?Array.from({length:3},(_,n)=><div className="shop-search-skeleton shop-skeleton" aria-hidden="true" key={n}><span/><span/><span/></div>):null}
    {groups.map((group,index)=>{const item=group.item;return <article className="shop-search-result" key={group.key} style={{"--shop-entry-delay":`${(index%6)*20}ms`} as React.CSSProperties}>
      <button type="button" className="shop-product-preview shop-search-image" disabled={props.loading} aria-label={`Ver ${item.name}`} onClick={()=>props.onDetail(item)}><div className="shop-product-image"><StoreImage item={item}/></div></button>
      <div className="shop-search-copy"><h3><button type="button" disabled={props.loading} onClick={()=>props.onDetail(item)}>{item.name}{item.number?<span> - {item.number}</span>:null}</button></h3><p>{item.expansion}</p><div className="shop-search-meta"><span>{storeLanguageLabel(item.language)}</span>{item.finish&&item.finish!=="normal"?<span>{item.finish}</span>:null}{item.gradingCompany||item.grade?<span>{[item.gradingCompany,item.grade].filter(Boolean).join(" ")}</span>:null}<span>{item.itemKind==="folder"?"Carpeta":storeTypeLabels[item.cardType]||item.cardType}</span></div></div>
      <div className="shop-search-offers">{group.offers.map(offer=><StoreOfferRow {...props} item={offer} key={offer.id}/>)}</div>
    </article>;})}
  </section>;
}
