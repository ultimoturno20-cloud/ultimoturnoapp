import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  addInventoryStock,
  cancelReservationSale,
  changeOrderBoard,
  completeReservationSale,
  createOperationalDatabase,
  createSale,
  getDefaultOperationalUser,
  getOrderBoards,
  listSales,
  listStockForBusiness,
  markSaleDelivered,
  markSalePacked,
  updateSaleItemPacked
} from "./index.js";

test("order boards apply operational rules and preserve custom manual columns", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "ut-boards-test-"));
  let db = await createOperationalDatabase({ dataDir });
  try {
    const user = await getDefaultOperationalUser(db);
    const work = await Promise.all([getOrderBoards(db, user.businessId), getOrderBoards(db, user.businessId)]);
    assert.equal(work[0].boards[0].id, work[1].boards[0].id);
    assert.ok(work[0].boards.some((board) => board.name === "Completas"));
    assert.ok(work[0].columns.some((column) => column.name === "A entregar"));

    const columnId = (boardName: string, name: string, workspace = work[0]) => {
      const board = workspace.boards.find((item) => item.name === boardName);
      assert.ok(board, `missing board ${boardName}`);
      const column = workspace.columns.find((item) => item.boardId === board.id && item.name === name);
      assert.ok(column, `missing column ${boardName}/${name}`);
      return column.id;
    };

    const item = await addInventoryStock(db, {
      name: "Board Test",
      expansion: "Test",
      language: "EN",
      condition: "NM",
      finish: "normal",
      quantityOnHand: 10,
      priceArs: 100
    }, user);
    const sale = await createSale(db, {
      customerName: "Cliente tablero",
      saleType: "reservation",
      channel: "mostrador",
      lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 100 }]
    }, user);
    const before = await listStockForBusiness(db, user.businessId);

    let workspace = await getOrderBoards(db, user.businessId);
    assert.equal(workspace.cards.find((card) => card.saleId === sale.id)?.columnId, columnId("Embalaje", "Pendientes de embalar", workspace));

    workspace = await changeOrderBoard(db, { action: "createBoard", name: "Envios" }, user);
    const board = workspace.boards.find((item) => item.name === "Envios")!;
    workspace = await changeOrderBoard(db, { action: "createColumn", boardId: board.id, name: "Correo" }, user);
    const customColumn = workspace.columns.find((item) => item.name === "Correo")!;
    workspace = await changeOrderBoard(db, { action: "move", saleId: sale.id, columnId: customColumn.id }, user);
    assert.equal(workspace.cards.find((card) => card.saleId === sale.id)?.columnId, customColumn.id);
    assert.deepEqual(await listStockForBusiness(db, user.businessId), before);
    assert.equal((await listSales(db, user.businessId)).sales.find((item) => item.id === sale.id)?.status, "pending");

    await changeOrderBoard(db, { action: "renameColumn", columnId: customColumn.id, name: "En correo" }, user);
    await assert.rejects(changeOrderBoard(db, { action: "createBoard", name: " " }, user));
    await assert.rejects(changeOrderBoard(db, { action: "move", saleId: sale.id, columnId: customColumn.id }, { ...user, businessId: "00000000-0000-0000-0000-000000000099" }));

    const sale2 = await createSale(db, {
      customerName: "Segundo",
      saleType: "reservation",
      channel: "mostrador",
      lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 100 }]
    }, user);
    await changeOrderBoard(db, { action: "move", saleId: sale2.id, columnId: customColumn.id, beforeSaleId: sale.id }, user);
    workspace = await getOrderBoards(db, user.businessId);
    assert.deepEqual(workspace.cards.filter((card) => card.columnId === customColumn.id).map((card) => card.saleId), [sale2.id, sale.id]);

    const packed = await markSalePacked(db, sale.id, user);
    assert.equal(packed.status, "packed");
    workspace = await getOrderBoards(db, user.businessId);
    assert.equal(workspace.cards.find((card) => card.saleId === sale.id)?.columnId, columnId("Embalaje", "Embaladas", workspace));

    await completeReservationSale(db, sale.id, user);
    workspace = await getOrderBoards(db, user.businessId);
    assert.equal(workspace.cards.find((card) => card.saleId === sale.id)?.columnId, columnId("Embalaje", "A entregar", workspace));

    const unpacked = await updateSaleItemPacked(db, packed.lines[0].saleItemId, false, user);
    assert.equal(unpacked.status, "paid");
    workspace = await getOrderBoards(db, user.businessId);
    assert.equal(workspace.cards.find((card) => card.saleId === sale.id)?.columnId, columnId("Embalaje", "Pagadas", workspace));

    await markSalePacked(db, sale.id, user);
    await markSaleDelivered(db, sale.id, user);
    workspace = await getOrderBoards(db, user.businessId);
    assert.equal(workspace.cards.find((card) => card.saleId === sale.id)?.columnId, columnId("Completas", "Entregadas", workspace));

    const sale3 = await createSale(db, {
      customerName: "Cancelado",
      saleType: "reservation",
      channel: "mostrador",
      lines: [{ inventoryItemId: item.id, quantity: 1, unitPriceArs: 100 }]
    }, user);
    await cancelReservationSale(db, sale3.id, user);
    workspace = await getOrderBoards(db, user.businessId);
    assert.equal(workspace.cards.find((card) => card.saleId === sale3.id)?.columnId, columnId("Completas", "Canceladas", workspace));

    await db.close();
    db = await createOperationalDatabase({ dataDir });
    const reopened = await getOrderBoards(db, user.businessId);
    assert.equal(reopened.columns.find((column) => column.id === customColumn.id)?.name, "En correo");
    assert.equal(reopened.cards.find((card) => card.saleId === sale.id)?.columnId, columnId("Completas", "Entregadas", reopened));
  } finally {
    await db.close();
  }
});
