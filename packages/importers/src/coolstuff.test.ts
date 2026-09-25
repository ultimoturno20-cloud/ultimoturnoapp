import assert from "node:assert/strict";
import test from "node:test";
import { findCoolstuffExpansionUrl, matchCoolstuffProduct, parseCoolstuffExpansionLinks, parseCoolstuffPageCount, parseCoolstuffProducts } from "./index.js";

const fixture = `
<div class="row product-search-row main-container" itemtype="https://schema.org/Product">
  <a href="/p/Pokemon/Lillies+Determination+-+184%2F132" class="productLink"><span itemprop="name">Lillie's Determination - 184/132</span></a>
  <div class="breadcrumb-trail">Pokemon &raquo; Mega Evolution</div>
  <div itemprop="offers" itemtype="https://schema.org/Offer">
    <div><span class="card-qty">4</span><meta itemprop="description" content="x" />Near Mint</div>
    <b itemprop="price" content="58.99">58.99</b>
  </div>
</div>`;

test("parses and matches CoolStuff structured product offers", () => {
  const products = parseCoolstuffProducts(fixture);
  assert.equal(products.length, 1);
  assert.equal(products[0].number, "184/132");
  assert.equal(products[0].offers[0].priceUsd, 58.99);
  const match = matchCoolstuffProduct({
    priceChartingId: "654523",
    name: "Lillie's Determination",
    expansion: "ME: Mega Evolution",
    number: "184/132",
    condition: "NM",
    finish: "normal"
  }, products);
  assert.equal(match.status, "matched");
  assert.equal(match.offer?.priceUsd, 58.99);
});

test("does not confuse reverse foil with a normal target", () => {
  const products = parseCoolstuffProducts(fixture.replace(">Lillie's Determination - 184/132<", ">Lillie's Determination - 184/132 (Reverse Foil)<"));
  const match = matchCoolstuffProduct({
    priceChartingId: "654523",
    name: "Lillie's Determination",
    expansion: "Mega Evolution",
    number: "184/132",
    condition: "NM",
    finish: "normal"
  }, products);
  assert.equal(match.status, "not_found");
});

test("discovers the exact expansion page and pagination", () => {
  const html = `
    <a href="/page/219">Pokemon</a>
    <div class="set-list">
      <a href="/page/9126">Mega Evolution</a>
      <a href="/page/9796">Mega Evolution Promos</a>
      <a href="/page/9001">Black Bolt and White Flare</a>
      <a href="/page/361">Black &amp; White</a>
    </div>
    <a href="/page/9126?resultsperpage=25&sh=1&page=2">2</a>
    <a href="/page/9126?resultsperpage=25&sh=1&page=11">11</a>
  `;
  const links = parseCoolstuffExpansionLinks(html);
  assert.equal(findCoolstuffExpansionUrl("ME: Mega Evolution", links), "https://www.coolstuffinc.com/page/9126");
  assert.equal(findCoolstuffExpansionUrl("White Flare", links), "https://www.coolstuffinc.com/page/9001");
  assert.equal(findCoolstuffExpansionUrl("Black Bolt", links), "https://www.coolstuffinc.com/page/9001");
  assert.equal(parseCoolstuffPageCount(html, "https://www.coolstuffinc.com/page/9126?sh=1"), 11);
});
