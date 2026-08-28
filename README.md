# TryOn

AI virtual try-on, built as a **plugin** any clothing store can drop into their site with
one script tag. Three separate entities in one repo:

```
apps/demo-store/          A stand-in merchant storefront. Contains no try-on code —
                          it embeds the plugin like a real customer would.
packages/tryon-widget/    THE PLUGIN. Vanilla TS, no dependencies, ships as a single
                          ~30 kB tryon.js. Renders inside a shadow root.
services/api/             THE AI ENGINE. Express + Mongoose, repository pattern.
                          Owns the catalog, shopper photos, generation queue and
                          the swappable model provider.
```

## The shopper flow

1. Shopper clicks **Try on** on the merchant's product card.
2. **First time ever** → the centred upload modal asks for one full-body photo.
3. **Every time after** → straight into the persistent floating panel; the photo is
   already on file, so the render starts immediately.
4. The panel stays open while they keep browsing. Each finished look pins into the
   thumbnail dock overlaid on the image, and they can flip between looks and their
   bare photo instantly.

## Running it

Needs Node 20+ and a MongoDB instance.

```bash
npm install
cp services/api/.env.example services/api/.env   # then fill it in, see below

npm run seed          # creates a merchant + syncs the demo catalog, prints your keys
npm run dev           # builds the plugin, then runs the API (:4000) and store (:3000)
```

Open <http://localhost:3000> and click **Try on** on any card.

`npm run seed` also writes `apps/demo-store/.env.local`, so the storefront picks up the
publishable key automatically. Re-run it any time you change `apps/demo-store/catalog.json`.

Individual workspaces:

```bash
npm run dev:api       # tsx watch
npm run dev:store     # next dev
npm run dev:widget    # esbuild --watch
npm run typecheck     # every workspace
```

## Integrating with a real store

Two things, and nothing else:

```html
<!-- 1. once, anywhere on the page -->
<script async src="https://your-api.example.com/tryon.js" data-tryon-key="pk_…"></script>

<!-- 2. on every element that should open the try-on -->
<button data-tryon-product="SKU123">Try on</button>
```

The plugin binds clicks at the document level in the capture phase, so it works with
React, Vue, infinite scroll and quick-view modals without the merchant re-registering
anything. Optional attributes:

| Attribute | Default | Purpose |
| --- | --- | --- |
| `data-tryon-key` | — | Publishable key. Required. |
| `data-tryon-api` | script's own origin | API base URL. |
| `data-tryon-selector` | `[data-tryon-product]` | What counts as a trigger. |
| `data-tryon-attribute` | `data-tryon-product` | Where the SKU lives. |
| `data-tryon-auto` | `true` | `false` to bind triggers yourself. |
| `data-tryon-url` (on a trigger) | — | Where "View product" should link. |

There is also a JS API: `window.TryOn.open('SKU123')`, `.openPanel()`, `.close()`,
`.destroy()`, `.init({ key, apiUrl })`.

While the panel is open the plugin puts `tryon-panel-open` on `<html>`, so a merchant can
reflow their grid around it (see `apps/demo-store/app/styles.css`). Without it the panel
simply overlays.

The plugin renders entirely inside a shadow root, so its CSS and the merchant's cannot
collide in either direction, and it loads no webfonts or external assets.

## Product catalog

The engine keeps its own copy of the products so it controls the garment images the model
sees, and **the storefront renders from that database, not from a file**. `page.tsx` is a
server component that calls `GET /v1/widget/products` on every request with
`cache: 'no-store'`, so adding, editing or deactivating a product shows up on the next page
load with no rebuild — including the colour filter chips, which are derived from whatever
is actually in the catalog.

`apps/demo-store/catalog.json` is now only the *feed* that `npm run seed` imports, exactly
as a real merchant's nightly catalog sync would. Nothing renders from it.

That server-side fetch has no browser to set an `Origin` header, so it sends
`NEXT_PUBLIC_STORE_ORIGIN` (written by the seed) explicitly — which means the storefront
keeps working once you fill in the merchant's origin allowlist.

A real merchant would POST their feed rather than seed from a file:

```bash
curl -X POST http://localhost:4000/v1/admin/products \
  -H "Authorization: Bearer sk_…" -H 'Content-Type: application/json' \
  -d '{"products":[{
        "externalId":"SKU123", "name":"Silk Column Dress",
        "imageUrl":"https://cdn.example.com/sku123.jpg",
        "category":"dress", "color":"Midnight", "price":2890,
        "promptHint":"Floor-length column silhouette."
      }]}'
```

`category` is one of `dress`, `top`, `bottom`, `outerwear`, `full_outfit`, and it decides
which garment the model is told to replace. `promptHint` is appended to the generation
prompt — the cheapest lever on output quality.

## Configuration

Everything lives in `services/api/.env`; `.env.example` documents each variable.

### AI provider

```
AI_PROVIDER=mock     # or openai
OPENAI_API_KEY=…
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=auto
OPENAI_IMAGE_QUALITY=medium
OPENAI_IMAGE_FIDELITY=high
```

Two dials that sound alike and are not. **`quality`** is how finely the output
renders — that is the cost lever, cut it first. **`input_fidelity`** is how much of the
shopper survives the edit, their face above all — that is the product, don't cut it. Only
the `gpt-image-1` family accepts `input_fidelity`; `gpt-image-2` returns a 400, so
`openai.provider.ts` gates on the model name.

Measured on one render: turning fidelity on took `gpt-image-1` from 646 to 13,126 input
image tokens, $0.071 → $0.198. `gpt-image-2` doesn't take the parameter and costs $0.078,
making it the cheapest of the three at settings that keep a face intact.

`size: auto` keeps the shopper photo's own aspect ratio. A fixed size makes the model
re-compose the shot, which is much of why backgrounds come back rebuilt.

`mock` returns the shopper's own photo after a delay — no API calls, no cost — and flags
the result as `simulated`, which the panel shows as a "Simulated" badge. Use it to build
UI. `openai` sends the shopper photo and the garment image to the image-edit endpoint with
an identity-preserving prompt (`src/providers/ai/prompt.ts`).

Adding another engine means one file implementing `TryOnProvider` and one case in
`src/providers/ai/index.ts`. Nothing above that layer knows which model is in use.

### Cost tracking

Every render records what it cost. `gpt-image-1` returns a `usage` object on each call,
billed across three meters, and the provider prices it immediately:

```
PRICE_TEXT_INPUT_PER_MTOK=5     # the prompt
PRICE_IMAGE_INPUT_PER_MTOK=10   # the two reference images going in
PRICE_IMAGE_OUTPUT_PER_MTOK=40  # the render coming out — this is the bill
```

Rates live in `.env` rather than in code, and the resulting figure is **stored on the
generation**, not recomputed on read: changing a rate affects new renders only, so last
month's spend stays what it actually was. Check the numbers against
<https://openai.com/api/pricing/> — they are only as current as the day they were typed.

```bash
curl -H "Authorization: Bearer sk_…" localhost:4000/v1/admin/usage
```

returns spend and volume for the window (last 30 days by default), the same figures
bucketed by day in `Asia/Kolkata`, and the products costing the most. `GET
/v1/admin/generations` lists individual renders with their costs.

The report separates **billable** from **simulated** renders, so `avgCostPerRenderUsd` is
not quietly diluted by mock ones. It also counts cache hits: repeating the same photo +
garment serves the stored render, and `savedUsd` is what those repeats would have cost at
the price of the render they were served from.

Cost never appears on the widget surface — what a render costs is the merchant's business,
not the shopper's.

### Storage

`s3`, `cloudinary` or `local`, behind one `StorageDriver` interface. S3 is the default.

```
STORAGE_DRIVER=s3
AWS_REGION=ap-south-1       # Mumbai; ap-south-2 is Hyderabad
S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=…         # omit both on EC2/ECS to use the IAM role instead
AWS_SECRET_ACCESS_KEY=…
S3_DELIVERY=presigned
S3_URL_EXPIRY_SECONDS=3600
```

Keep the bucket in the same region as the API — every render reads the shopper's photo
back out of it, so a cross-region hop is paid on the critical path of a 10–40s operation.

`presigned` keeps the bucket private with Block Public Access left on, and hands the
browser a signed URL that expires: a leaked link stops working, and nothing is reachable
by guessing a key. That is the right default for photographs of real people. `public`
assumes world-readable objects and returns a plain cacheable URL — reasonable only behind
CloudFront, via `S3_PUBLIC_BASE_URL`.

Objects are written with `ServerSideEncryption: AES256`, and the key stored in Mongo
excludes `S3_PREFIX`, so the prefix can change later without orphaning existing rows.

Setting `S3_ENDPOINT` points the driver at MinIO or any S3-compatible service instead
of AWS.

The IAM user needs exactly three actions on the bucket:

```json
{ "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
  "Resource": "arn:aws:s3:::your-bucket/*" }
```

`local` writes to `services/api/storage` and serves from `/files` — fine for development,
but it does not survive a redeploy, so it is not a deployment option.

### Retention

`PHOTO_RETENTION_DAYS=30` deletes shopper photos and their renders 30 days after upload,
via a Mongo TTL index plus an hourly sweep that removes the stored files. Each visitor
keeps exactly one photo — uploading a new one deletes the old. Shoppers can delete it
themselves from the panel. `0` keeps photos indefinitely, which needs explicit consent in
the UI before you ship it.

## API surface

**Widget routes** — public, authenticated by publishable key + the merchant's origin
allowlist:

| | |
| --- | --- |
| `GET /v1/widget/bootstrap` | Merchant theme, visitor token, whether a photo is on file, recent looks. Decides modal vs. panel. |
| `GET /v1/widget/products/:sku` | One product. |
| `POST /v1/widget/photos` | multipart upload; becomes the visitor's active photo. |
| `DELETE /v1/widget/photos` | Shopper deletes their photo. |
| `POST /v1/widget/tryon` | Queues a render. `202` + generation, or `200` if cached. |
| `GET /v1/widget/generations/:id` | Poll status; scoped to the calling visitor. |
| `GET /v1/widget/generations` | Recent looks for the dock. |

**Admin routes** — server-to-server, secret key. `POST /v1/admin/merchants` (guarded by
`ADMIN_BOOTSTRAP_TOKEN`), `GET /v1/admin/me`, CRUD on `/v1/admin/products`, plus
`GET /v1/admin/usage` and `GET /v1/admin/generations` for spend.

`GET /health` reports database, provider and queue depth.

### Why generation is asynchronous

Image models take 10–40s, well past any sane HTTP timeout. `POST /tryon` returns `202`
with a generation id and the widget polls with a backing-off interval. Repeating the same
photo + garment returns the cached render instead of paying twice; `force: true` re-renders.

The queue in `src/jobs/generation.queue.ts` is in-process with a concurrency cap, which is
fine for one API instance. Multiple instances need a shared queue (BullMQ/Redis) — swap
that one file; the service layer above it does not change.

## Architecture notes

`services/api` is layered so Mongoose appears in exactly one place:

```
routes → controllers → services → repositories → models
                    ↘ providers/ai   (the model)
                    ↘ storage        (the bytes)
```

Controllers are thin: HTTP in, DTO out. Services hold the business rules and never touch a
Mongoose query. `repositories/base.repository.ts` carries the shared CRUD; every concrete
repository extends it. Request bodies are validated by zod schemas in `validators/`, and
responses are shaped by `dto/mappers.ts` so internal fields never leak.

## Security

- Publishable keys are meant to be visible in merchant HTML; the **origin allowlist** is
  what stops another site using them. It is empty in development, meaning any origin —
  set `allowedOrigins` before a merchant goes live.
- Secret keys are `select: false` and returned exactly once, at merchant creation.
- Every generation read is scoped to the requesting visitor; one shopper cannot address
  another's renders.
- Rate limits per IP per minute and per visitor per hour, plus an upload-specific limit.
- Product names from the catalog are escaped before touching `innerHTML` in the widget.
- Merchant-supplied image URLs are fetched http(s)-only with a size ceiling.

## Tests

```bash
cd packages/tryon-widget
node test/smoke.mjs <publishableKey> [apiUrl]
```

Loads the built bundle into a jsdom page against a live API and walks all three entry
paths: first-run modal, returning visitor straight to the panel with a real render, and a
bad SKU surfacing an error.

## Branches

`main`, `ui-experiment-v2` and `ui-experiment-v3` are the original frontend-only UI
explorations, kept as references. `ai-integration` (this branch) is the real system: the
modal comes from `main`, the floating panel with its overlaid thumbnail dock from
`ui-experiment-v3`.
