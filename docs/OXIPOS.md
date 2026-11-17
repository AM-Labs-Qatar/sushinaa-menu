# OXiPOS pull API (our contract)

## Separation of concerns (critical)

Two different customer paths. Do not mix them.

| Path | Who | Payment | Kitchen |
| --- | --- | --- | --- |
| **Car-collection pickup** | Customer orders from home / car on **`order.sushinaa.qa`** (`order.*` or `STOREFRONT_MODE=pickup`) | Our checkout (**live Sadad** / pay-at-pickup / mock) | **Our CMS** live Orders — not OXiPOS |
| **On-site / at the restaurant** | Guest is already in branch on **`menu.sushinaa.qa`** (non-pickup storefront) | Branch card machine / counter — **not** Sadad | **OXiPOS** pulls from `menu.*` |

**OXiPOS must only call the menu host** (`menu.sushinaa.qa`) — never `order.*`. Pickup orders stay in the CMS. Do not feed CMS pickup tickets into OXiPOS, and do not let POS acceptance drive CMS kitchen status.

That boundary is intentional product architecture, not a temporary quirk.

**Current production status:** leave `OXIPOS_*` unset on Production until the on-site (`menu.*`) cutover. Sadad live keys bind to `order.sushinaa.qa` only.

## What this API is

OXiPOS does not push menus into this app. For the **in-restaurant** path only, it **pulls** pending orders from a **non-pickup** server about every 30 seconds, then POSTs acceptance.

Depend only on this document and the vendor guide field names. Do not encode poll interval or User-Agent.

## Endpoints we expose

Canonical paths have **no** trailing slash (App Router). Trailing-slash forms are accepted via an internal rewrite — never a 308 — so OXiPOS POSTs keep their body.

| Method | Canonical path | Also accepted |
| --- | --- | --- |
| `GET` | `/api/pos/orders?shop_id={shop_id}` | `/api/pos/orders/?shop_id={shop_id}` |
| `POST` | `/api/pos/orders/{pos_export_id}/accepted` | `/api/pos/orders/{pos_export_id}/accepted/` |

`POST` body `{}`. Marks the order accepted; it must not appear in `GET` again. Response root for `GET` is a JSON **array** (empty list is `[]`).

Auth header on every request: `X-POS-API-Key: {OXIPOS_API_KEY}`. Invalid or missing key → `401`.

## Order object (exact names)

`id` (integer `pos_export_id`), `customer_name`, `customer_phone`, `address_text`, `items[]` with `item_name`, `quantity`, `price_sold`, optional `product_id` (our `posSku`), `options_display`, `notes`.

For in-restaurant tickets, `address_text` starts with **At restaurant** (branch name, optional instructions) — not a car-collection summary. Do not reuse pickup plate/car fields for this path. Pickup tickets (CMS only) use **Car collection** / thermal **CAR PICKUP**.

## Config

| Env | Meaning |
| --- | --- |
| `OXIPOS_API_KEY` | Shared secret. Pull API refuses all callers when unset. |
| `OXIPOS_SHOP_IDS` | JSON map of branch slug → shop id, e.g. `{"down-town":"101"}`. |

Give the restaurant: base URL **`https://menu.sushinaa.qa/api/pos/orders`** (never `order.*`; trailing slash still works), shop ids, API key, and the POS SKU CSV from **Admin → Menu → Export POS SKUs** (`GET /api/admin/menu/pos-sku-export`). They fill the blank `oxiposProductId` column and configure `weborder.map.{posSku}={oxiposProductId}` on the POS. Acceptance: `POST https://menu.sushinaa.qa/api/pos/orders/{id}/accepted`.

Our `posSku` values are assigned automatically as `SU-{DISH_ID}` in uppercase (e.g. dish `sushinaa-burger` → `SU-SUSHINAA-BURGER`). Stable, unique, and safe for POS map keys.

## Eligibility (in-restaurant / POS path only)

OXiPOS is **kitchen relay for the non-pickup order website**. There is no payment flow on this API — payment is the branch card machine / counter.

**Enforced in code** (`src/ordering/surface.ts`):

1. Host gate — `GET`/`POST` `/api/pos/*` return `503 POS_UNAVAILABLE_ON_PICKUP` when the storefront is pickup (`order.*` or `STOREFRONT_MODE=pickup`).
2. Row gate — only orders with `order_surface = 'restaurant'` enter the pending list. Checkout on the pickup storefront stamps `order_surface = 'pickup'`; those tickets stay on the **CMS** board (`CMS_KITCHEN`) and never export to POS.

POS acceptance only sets `accepted_by_pos_at` on restaurant-surface rows and must not move CMS pickup kitchen status.

## Live database

Ordering (and this API) refuse the production Turso host until an explicit cutover.
