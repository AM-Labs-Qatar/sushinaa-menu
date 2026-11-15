import { test } from "node:test";
import assert from "node:assert/strict";
import { storefrontFromHost } from "../src/storefront/resolve";

function withStorefrontMode<T>(mode: string | undefined, run: () => T): T {
  const previous = process.env.STOREFRONT_MODE;
  try {
    if (mode === undefined) delete process.env.STOREFRONT_MODE;
    else process.env.STOREFRONT_MODE = mode;
    return run();
  } finally {
    if (previous === undefined) delete process.env.STOREFRONT_MODE;
    else process.env.STOREFRONT_MODE = previous;
  }
}

test("order subdomain selects the pickup storefront", () => {
  withStorefrontMode(undefined, () => {
    assert.deepEqual(storefrontFromHost("order.sushinaamenu.qa"), {
      channel: "pickup",
      mode: "pickup",
    });
    assert.deepEqual(storefrontFromHost("order.localhost:3005"), {
      channel: "pickup",
      mode: "pickup",
    });
  });
});

test("apex and preview hosts select the menu storefront", () => {
  withStorefrontMode(undefined, () => {
    assert.deepEqual(storefrontFromHost("sushinaamenu.qa"), {
      channel: "menu",
      mode: "menu",
    });
    assert.deepEqual(storefrontFromHost("localhost:3005"), {
      channel: "menu",
      mode: "menu",
    });
    assert.deepEqual(
      storefrontFromHost("test-dev-abu-iqbal-projects.vercel.app"),
      { channel: "menu", mode: "menu" },
    );
  });
});

test("STOREFRONT_MODE pickup|menu overrides the host (order|browse still accepted)", () => {
  withStorefrontMode("pickup", () => {
    assert.equal(storefrontFromHost("sushinaamenu.qa").mode, "pickup");
  });
  withStorefrontMode("menu", () => {
    assert.equal(storefrontFromHost("order.sushinaamenu.qa").mode, "menu");
  });
  withStorefrontMode("order", () => {
    assert.equal(storefrontFromHost("sushinaamenu.qa").mode, "pickup");
  });
  withStorefrontMode("browse", () => {
    assert.equal(storefrontFromHost("order.sushinaamenu.qa").mode, "menu");
  });
});
