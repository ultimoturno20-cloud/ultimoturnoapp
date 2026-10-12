import React, { useState } from "react";
import type { StoreCatalogItem } from "@ultimoturno/domain";

export function StoreImage({ item }: { item: StoreCatalogItem }) {
  const [image,setImage] = useState<{url: string; status: "loading" | "ready" | "failed"}>({url:item.imageUrl,status:"loading"});
  const status=image.url===item.imageUrl?image.status:"loading";
  return item.imageUrl && status!=="failed" ? <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={status==="ready"?"shop-image-loaded":"shop-image-loading"} onLoad={()=>setImage({url:item.imageUrl,status:"ready"})} onError={()=>setImage({url:item.imageUrl,status:"failed"})} /> : <span className="shop-image-missing">Sin imagen</span>;
}
