# The Polite Scraper — Books to Scrape

A small, polite scraping pipeline for the [Books to Scrape](https://books.toscrape.com/) practice sandbox: it downloads the first three catalogue pages, visits all 60 book pages, turns messy HTML into clean, schema-checked JSON, survives broken pages, and ends every run with an honest report.

Built for **FlyRank Backend AI Engineering · Week 5 · Assignment A9**.

## Target Classification

| Question | Answer |
|---|---|
| **Target** | Books to Scrape (`https://books.toscrape.com/`) |
| **Why** | It is a public sandbox built explicitly so people can practise scraping on it (the site says so on its own home page). It is the only kind of site this assignment touches. |
| **Scope** | First 3 catalogue pages only (60 books), plus each of their 60 book pages. |
| **Data collected** | Title, price, availability, rating, description, plus the source page and fetch time (provenance). |
| **Why appropriate** | The site exists for this. Sandbox sites are built for automation practice; no API exists for it, so fetching HTML is the intended usage. |

**Robots check result:** `GET https://books.toscrape.com/robots.txt` returned `200` (the file exists; the sandbox allows crawling).

> I will not reuse this code on another site without checking its rules and terms first.

## How to Run

One command:

```bash
npm install
npm start
```

Outputs in `output/` (and a committed sample in `samples/`):
- `books.json` — 60 validated, deduplicated book records
- `errors.json` — records that failed schema validation (with reasons)
- `run-report.json` — an honest report of the run

To prove failure-survival (adds one deliberately broken URL):

```bash
npm start -- --fake
```

## Lane & Install

- **Lane:** JavaScript / Node.js 20+
- **Dependencies:** `axios` (HTTP), `cheerio` (HTML parsing), `zod` (schema validation)

## Record Schema

The finished record (validated with Zod before storage):

```
title            string   — book title
product_url      string   — absolute canonical URL (identity; dedupe key)
price_gbp        number   — price as a sortable number, e.g. 51.77
price_text       string   — original text kept, e.g. "£51.77"
availability_text string  — original availability text
rating           number   — 1–5 (or null)
rating_text      string   — original rating word, e.g. "Three"
description      string | null — description, or null when missing (never invented)
source_page      string   — which catalogue page it came from (provenance)
fetched_at       string   — fetch timestamp (provenance)
```

Invalid records never reach `books.json` — they land in `errors.json` with the reason.

## The Pipeline (7 stages)

| Stage | What it does | Proof |
|---|---|---|
| 0 | Classify target + check robots.txt | This README |
| 1 | Fetch once, cache once (honest user-agent, timeout, status check) | `CACHE HIT` on rerun |
| 2 | Follow the catalogue's "next" links, dedupe to 60 URLs | `catalogue_pages=3 discovered=60 unique_urls=60` |
| 3 | Extract 8 raw fields from all 60 detail pages | `detail_pages=60` |
| 4 | Normalize (`£51.77`→`51.77`), Zod-validate, store idempotently | `books.json` = 60, twice |
| 5 | Retry once on 5xx/timeout, skip broken pages, write run report | `npm start -- --fake` → `failed_pages: 1`, 60 survive |
| 6 | Publish this evidence | This repo |

## Politeness Rules

- **User-agent** names the scraper and links the repo (`FlyRankInternshipA9/1.0 (github.com/codewithsyedabdullah/flyrank-scraper)`)
- **Delay** of at least 600 ms between real requests
- **Timeout** of 10 s — a request never hangs forever
- **Status check** — only HTTP 200 is treated as HTML; everything else is a failed fetch
- **Cache** — development reads saved HTML instead of asking the site again (a rerun made **63 requests from cache** and 0 to the site)
- **Retry** — one retry only on 5xx / timeout; never on 404 (page doesn't exist) or 403 (site said no)

## Real Run Report (proof)

Run 2 (full cache) report, pasted verbatim from `output/run-report.json`:

```json
{
  "start_time": "2026-08-28T17:07:39.557Z",
  "end_time": "2026-08-28T17:07:41.137Z",
  "duration_ms": 1580,
  "pages_fetched": 3,
  "cache_hits": 63,
  "discovered_pages": 3,
  "unique_urls": 60,
  "detail_pages_fetched": 60,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0,
  "retries": 0
}
```

Break-page run (`--fake`) report: `valid_records: 60, failed_pages: 1` — the run finished and the good data survived.

## Why No Browser?

A browser was not needed because the data is already in the HTML the server sends — the server renders the book pages server-side, so a plain HTTP request receives everything (price, rating, availability, description) without executing JavaScript. A browser would only add cost (memory, startup time) for no extra data.

## Ethics Note

- Use an official API whenever one exists; scraping is the fallback, not the first choice.
- Never bypass logins, paywalls, blocks, or terms of service.
- Collect only what you need, identify yourself, go slowly, and respect the site's robots.txt and rate limits.
- This code targets the public Books to Scrape sandbox only.

## Limitations

Honest one: the scraper is single-threaded and sequential (60 detail pages × 600 ms ≈ 80 s on first run). It is intentionally simple — the assignment warns against gold-plating Stage 5, and next week's assignment (A16) builds the production version with proper backoff, Retry-After handling, and structured logs.

## Tests

```bash
npm test
```

5 unit tests (Node's built-in test runner): price normalization, relative→absolute URLs, duplicate-URL collapse, missing-description handling, and schema rejection of a malformed record.

## Bonus: AI vs Me

The pipeline was built and debugged with heavy AI assistance, then reviewed by hand. Honest diff:

**What the AI was better at:** producing the overall architecture instantly (cache layer, dedupe via canonical URL, retry-once policy). The structure is genuinely sound.
**What it got wrong that I caught:** silent failure on a mislabeled `source_page` (it pointed at the book URL, not the catalogue page), an off-by-one that discovered page 3 but never fetched it (40 books instead of 60), a Map-VS-array bug that turned URLs into comma-joined strings and 404'd every detail page, and schema exports that lived inside the `run` function instead of module scope.
**What the prompt would have to specify:** the *exact* catalogue page limit (3), the provenance field semantics, retry-eligibility (5xx/timeout yes, 404/403 no), and "report your failures".

---

*Target: Books to Scrape practice sandbox only. All tools free, no credit card required.*