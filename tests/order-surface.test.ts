import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kitchenDestination,
  kitchenFulfilmentLabel,
  orderSurfaceFromStorefront,
  posPullAllowed,
  ORDER_SURFACE_CMS_SQL,
  ORDER_SURFACE_PICKUP,
  ORDER_SURFACE_RESTAURANT,
  ORDER_SURFACE_STAFF,
} from "../src/ordering/surface";
import { CMS_KITCHEN } from "../src/ordering/visibility";

test("pickup storefront maps to CMS pickup surface; menu maps to restaurant", () => {
  assert.equal(orderSurfaceFromStorefront("pickup"), ORDER_SURFACE_PICKUP);
  assert.equal(orderSurfaceFromStorefront("menu"), ORDER_SURFACE_RESTAURANT);
});

test("POS pull is refused on pickup storefront and allowed on menu", () => {
  assert.equal(posPullAllowed({ mode: "pickup", channel: "pickup" }), false);
  assert.equal(posPullAllowed({ mode: "menu", channel: "menu" }), true);
});

test("staff surface is CMS kitchen, never OXiPOS", () => {
  assert.equal(kitchenDestination(ORDER_SURFACE_STAFF), "cms");
  assert.equal(kitchenDestination(ORDER_SURFACE_RESTAURANT), "oxipos");
  assert.equal(kitchenFulfilmentLabel(ORDER_SURFACE_STAFF), "STAFF POS");
  assert.match(ORDER_SURFACE_CMS_SQL, /staff/);
  assert.match(CMS_KITCHEN, /order_surface = 'staff'/);
});
