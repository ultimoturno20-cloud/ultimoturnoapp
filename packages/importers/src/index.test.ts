import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildImportQualityWarnings,
  buildLegacyConciliationReport,
  expandDemoSearchTerms,
  parseDemoMonPriceCsv,
  parsePriceChartingCsv,
  rankImportCandidates,
  translateDemoCardName
} from "./index.js";

describe("demo importers", () => {
  it("parses fictional MonPrice CSV rows and flags review rows", () => {
    const result = parseDemoMonPriceCsv("Name;Set;Number;Count;Language\nPikachu Demo;Sample Sparks;025;2;EN\nIncomplete;;;0;EN");
    assert.equal(result.rows.length, 2);
    assert.equal(result.reviewRows.length, 1);
  });

  it("translates demo Japanese and Chinese names before matching", () => {
    assert.equal(translateDemoCardName("\u30d4\u30ab\u30c1\u30e5\u30a6"), "Pikachu");
    assert.deepEqual(expandDemoSearchTerms("\u70c8\u7a7a\u5750"), ["\u70c8\u7a7a\u5750", "Rayquaza"]);
  });

  it("builds quality warnings for risky import rows", () => {
    const warnings = buildImportQualityWarnings({ name: "Pikachu", quantity: 0, priceArs: 0 });
    assert.ok(warnings.includes("Falta expansion"));
    assert.ok(warnings.includes("Cantidad invalida"));
    assert.ok(warnings.includes("Precio no informado"));
  });

  it("ranks multiple possible candidates consistently", () => {
    const matches = rankImportCandidates(
      { id: "row", name: "\u70c8\u7a7a\u5750", expansion: "Cielos Antiguos", number: "384", language: "JA", condition: "NM" },
      [
        { id: "wrong", name: "Rayquaza Gold", expansion: "Otra", number: "384", language: "EN", condition: "LP" },
        { id: "right", name: "Rayquaza Gold", expansion: "Cielos Antiguos", number: "384", language: "JA", condition: "NM" }
      ],
      0
    );
    assert.equal(matches[0].id, "right");
    assert.ok(matches[0].confidence > matches[1].confidence);
  });

  it("builds a fictional legacy conciliation report", () => {
    const issues = buildLegacyConciliationReport([{ sku: "DEMO", stockQuantity: 2, movementQuantity: 5, salesQuantity: 1 }]);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].expectedQuantity, 4);
  });

  it("parses the PriceCharting export including quoted commas and cent prices", () => {
    const csv = [
      "id,product-name,console-name,loose-price,url",
      '123,"Pikachu, Special #025",Pokemon Promo,499,https://www.pricecharting.com/game/pokemon-promo/pikachu-special-25',
      "124,Eevee #133,Pokemon Jungle,$3.50,"
    ].join("\n");
    const result = parsePriceChartingCsv(csv);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].productName, "Pikachu, Special");
    assert.equal(result.rows[0].cardNumber, "025");
    assert.equal(result.rows[0].loosePriceUsd, 4.99);
    assert.equal(result.rows[1].expansionName, "Jungle");
    assert.equal(result.rows[1].loosePriceUsd, 3.5);
  });
});
