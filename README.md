# Codevector — Product Catalog API

A backend for browsing ~200,000 products with cursor-based pagination and
category filtering, built for the Codevector take-home assignment.

**Live demo:** https://codevictor.vercel.app
**API:** https://codevictor.onrender.com

---

## What this is

- `backend/` — Node.js + TypeScript + Express + Postgres (Neon), exposing
  `GET /products` (cursor-paginated, optional category filter) and
  `GET /categories`.
- `frontend/` — Next.js + shadcn/ui, a simple "Load more" browser for the
  catalog. Bonus only — not graded, built quickly with AI assistance.

---

## Why cursor-based pagination, not OFFSET/LIMIT

The assignment's core requirement is: *while data is changing, a user
paginating through results must never see a duplicate or miss a product.*

Standard `LIMIT/OFFSET` pagination identifies a page by **position**
("skip 40, take 20"). That breaks in two ways on a table that's actively
being written to:

1. **Slow on deep pages.** Postgres has to scan and discard every row
   before the offset, every single request. Page 2 is instant; page 9,000
   means discarding ~180,000 rows first, every time you ask.
2. **Wrong under concurrent writes.** If new rows are inserted while a
   user is mid-browse, every row below the insertion point shifts position.
   "Page 2" (`OFFSET 20`) now points at a different set of rows than it
   did a moment ago — the user sees duplicates from page 1 and silently
   skips rows that used to be at the boundary.

**Cursor pagination** fixes both by identifying a page boundary using the
content of the last row seen, not its position:

```sql
WHERE (created_at, id) < ($1, $2)
ORDER BY created_at DESC, id DESC
LIMIT N
```

The cursor is `(created_at, id)` of the last row the client has already
seen, base64-encoded into an opaque token and handed back to the client.
The client resends it as `?cursor=...` to get the next page.

- **Why the `id` tiebreaker?** `created_at` is not guaranteed unique —
  with 200,000 rows, multiple products can share the exact same
  timestamp. Sorting by `created_at` alone gives ties an undefined order,
  which can skip or duplicate rows across a page boundary. `id` (an
  auto-incrementing `BIGSERIAL`) is always unique and always reflects
  insertion order, so the *pair* `(created_at, id)` is a fully
  deterministic sort key. This was verified directly — see
  [Testing performed](#testing-performed) below.
- **Why does this survive concurrent inserts?** Because the condition is
  "rows strictly after this exact value," not "rows after this position."
  New inserts land above the cursor's position in sort order and simply
  don't match `< ($1, $2)` — they don't affect what "after this row"
  means for anyone already paginating.
- **Why is it fast?** Two composite indexes —
  `(created_at DESC, id DESC)` and `(category, created_at DESC, id DESC)`
  — let Postgres jump directly to the right point in sorted order via an
  index scan, instead of scanning and discarding rows. Confirmed via
  `EXPLAIN ANALYZE` (below): both query shapes hit `Index Only Scan`,
  sub-millisecond execution time, regardless of how deep the page is.

---

## Seeding 200,000 rows

`backend/src/seed.ts` generates and inserts 200,000 products using
**batch inserts** — multiple rows per `INSERT` statement (1,000 rows per
batch, 200 batches total) — instead of one `INSERT` per row in a loop.

A naive per-row loop makes 200,000 separate network round trips to the
database. Each round trip has latency, even if the actual insert work
is near-instant; on a hosted free-tier DB this adds up to a very long
seeding run. Batching collapses that to ~200 round trips. Measured
result: **200,000 rows seeded in ~31 seconds.**

Timestamps are deliberately spread randomly across a 2-year window
(rather than using `NOW()` for every row), which produces a realistic
distribution for testing pagination at scale, including occasional
`created_at` collisions — the exact scenario the `id` tiebreaker exists
to handle.

---

## API

### `GET /products`

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | number | `20` | Capped at `100` |
| `category` | string | — | Optional exact-match filter |
| `cursor` | string | — | Opaque token from a previous response's `nextCursor` |

```json
{
  "data": [ { "id": "...", "name": "...", "category": "...", "price": "...", "created_at": "...", "updated_at": "..." } ],
  "nextCursor": "eyJjcmVhdGVkQXQiOi...",
  "hasMore": true
}
```

Notes on the response shape:
- `id` and numeric `price` are returned as **strings**. Postgres
  `BIGINT`/`NUMERIC` values are serialized as strings by the driver to
  avoid precision loss (JS numbers can't safely represent every possible
  `BIGINT`, and `NUMERIC` needs exact decimal precision for currency).
- The category filter is **not** encoded in the cursor — it must be
  repeated by the client on every paginated request. This was a
  deliberate simplicity tradeoff: the cursor only encodes position, the
  caller already knows which filter it's currently showing.
- `hasMore` is computed by fetching `limit + 1` rows and checking if an
  extra row came back, avoiding a separate `COUNT(*)` (expensive at
  this scale, and only gets worse as the table grows).

### `GET /categories`

Returns a plain array of distinct category strings, for populating a
filter dropdown.

---

## Running locally

```bash
# Backend
cd backend
npm install
# create .env with DATABASE_URL=<your Neon connection string>
npm run migrate   # creates products table + indexes
npm run seed       # batch-inserts 200,000 rows (~30s)
npm run dev        # starts on :3000

# Frontend (separate terminal)
cd frontend
npm install
# create .env.local with NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
npm run dev        # starts on :3001
```

---

## Testing performed

Correctness was verified against the real, live Neon database — not
just asserted. Summary of what was checked and how:

| Check | Method | Result |
|---|---|---|
| Batch insert speed | Timed `npm run seed` | 200,000 rows in 31.0s |
| Schema + indexes exist | `pg_indexes` query in Neon SQL editor | `products_pkey`, `idx_products_created_id`, `idx_products_category_created_id` all present |
| Pagination matches ground truth | Compared API page 1 + page 2 output, row-by-row, against `SELECT ... ORDER BY created_at DESC, id DESC LIMIT 40` run directly in Neon | Identical, in order, no gaps, no duplicates |
| Tiebreaker correctness | Inserted 3 rows with an identical `created_at`; paginated with `LIMIT 2` to force a tie across a page boundary, with and without the `id` tiebreaker | **Without** `id`: one row was silently skipped, never shown. **With** `(created_at, id)`: all 3 rows shown exactly once, in deterministic order |
| Concurrent inserts mid-browse | Captured a cursor after 2 pages (40 rows), then inserted 5 new rows directly into the live DB, *then* fetched the next page using the already-captured cursor | New rows did not appear (correct — they're newer than the cursor's position); next page continued correctly with no duplicates or gaps from the already-seen 40 rows |
| Index usage | `EXPLAIN ANALYZE` on both the unfiltered and category-filtered cursor query, on the live 200k-row table | Both used `Index Only Scan` (not a sequential scan); execution time ~0.04-0.06ms |
| Category filter correctness | Fetched `?category=Electronics`, checked every returned row | 100% matched the requested category |
| Filter-not-repeated behavior | Deliberately omitted `category` on a page-2 request that should have been filtered | Confirmed it silently falls back to unfiltered results — documented above as expected, not a bug |

---

## Deployment

- **Database:** Neon (free tier)
- **Backend:** Render (free web service), root directory `backend`,
  start command runs the TypeScript source directly via `tsx`
- **Frontend:** Vercel (free tier), root directory `frontend`

---

## What I'd improve with more time

- **Build step for the backend.** Currently runs via `tsx` directly in
  production rather than compiling to `dist/` via `tsc` first. Fine at
  this scale, but a proper build step is the more standard production
  setup.
- **Encode the active filter into the cursor itself**, or at least
  validate server-side that a cursor's implicit context (e.g. which
  category it was generated under) matches the current request, to make
  the "forgot to repeat the filter" failure mode impossible rather than
  just documented.
- **Rate limiting / input validation middleware** (e.g. `zod`) on query
  params, rather than ad-hoc parsing in the route handler.
- **Automated tests** for the pagination logic (the tiebreaker and
  concurrent-insert scenarios were verified manually against the live
  DB during development — turning those into repeatable integration
  tests would be the natural next step).
- **CORS origin list via environment variable** rather than hardcoded
  in source, so adding a new deployed frontend doesn't require a code
  change.

---

## How I used AI

I used two tools at different stages, for different purposes.

**ChatGPT** ([conversation log](https://chatgpt.com/share/6a3a7120-4bdc-83ee-a377-f60d02e14490))
was used first, before writing any code, purely to research what
pagination approaches existed and get oriented — alongside reading
ByteByteGo's [pagination techniques guide](https://bytebytego.com/guides/how-do-we-perform-pagination-in-api-design/).
This is where I first encountered the term "cursor-based pagination"
and got a rough sense that it was the right direction for the
concurrent-write correctness requirement, before I understood any of
the actual mechanics.

**Claude** did essentially everything from that point on — I came in
only knowing basic CRUD, with no prior exposure to migrations, seeding
strategies, indexing, or pagination mechanics beyond having just heard
the term `LIMIT`/`OFFSET`. Claude was used as a tutor rather than a
code-generator I copy-pasted from blindly.

**What it helped with:**
- Explaining *why* `OFFSET` pagination breaks under concurrent writes
  (not just that it does), including building small interactive demos
  that let me trigger the bug myself and watch it happen, rather than
  taking it on faith.
- Explaining batch inserts and why per-row insert loops are slow
  (network round-trip latency, not database processing time).
- Walking through the cursor pagination query and base64 cursor
  encoding/decoding line by line, with concrete worked examples.
- Helping me verify correctness against the real database (ground-truth
  SQL comparisons, forced tiebreaker collisions, live concurrent-insert
  testing) rather than just trusting the code.
- Debugging real issues I hit during setup (a `//` SQL comment that
  should've been `--`, a port collision between frontend and backend,
  a CORS misconfiguration) — in each case by reading the actual error
  message with me and tracing the cause, not just supplying a fix blind.
- Scaffolding the bonus frontend (Next.js + shadcn/ui) — this part was
  explicitly out of scope for grading, so I leaned on AI more heavily
  here than on the backend.

**Where I pushed back or asked for changes:**
- An early version of the dynamic `WHERE`-clause builder used array-length
  arithmetic to compute SQL placeholder numbers (`$1`, `$2`...) generically
  across 4 possible filter combinations. I found this hard to read and
  asked for it to be rewritten as 4 explicit, fully-spelled-out branches
  instead — more lines of code, but each one independently readable
  without tracing mutable state. This is the version that shipped.
- I asked directly whether a screenshot comparison was actually correct
  before accepting it — at one point I incorrectly predicted a specific
  row's position while manually checking output, which led to catching
  and correcting that mistake by cross-referencing against a fresh
  ground-truth query rather than trusting the first comparison.

**Things worth being upfront about:**
- The actual SQL logic, schema design, and pagination approach were
  explained to me concept-first, and I could trace and explain every
  line by the end — this README's technical sections reflect that
  understanding, not just AI-generated prose.
- The frontend's visual design and component scaffolding leaned on AI
  significantly more than the backend did, consistent with the
  assignment's note that UI code isn't graded.
