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
import { toOxiposOrder } from "../src/ordering/vendors/oxipos/map-order";

test("toOxiposOrder maps car collection and SKU with exact field names", () => {
  const order = toOxiposOrder({
    posExportId: 42,
    branchName: "Down Town",
    customerName: "Ali",
    customerPhone: "97455551234",
    plate: "Q123",
    brand: "toyota",
    car: "Camry",
    colour: "white",
    instructions: "gate 2",
    lines: [
      {
        dishId: "d1",
        name: "California Roll",
        nameAr: "كاليفورنيا",
        kind: { type: "simple", priceQar: 25 },
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
    ],
  });
  assert.equal(order.id, 42);
  assert.equal(order.customer_name, "Ali");
  assert.equal(order.customer_phone, "+97455551234");
  assert.match(order.address_text!, /Car collection/);
  assert.match(order.address_text!, /Plate Q123/);
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
  process.env.STOREFRONT_MODE = "pickup";
  const { seedMenu } = await import("../src/cms/repository");
  await seedMenu(menu);
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.OXIPOS_API_KEY;
  delete process.env.OXIPOS_SHOP_IDS;
  delete process.env.STOREFRONT_MODE;
});

test("GET pending list is a root array; accept removes the order", async () => {
  const { persistPendingOrder } = await import(
    "../src/ordering/checkout/repository"
  );
  const listRoute = await import("../src/app/api/pos/orders/route");
  const acceptRoute = await import(
    "../src/app/api/pos/orders/[id]/accepted/route"
  );

  const session = randomBytes(32).toString("hex");
  const selection = defaultSelection(dish);
  const input = checkoutSchema.parse({
    branchId: "down-town",
    paymentMethod: "pay_at_pickup",
    customer: {
      name: "POS Guest",
      phone: "97455551234",
      brand: "toyota",
      plate: "Q999",
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
  const placed = await persistPendingOrder(
    session,
    `pos-${randomUUID()}`.slice(0, 80),
    "hash",
    snapshot,
    1,
    "pay_at_pickup",
  );
  assert.ok(placed.id);

  const unauthorized = await listRoute.GET(
    new Request("http://order.localhost/api/pos/orders?shop_id=101"),
  );
  assert.equal(unauthorized.status, 401);

  const headers = { "X-POS-API-Key": "test-pos-key" };
  const listed = await listRoute.GET(
    new Request("http://order.localhost/api/pos/orders?shop_id=101", {
      headers,
    }),
  );
  assert.equal(listed.status, 200);
  const body = await listed.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 1);
  assert.equal(typeof body[0].id, "number");
  assert.equal(body[0].items[0].product_id, "SKU-TEST-01");

  const emptyShop = await listRoute.GET(
    new Request("http://order.localhost/api/pos/orders?shop_id=999", {
      headers,
    }),
  );
  assert.deepEqual(await emptyShop.json(), []);

  const posId = body[0].id as number;
  const accepted = await acceptRoute.POST(
    new Request(
      `http://order.localhost/api/pos/orders/${posId}/accepted/`,
      { method: "POST", headers, body: "{}" },
    ),
    { params: Promise.resolve({ id: String(posId) }) },
  );
  assert.equal(accepted.status, 200);

  const again = await listRoute.GET(
    new Request("http://order.localhost/api/pos/orders?shop_id=101", {
      headers,
    }),
  );
  assert.deepEqual(await again.json(), []);

  const idempotent = await acceptRoute.POST(
    new Request(
      `http://order.localhost/api/pos/orders/${posId}/accepted/`,
      { method: "POST", headers, body: "{}" },
    ),
    { params: Promise.resolve({ id: String(posId) }) },
  );
  assert.equal(idempotent.status, 200);
});

test("unpaid online orders are still pulled for the kitchen (no payment on POS)", async () => {
  const { persistPendingOrder } = await import(
    "../src/ordering/checkout/repository"
  );
  const listRoute = await import("../src/app/api/pos/orders/route");
  const session = randomBytes(32).toString("hex");
  const selection = defaultSelection(dish);
  const input = checkoutSchema.parse({
    branchId: "down-town",
    paymentMethod: "mock",
    customer: {
      name: "Unpaid Guest",
      phone: "97455550000",
      brand: "toyota",
      plate: "Q111",
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
  const snapshot = await quoteOrder(
    input,
    menu,
    new Date("2026-10-22T15:00:00+03:00"),
  );
  await persistPendingOrder(
    session,
    `pos-unpaid-${randomUUID()}`.slice(0, 80),
    "hash-unpaid",
    snapshot,
    1,
    "mock",
  );
  const listed = await listRoute.GET(
    new Request("http://order.localhost/api/pos/orders?shop_id=101", {
      headers: { "X-POS-API-Key": "test-pos-key" },
    }),
  );
  const body = await listed.json();
  assert.ok(Array.isArray(body));
  assert.ok(body.some((o: { customer_name: string }) => o.customer_name === "Unpaid Guest"));
});
