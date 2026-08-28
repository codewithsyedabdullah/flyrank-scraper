import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, "cache");
const OUTPUT_DIR = path.join(ROOT, "output");

const BASE_URL = "https://books.toscrape.com";
const START_URL = "/catalogue/page-1.html";
const USER_AGENT = `FlyRankInternshipA9/1.0 (https://github.com/codewithsyedabdullah/flyrank-scraper)`;
const TIMEOUT_MS = 10000;
const MIN_DELAY_MS = 600;

fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const client = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT_MS,
  headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  transformResponse: (r) => r,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cacheFile(rawUrl) {
  const clean = rawUrl.replace(/^\//, "").replace(/[\/?#]/g, "_");
  return path.join(CACHE_DIR, `${clean}.html`);
}

let lastRequestAt = 0;
let cacheHits = 0;

async function fetchPage(rawUrl, { useCache = true } = {}) {
  const file = cacheFile(rawUrl);
  if (useCache && fs.existsSync(file)) {
    cacheHits++;
    const html = fs.readFileSync(file, "utf8");
    return { html, fromCache: true, size: html.length };
  }
  await sleep(Math.max(0, MIN_DELAY_MS - (Date.now() - lastRequestAt)));
  const resp = await client.get(rawUrl);
  lastRequestAt = Date.now();
  if (resp.status !== 200) {
    throw new Error(`HTTP ${resp.status} for ${rawUrl}`);
  }
  fs.writeFileSync(file, resp.data);
  return { html: resp.data, fromCache: false, size: resp.data.length };
}

const toAbsolute = (href, pageUrl) => new URL(href, pageUrl).href;

async function discoverPages(fetcher) {
  const pages = [START_URL];
  let current = START_URL;
  let guard = 0;
  while (guard < 20) {
    guard++;
    const file = cacheFile(current);
    if (!fs.existsSync(file)) break;
    const $$ = cheerio.load(fs.readFileSync(file, "utf8"));
    const next = $$("li.next a").attr("href");
    if (!next) break;
    const asPath = new URL(toAbsolute(next, `${BASE_URL}${current}`)).pathname;
    if (pages.includes(asPath)) break;
    pages.push(asPath);
    try {
      const res = await fetcher(asPath);
      console.log(res.fromCache ? "CACHE HIT" : "FETCH", asPath, `${res.size} bytes`);
      current = asPath;
    } catch {
      break;
    }
    if (pages.length >= 3) break;
  }
  return pages;
}

function collectBookLinks(html, pageUrl) {
  const $ = cheerio.load(html);
  const links = [];
  $("article.product_pod h3 a").each((_, el) => links.push($(el).attr("href")));
  const abs = links.map((h) => toAbsolute(h, pageUrl));
  return [...new Set(abs)];
}

function extractBook(html, productUrl, sourcePage) {
  const $ = cheerio.load(html);
  const title = $("div.product_main h1").first().text().trim() || null;
  const priceText = $("p.price_color").first().text().trim() || null;
  const availabilityText = $("p.availability").first().text().replace(/\s+/g, " ").trim() || null;
  const ratingWords = ["One", "Two", "Three", "Four", "Five"];
  const ratingClass = $("p.star-rating").first().attr("class") || "";
  const ratingWord = ratingWords.find((w) => ratingClass.includes(w));
  const ratingText = ratingWord || null;
  const descEl = $("#product_description");
  const description = descEl.length ? descEl.next("p").first().text().trim() || null : null;
  return {
    title,
    product_url: productUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: new Date().toISOString(),
  };
}

export async function run() {
  let page1;
  try {
    page1 = await fetchPage(START_URL, { useCache: true });
  } catch {
    page1 = await fetchPage(START_URL, { useCache: false });
  }
  console.log(page1.fromCache ? "CACHE HIT" : "FETCH", `page-1 ${page1.size} bytes`);

  const pages = await discoverPages(fetchPage);
  console.log(`catalogue_pages=${pages.length}`);

  const bookUrls = new Set();
  for (const p of pages) {
    const file = cacheFile(p);
    if (!fs.existsSync(file)) continue;
    for (const u of collectBookLinks(fs.readFileSync(file, "utf8"), `${BASE_URL}${p}`)) {
      bookUrls.add(u);
    }
  }
  console.log(`discovered=${bookUrls.size} unique_urls=${bookUrls.size}`);

  const rawRecords = [];
  for (const url of bookUrls) {
    try {
      const p = new URL(url).pathname;
      const res = await fetchPage(p, { useCache: true });
      const raw = extractBook(res.html, url, `${BASE_URL}${p}`);
      rawRecords.push(raw);
    } catch (err) {
      console.error(`  skip ${url}: ${err.message}`);
    }
  }
  console.log(`detail_pages=${rawRecords.length}`);

  const printed = { ...rawRecords[0] };
  console.log("sample raw record:", JSON.stringify(printed, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
}