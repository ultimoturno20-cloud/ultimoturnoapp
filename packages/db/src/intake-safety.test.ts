import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createOperationalDatabase, getDefaultOperationalUser, addInventoryStock, upsertInventoryItem, applyInventorySnapshot, listStockForBusiness } from "./index.js";

test("intake adds atomically, costs are nullable, variants remain separate, imports replay and roll back", async () => {
  const db = await createOperationalDatabase({dataDir: await mkdtemp(path.join(tmpdir(), "ut-intake-test-"))});
  try {
    const user = await getDefaultOperationalUser(db);
    const input = {name: "Intake Alpha", expansion: "Test Set", number: "001", language: "EN", condition: "NM", finish: "normal", quantityOnHand: 2, priceArs: 100, purchaseCost: null};
    const first = await addInventoryStock(db,input,user);
    assert.equal(first.purchaseCost,null);
    const results = await Promise.all([addInventoryStock(db,input,user),addInventoryStock(db,input,user)]);
    assert.equal(results[1].quantityOnHand,6);
    assert.equal(results[0].id,first.id);
    const other=await addInventoryStock(db,{...input,condition:"LP",sku:first.sku,purchaseCost:0,purchaseCurrency:"USD"},user);
    assert.notEqual(other.id,first.id);
    assert.equal(other.purchaseCost,0);
    assert.equal(other.purchaseCurrency,"USD");
    const edited=await upsertInventoryItem(db,{...input,sku:first.sku,quantityOnHand:6,purchaseCost:1.25,purchaseCurrency:"USD"},user);
    assert.equal(edited.purchaseCost,1.25);
    const csv="sku,name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nCSV-SAFE,Unique Csv Card,Unique Expansion,987,EN,NM,normal,3,200";
    const calls=await Promise.all([applyInventorySnapshot(db,csv,user),applyInventorySnapshot(db,csv,user)]);
    assert.equal(calls[0].importRunId,calls[1].importRunId);
    assert.equal(calls[1].alreadyApplied,true);
    assert.equal((await applyInventorySnapshot(db,csv,user)).alreadyApplied,true);
    const stock=await listStockForBusiness(db,user.businessId);
    assert.equal(stock.items.find(i=>i.sku==="CSV-SAFE")?.quantityOnHand,3);
    // Fail at the second write, after the first row was already inserted.
    await db.exec("create function reject_test_card() returns trigger language plpgsql as $$ begin if NEW.name = 'Force Failure' then raise exception 'Injected failure'; end if; return NEW; end $$; create trigger reject_test before insert on card_products for each row execute function reject_test_card();");
    const bad="sku,name,expansion,number,language,condition,finish,quantityOnHand,priceArs\nROLLBACK-A,Rollback New,A Test Unique,761,EN,NM,normal,1,10\nROLLBACK-B,Force Failure,B Test Unique,762,EN,NM,normal,1,10";
    await assert.rejects(applyInventorySnapshot(db,bad,user),/Injected failure/);
    assert.equal((await listStockForBusiness(db,user.businessId)).items.some(i=>i.sku==="ROLLBACK-A"),false);
    await db.exec("drop trigger reject_test on card_products");
    const retry=await applyInventorySnapshot(db,bad,user);
    assert.equal(retry.applied,2);
    assert.equal((await applyInventorySnapshot(db,bad,user)).alreadyApplied,true);
  } finally { await db.close(); }
});

