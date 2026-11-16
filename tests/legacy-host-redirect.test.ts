import { test } from "node:test";
import assert from "node:assert/strict";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";

function request(host: string, path = "/down-town?x=1") {
  return new NextRequest(new URL(path, "https://example.invalid"), {
    headers: { host },
  });
}

test("legacy vercel.app host redirects to menu.sushinaa.qa preserving path and query", () => {
  const res = proxy(request("sushinaa-menu.vercel.app"));
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "https://menu.sushinaa.qa/down-town?x=1");
});

test("menu and order hosts are not redirected", () => {
  assert.equal(proxy(request("menu.sushinaa.qa")).status, 200);
  assert.equal(proxy(request("order.sushinaa.qa")).headers.get("location"), null);
  assert.equal(proxy(request("order.sushinaa.qa")).status, 200);
});
