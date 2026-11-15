# OXiPOS pull API (our contract)

## Separation of concerns (critical)

Two different customer paths. Do not mix them.

| Path | Who | Payment | Kitchen |
| --- | --- | --- | --- |
| **Car-collection pickup** | Customer orders from home / car on the **pickup** storefront (`order.*` or `STOREFRONT_MODE=pickup`) | Our checkout (Sadad / mock / pay-at-pickup) | **Our CMS** live Orders — not OXiPOS |
| **At the restaurant** | Guest is already in branch; staff show an **order website that does not offer car-collection pickup** | Separate card machine / counter — not our online pickup checkout | **OXiPOS** pulls from that non-pickup server |

**OXiPOS must only call a server that does not expose the pickup (car-collection) option.** Pickup orders stay in the CMS. Do not point the POS pull URL at the pickup storefront, do not feed CMS pickup tickets into OXiPOS, and do not let POS acceptance drive CMS kitchen status.

That boundary is intentional product architecture, not a temporary quirk.

## What this API is

OXiPOS does not push menus into this app. For the **in-restaurant** path only, it **pulls** pending orders from a **non-pickup** server about every 30 seconds, then POSTs acceptance.

Depend only on this document and the vendor guide field names. Do not encode poll interval or User-Agent.

## Endpoints we expose

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/pos/orders?shop_id={shop_id}` | Root JSON **array** of pending orders. Empty list is `[]`. |
| `POST` | `/api/pos/orders/{pos_export_id}/accepted/` | Body `{}`. Marks the order accepted; it must not appear in GET again. |

Auth header on every request: `X-POS-API-Key: {OXIPOS_API_KEY}`. Invalid or missing key → `401`.

## Order object (exact names)

`id` (integer `pos_export_id`), `customer_name`, `customer_phone`, `address_text`, `items[]` with `item_name`, `quantity`, `price_sold`, optional `product_id` (our `posSku`), `options_display`, `notes`.

For in-restaurant tickets, `address_text` is not a car-collection summary. Do not reuse pickup car fields for this path.

## Config

| Env | Meaning |
| --- | --- |
| `OXIPOS_API_KEY` | Shared secret. Pull API refuses all callers when unset. |
| `OXIPOS_SHOP_IDS` | JSON map of branch slug → shop id, e.g. `{"down-town":"101"}`. |

Give the restaurant: base URL of the **non-pickup** ordering server (`https://…/api/pos/orders/`), shop ids, API key, and the POS SKU CSV from **Admin → Menu → Export POS SKUs** (`GET /api/admin/menu/pos-sku-export`). They fill the blank `oxiposProductId` column and configure `weborder.map.{posSku}={oxiposProductId}` on the POS.

Our `posSku` values are assigned automatically as `SU-{DISH_ID}` in uppercase (e.g. dish `sushinaa-burger` → `SU-SUSHINAA-BURGER`). Stable, unique, and safe for POS map keys.

## Eligibility (in-restaurant / POS path only)

OXiPOS is **kitchen relay for the non-pickup order website**. There is no payment flow on this API — payment is the branch card machine / counter.

Do **not** treat CMS car-collection pickup orders as POS pending tickets. CMS Orders UI owns pickup; POS acceptance only sets `accepted_by_pos_at` on the in-restaurant feed and must not move CMS kitchen status for pickup.

## Live database

Ordering (and this API) refuse the production Turso host until an explicit cutover.
