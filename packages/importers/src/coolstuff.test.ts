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

const target = { priceChartingId: "test", name: "Lillie's Determination", expansion: "ME01: Mega Evolution", number: "184/132", condition: "NM", finish: "normal" };

test("matches the live ME Phantasmal Flames label without accepting other editions", () => {
  const products = parseCoolstuffProducts(fixture.replace("Mega Evolution", "ME Phantasmal Flames"));
  const card = { ...target, expansion: "Phantasmal Flames" };
  assert.equal(matchCoolstuffProduct(card, products).status, "matched");
  for (const patch of [{ expansion: "Phantasmal Flames Promos" }, { expansion: "Mega Evolution" }, { number: "185/132" }, { condition: "LP" }, { finish: "reverse holo" }]) {
    assert.equal(matchCoolstuffProduct({ ...card, ...patch }, products).status, "not_found");
  }
});

test("ignores CoolStuff era prefixes but keeps era promo sets apart", () => {
  for (const label of ["ME Ascended Heroes", "SV Prismatic Evolutions", "SM Unified Minds"]) {
    const products = parseCoolstuffProducts(fixture.replace("Mega Evolution", label));
    const expansion = label.replace(/^\w+ /, "");
    assert.equal(matchCoolstuffProduct({ ...target, expansion }, products).status, "matched");
  }
  const promos = parseCoolstuffProducts(fixture.replace("Mega Evolution", "SM Promos"));
  assert.equal(matchCoolstuffProduct({ ...target, expansion: "XY Promos" }, promos).status, "not_found");
});

test("treats an ampersand like 'and' in card names", () => {
  const products = parseCoolstuffProducts(fixture.replace("Lillie's Determination - 184/132", "Anthea and Concordia - 184/132"));
  assert.equal(matchCoolstuffProduct({ ...target, name: "Anthea & Concordia" }, products).status, "matched");
});

test("rejects a different card number or expansion even with an exact name", () => {
  const products = parseCoolstuffProducts(fixture);
  assert.equal(matchCoolstuffProduct(target, products).status, "matched");
  for (const patch of [{ number: "185/132" }, { number: "184/200" }, { expansion: "Mega Evolution Promos" }]) {
    assert.equal(matchCoolstuffProduct({ ...target, ...patch }, products).status, "not_found");
  }
});

test("never substitutes Near Mint or generic Played for a specific played condition", () => {
  const products = parseCoolstuffProducts(fixture);
  for (const condition of ["LP", "MP", "HP", "DMG", "GRADED"]) {
    assert.equal(matchCoolstuffProduct({ ...target, condition }, products).status, "not_found");
  }
  products[0].offers.push({ condition: "Played", quantity: 1, priceUsd: 20 });
  assert.equal(matchCoolstuffProduct({ ...target, condition: "LP" }, products).status, "not_found");
  products[0].offers.push({ condition: "Lightly Played", quantity: 1, priceUsd: 30 });
  assert.equal(matchCoolstuffProduct({ ...target, condition: "LP" }, products).offer?.priceUsd, 30);
});

test("pagination ignores other expansions and external links without truncating at 50", () => {
  const html = '<a href="/page/9126?page=51">51</a><a href="/page/999?page=80">80</a><a href="https://example.com/page/9126?page=90">90</a>';
  assert.equal(parseCoolstuffPageCount(html, "https://www.coolstuffinc.com/page/9126?page=1"), 51);
});

test("recognizes finishes before the card number, as in the live CoolStuff catalogue", () => {
  const holo = fixture.replace("Lillie's Determination - 184/132", "Lillie's Determination (Holo Rare) - 184/132");
  const normal = fixture.replace("Lillie's Determination - 184/132", "Lillie's Determination (Non-Holo) - 184/132");
  const products = parseCoolstuffProducts(holo + normal);
  assert.deepEqual(products.map((product) => product.finish), ["Holo Rare", "Non-Holo"]);
  assert.equal(matchCoolstuffProduct(target, products).product?.finish, "Non-Holo");
  assert.equal(matchCoolstuffProduct({ ...target, finish: "holo" }, products).product?.finish, "Holo Rare");
  assert.equal(matchCoolstuffProduct({ ...target, finish: "holo" }, products.slice(1)).status, "not_found");
});

test("does not identify a reverse card by number and expansion without a matching name", () => {
  const products = parseCoolstuffProducts(fixture.replace("Lillie's Determination - 184/132", "Unrelated Card - 184/132 (Reverse Foil)"));
  assert.equal(matchCoolstuffProduct({ ...target, finish: "reverse_holo" }, products).status, "not_found");
});
