import { test } from "node:test";
import assert from "node:assert/strict";
import {
  orderSurfaceFromStorefront,
  posPullAllowed,
  ORDER_SURFACE_PICKUP,
  ORDER_SURFACE_RESTAURANT,
} from "../src/ordering/surface";

test("pickup storefront maps to CMS pickup surface; menu maps to restaurant", () => {
  assert.equal(orderSurfaceFromStorefront("pickup"), ORDER_SURFACE_PICKUP);
  assert.equal(orderSurfaceFromStorefront("menu"), ORDER_SURFACE_RESTAURANT);
});

test("POS pull is refused on pickup storefront and allowed on menu", () => {
  assert.equal(posPullAllowed({ mode: "pickup", channel: "pickup" }), false);
  assert.equal(posPullAllowed({ mode: "menu", channel: "menu" }), true);
});
