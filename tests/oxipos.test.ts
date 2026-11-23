import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { menuSchema } from "../src/cms/schema";
import { checkoutSchema } from "../src/ordering/checkout/validation";
import { quoteOrder } from "../src/ordering/checkout/quote";
import { defaultSelection, unitPrice } from "../src/ordering/price";
import {
  ORDER_SURFACE_PICKUP,
  ORDER_SURFACE_RESTAURANT,
} from "../src/ordering/surface";
import { toOxiposOrder } from "../src/ordering/vendors/oxipos/map-order";

const sampleLines = [
  {
    dishId: "d1",
    name: "California Roll",
    nameAr: "كاليفورنيا",
    kind: { type: "simple" as const, priceQar: 25 },
    freeDips: undefined,
    extras: undefined,
    categoryId: "c",
    categoryName: "Rolls",
    categoryNameAr: "",
    categoryOrder: 0,
    selection: { size: "8" },
    quantity: 2,
    note: "No mayo",
    unitMinor: 2500,
    totalMinor: 5000,
    posSku: "SKU-CALI",
  },
];

test("toOxiposOrder maps At restaurant and SKU with exact field names", () => {
  const order = toOxiposOrder({
    posExportId: 42,
    branchName: "Down Town",
    customerName: "Ali",
    customerPhone: "97455551234",
    instructions: "window seat",
    lines: sampleLines,
  });
  assert.equal(order.id, 42);
  assert.equal(order.customer_name, "Ali");
  assert.equal(order.customer_phone, "+97455551234");
  assert.equal(order.address_text, "At restaurant · Down Town · window seat");
  assert.doesNotMatch(order.address_text!, /Car collection|Plate|Camry/);
  assert.equal(order.items.length, 1);
  assert.deepEqual(order.items[0], {
    item_name: "California Roll",
    quantity: 2,
    price_sold: 25,
    product_id: "SKU-CALI",
    options_display: "size: 8",
    notes: "No mayo",
  });
  assert.equal(JSON.parse(JSON.stringify(order)) instanceof Array, false);
});

let dir: string;
const menu = menuSchema.parse(
  JSON.parse(readFileSync("data/initial-menu.json", "utf8")),
);
const dish = menu.dishes.find(
  (d) =>
    d.channels.pickup.visible &&
    d.channels.pickup.available &&
    d.kind.type === "simple",
)!;
dish.posSku = "SKU-TEST-01";

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "sn-oxipos-"));
  process.env.CMS_DATABASE_URL = `file:${dir}/orders.db`;
  process.env.CMS_DATABASE_AUTH_TOKEN = "";
  process.env.CMS_ENV_GUARD = "report";
  process.env.VERCEL = "";
  process.env.VERCEL_ENV = "preview";
  process.env.OXIPOS_API_KEY = "test-pos-key";
  process.env.OXIPOS_SHOP_IDS = JSON.stringify({ "down-town": "101" });
  delete process.env.STOREFRONT_MODE;
  const { seedMenu } = await import("../src/cms/repository");
  await seedMenu(menu);
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.OXIPOS_API_KEY;
  delete process.env.OXIPOS_SHOP_IDS;
  delete process.env.STOREFRONT_MODE;
});

async function placeOrder(
  paymentMethod: "pay_at_pickup" | "mock",
  surface: typeof ORDER_SURFACE_PICKUP | typeof ORDER_SURFACE_RESTAURANT,
  name: string,
  plate: string,
) {
  const { persistPendingOrder } = await import(
    "../src/ordering/checkout/repository"
  );
  const session = randomBytes(32).toString("hex");
  const selection = defaultSelection(dish);
  const input = checkoutSchema.parse({
    branchId: "down-town",
    paymentMethod,
    customer: {
      name,
      phone: "97455551234",
      brand: "toyota",
      plate,
      colour: "",
      car: "",
      instructions: "",
    },
    lines: [
      {
        dishId: dish.id,
        selection,
        quantity: 1,
        note: "",
        expectedUnitMinor: Math.round(unitPrice(dish, selection) * 100),
      },
    ],
  });
  const snapshot = await quoteOrder(input, menu, new Date("2026-10-22T15:00:00+03:00"));
  return persistPendingOrder(
    session,
    `pos-${randomUUID()}`.slice(0, 80),
    `hash-${plate}`,
    snapshot,
    1,
    paymentMethod,
    surface,
  );
}

test("POS pull refuses the pickup storefront even with a valid key", async () => {
  const listRoute = await import("../src/app/api/pos/orders/route");
  process.env.STOREFRONT_MODE = "pickup";
  const denied = await listRoute.GET(
    new Request("http://localhost/api/pos/orders?shop_id=101", {
      headers: { "X-POS-API-Key": "test-pos-key" },
    }),
  );
  assert.equal(denied.status, 503);
  assert.deepEqual(await denied.json(), { code: "POS_UNAVAILABLE_ON_PICKUP" });
  delete process.env.STOREFRONT_MODE;
});

test("pickup-surface orders never appear in the POS pending list", async () => {
  const listRoute = await import("../src/app/api/pos/orders/route");
  await placeOrder("pay_at_pickup", ORDER_SURFACE_PICKUP, "Pickup Guest", "Q999");
  const listed = await listRoute.GET(
    new Request("http://menu.localhost/api/pos/orders?shop_id=101", {
      headers: { "X-POS-API-Key": "test-pos-key" },
    }),
  );
  assert.equal(listed.status, 200);
  const body = await listed.json();
  assert.ok(Array.isArray(body));
  assert.equal(
    body.filter((o: { customer_name: string }) => o.customer_name === "Pickup Guest")
      .length,
    0,
  );
});

test("GET pending list is a root array; accept removes the restaurant order", async () => {
  const listRoute = await import("../src/app/api/pos/orders/route");
  const acceptRoute = await import(
    "../src/app/api/pos/orders/[id]/accepted/route"
  );

  await placeOrder("pay_at_pickup", ORDER_SURFACE_RESTAURANT, "POS Guest", "Q888");

  const unauthorized = await listRoute.GET(
    new Request("http://menu.localhost/api/pos/orders?shop_id=101"),
  );
  assert.equal(unauthorized.status, 401);

  const headers = { "X-POS-API-Key": "test-pos-key" };
  const listed = await listRoute.GET(
    new Request("http://menu.localhost/api/pos/orders?shop_id=101", {
      headers,
    }),
  );
  assert.equal(listed.status, 200);
  const body = await listed.json();
  assert.ok(Array.isArray(body));
  const mine = body.filter(
    (o: { customer_name: string }) => o.customer_name === "POS Guest",
  );
  assert.equal(mine.length, 1);
  assert.equal(typeof mine[0].id, "number");
  assert.equal(mine[0].items[0].product_id, "SKU-TEST-01");

  const emptyShop = await listRoute.GET(
    new Request("http://menu.localhost/api/pos/orders?shop_id=999", {
      headers,
    }),
  );
  assert.deepEqual(await emptyShop.json(), []);

  const posId = mine[0].id as number;
  assert.match(mine[0].address_text ?? "", /^At restaurant/);
  assert.doesNotMatch(mine[0].address_text ?? "", /Car collection/);

  const accepted = await acceptRoute.POST(
    new Request(
      `http://menu.localhost/api/pos/orders/${posId}/accepted/`,
      { method: "POST", headers, body: "{}" },
    ),
    { params: Promise.resolve({ id: String(posId) }) },
  );
  assert.equal(accepted.status, 200);

  const again = await listRoute.GET(
    new Request("http://menu.localhost/api/pos/orders?shop_id=101", {
      headers,
    }),
  );
  const againBody = await again.json();
  assert.equal(
    againBody.filter((o: { customer_name: string }) => o.customer_name === "POS Guest")
      .length,
    0,
  );

  const idempotent = await acceptRoute.POST(
    new Request(
      `http://menu.localhost/api/pos/orders/${posId}/accepted/`,
      { method: "POST", headers, body: "{}" },
    ),
    { params: Promise.resolve({ id: String(posId) }) },
  );
  assert.equal(idempotent.status, 200);
});

test("POST accepted with and without trailing slash returns the same result", async () => {
  const listRoute = await import("../src/app/api/pos/orders/route");
  const acceptRoute = await import(
    "../src/app/api/pos/orders/[id]/accepted/route"
  );
  const { rewritePosTrailingSlash } = await import("../src/proxy");

  await placeOrder("pay_at_pickup", ORDER_SURFACE_RESTAURANT, "Slash Guest", "Q777");
  const headers = { "X-POS-API-Key": "test-pos-key" };
  const listed = await listRoute.GET(
    new Request("http://menu.localhost/api/pos/orders?shop_id=101", { headers }),
  );
  const mine = (await listed.json()).filter(
    (o: { customer_name: string }) => o.customer_name === "Slash Guest",
  );
  assert.equal(mine.length, 1);
  const posId = mine[0].id as number;

  const withSlash = `/api/pos/orders/${posId}/accepted/`;
  const withoutSlash = `/api/pos/orders/${posId}/accepted`;
  assert.equal(rewritePosTrailingSlash(withSlash), withoutSlash);
  assert.equal(rewritePosTrailingSlash(withoutSlash), null);

  const first = await acceptRoute.POST(
    new Request(`http://menu.localhost${withSlash}`, {
      method: "POST",
      headers,
      body: "{}",
    }),
    { params: Promise.resolve({ id: String(posId) }) },
  );
  const second = await acceptRoute.POST(
    new Request(`http://menu.localhost${withoutSlash}`, {
      method: "POST",
      headers,
      body: "{}",
    }),
    { params: Promise.resolve({ id: String(posId) }) },
  );
  const firstBody = await first.text();
  const secondBody = await second.text();
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(firstBody, secondBody);
});

test("unpaid restaurant orders still pull for POS (payment is out of band)", async () => {
  const listRoute = await import("../src/app/api/pos/orders/route");
  await placeOrder("mock", ORDER_SURFACE_RESTAURANT, "Unpaid Guest", "Q111");
  const listed = await listRoute.GET(
    new Request("http://menu.localhost/api/pos/orders?shop_id=101", {
      headers: { "X-POS-API-Key": "test-pos-key" },
    }),
  );
  const body = await listed.json();
  assert.ok(Array.isArray(body));
  assert.ok(
    body.some((o: { customer_name: string }) => o.customer_name === "Unpaid Guest"),
  );
});
