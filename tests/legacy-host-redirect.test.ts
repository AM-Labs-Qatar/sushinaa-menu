import { test } from "node:test";
import assert from "node:assert/strict";
import { proxy, rewritePosTrailingSlash } from "../src/proxy";
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

test("admin host serves CMS at / and /login via rewrite", () => {
  const home = proxy(request("admin.sushinaa.qa", "/"));
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("x-middleware-rewrite"), "https://example.invalid/admin");
  assert.equal(home.headers.get("location"), null);

  const login = proxy(request("admin.sushinaa.qa", "/login"));
  assert.equal(login.status, 200);
  assert.equal(login.headers.get("x-middleware-rewrite"), "https://example.invalid/admin/login");
});

test("admin host canonicalizes /admin URLs to the root paths", () => {
  const root = proxy(request("admin.sushinaa.qa", "/admin"));
  assert.equal(root.status, 308);
  assert.equal(new URL(root.headers.get("location")!).pathname, "/");

  const login = proxy(request("admin.sushinaa.qa", "/admin/login?next=1"));
  assert.equal(login.status, 308);
  const loc = new URL(login.headers.get("location")!);
  assert.equal(loc.pathname, "/login");
  assert.equal(loc.search, "?next=1");
});

test("POS trailing-slash paths rewrite without a redirect", () => {
  assert.equal(
    rewritePosTrailingSlash("/api/pos/orders/42/accepted/"),
    "/api/pos/orders/42/accepted",
  );
  assert.equal(rewritePosTrailingSlash("/api/pos/orders/"), "/api/pos/orders");
  assert.equal(rewritePosTrailingSlash("/api/pos/orders/42/accepted"), null);

  const res = proxy(
    request("menu.sushinaa.qa", "/api/pos/orders/42/accepted/?x=1"),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("location"), null);
  assert.equal(
    res.headers.get("x-middleware-rewrite"),
    "https://example.invalid/api/pos/orders/42/accepted?x=1",
  );
});
