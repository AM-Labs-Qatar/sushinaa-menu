import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

test("PWA install icons are present for home-screen install", () => {
  for (const path of [
    "public/icon-192.png",
    "public/icon-512.png",
    "public/apple-touch-icon.png",
    "public/favicon-32.png",
  ]) {
    assert.ok(existsSync(path), path);
  }
});
