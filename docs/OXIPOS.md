# OXiPOS pull API (our contract)

OXiPOS does not push menus into this app. It **pulls** pending online pickup orders from our server about every 30 seconds, then POSTs acceptance.

Depend only on this document and the vendor guide field names. Do not encode poll interval or User-Agent.

## Endpoints we expose

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/pos/orders?shop_id={shop_id}` | Root JSON **array** of pending orders. Empty list is `[]`. |
| `POST` | `/api/pos/orders/{pos_export_id}/accepted/` | Body `{}`. Marks the order accepted; it must not appear in GET again. |

Auth header on every request: `X-POS-API-Key: {OXIPOS_API_KEY}`. Invalid or missing key → `401`.

## Order object (exact names)

`id` (integer `pos_export_id`), `customer_name`, `customer_phone`, `address_text` (car-collection summary), `items[]` with `item_name`, `quantity`, `price_sold`, optional `product_id` (our `posSku`), `options_display`, `notes`.

## Config

| Env | Meaning |
| --- | --- |
| `OXIPOS_API_KEY` | Shared secret. Pull API refuses all callers when unset. |
| `OXIPOS_SHOP_IDS` | JSON map of branch slug → shop id, e.g. `{"down-town":"101"}`. |

Give the restaurant: base URL (`https://…/api/pos/orders/`), shop ids, API key, and the POS SKU CSV from **Admin → Menu → Export POS SKUs** (`GET /api/admin/menu/pos-sku-export`). They fill the blank `oxiposProductId` column and configure `weborder.map.{posSku}={oxiposProductId}` on the POS.

Our `posSku` values are assigned automatically as `SU-{DISH_ID}` in uppercase (e.g. dish `sushinaa-burger` → `SU-SUSHINAA-BURGER`). Stable, unique, and safe for POS map keys.

## Eligibility

OXiPOS is **kitchen relay only**. There is no payment flow on this API. Payment stays on our web checkout or at the counter.

Any non-cancelled placed order is eligible for the pending list (including unpaid online orders). Cancelled orders are excluded. CMS Orders UI stays; acceptance only sets `accepted_by_pos_at`.

## Live database

Ordering (and this API) refuse the production Turso host until an explicit cutover.
