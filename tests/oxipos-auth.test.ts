import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { oxiposAuthorized } from "../src/ordering/vendors/oxipos/auth";

const KEY = "pos-test-key-0123456789abcdef";
const call = (header?: string) =>
  oxiposAuthorized(
    new Request("http://menu.localhost/api/pos/orders?shop_id=101", {
      headers: header === undefined ? {} : { "X-POS-API-Key": header },
    }),
  );

afterEach(() => {
  delete process.env.OXIPOS_API_KEY;
});

test("POS key: refuses every caller when OXIPOS_API_KEY is unset", () => {
  delete process.env.OXIPOS_API_KEY;
  assert.equal(call(KEY), false);
  assert.equal(call(""), false);
  assert.equal(call(), false);
});

test("POS key: missing, empty, wrong, prefix, longer and same-length guesses are refused", () => {
  process.env.OXIPOS_API_KEY = KEY;
  assert.equal(call(), false);
  assert.equal(call(""), false);
  assert.equal(call("   "), false);
  assert.equal(call("wrong"), false);
  assert.equal(call(KEY.slice(0, 10)), false);
  assert.equal(call(`${KEY}x`), false);
  assert.equal(call(`${KEY.slice(0, -1)}X`), false);
});

test("POS key: the exact key is accepted, ignoring surrounding whitespace", () => {
  process.env.OXIPOS_API_KEY = KEY;
  assert.equal(call(KEY), true);
  assert.equal(call(`  ${KEY} `), true);
});
