import { bookSchema, normalize, collectBookLinks, extractBook } from "../src/index.js";
import { test } from "node:test";
import assert from "node:assert";

test("price normalization: £51.77 becomes 51.77", () => {
  const r = normalize({
    title: "x", product_url: "https://b/cat/x/index.html", price_text: "£51.77",
    availability_text: "In stock", rating_text: "Three", description: null,
    source_page: "https://b/c/page-1.html", fetched_at: "2026-01-01T00:00:00Z",
  });
  assert.strictEqual(r.price_gbp, 51.77);
  assert.strictEqual(r.rating, 3);
});

test("schema rejects invalid record", () => {
  const r = normalize({
    title: "x", product_url: "https://b/cat/x/index.html", price_text: "£10",
    availability_text: null, rating_text: null, description: null,
    source_page: "https://b/c/page-1.html", fetched_at: "2026-01-01T00:00:00Z",
  });
  const bad = { ...r, title: 42 };
  assert.throws(() => bookSchema.parse(bad));
});

test("relative -> absolute URL", () => {
  const page = "https://books.toscrape.com/catalogue/page-1.html";
  const html = `<article class="product_pod"><h3><a href="a-light-in-the-attic_1000/index.html">A</a></h3></article>`;
  const links = collectBookLinks(html, page);
  assert.strictEqual(links[0], "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html");
});

test("duplicate URLs collapse via Set", () => {
  const page = "https://books.toscrape.com/catalogue/page-1.html";
  const html = `<article class="product_pod"><h3><a href="x/index.html">X</a></h3></article>
                <article class="product_pod"><h3><a href="x/index.html">X</a></h3></article>`;
  assert.strictEqual(collectBookLinks(html, page).length, 1);
});

test("missing description stays null", () => {
  const html = `<div class="product_main"><h1>Book</h1></div>`;
  const raw = extractBook(html, "https://b/x", "https://b/p");
  assert.strictEqual(raw.description, null);
});