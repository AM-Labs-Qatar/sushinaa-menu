import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultPosSku, menuSchema } from "../src/cms/schema";
import {
  posSkuExportCsv,
  posSkuExportRows,
} from "../src/ordering/vendors/oxipos/sku-export";

const menu = menuSchema.parse(
  JSON.parse(readFileSync("data/initial-menu.json", "utf8")),
);

test("defaultPosSku is brand prefix plus uppercased dish id", () => {
  assert.equal(defaultPosSku("sushinaa-burger"), "SU-SUSHINAA-BURGER");
});

test("every seeded dish has a stable posSku and export lists them", () => {
  assert.equal(menu.dishes.length, 74);
  for (const dish of menu.dishes) {
    assert.equal(dish.posSku, defaultPosSku(dish.id));
  }
  const rows = posSkuExportRows(menu);
  assert.equal(rows.length, 74);
  assert.equal(rows[0]!.posSku, "SU-SUSHINAA-BURGER");

  const csv = posSkuExportCsv(menu);
  assert.match(csv, /oxiposProductId/);
  assert.match(csv, /SU-SUSHINAA-BURGER/);
  assert.match(csv, /SU-MARIO-ROLL/);
});

test("normalize backfills a missing posSku from the dish id", () => {
  const raw = structuredClone(menu) as {
    dishes: { id: string; posSku?: string }[];
  };
  delete raw.dishes[0]!.posSku;
  const normalized = menuSchema.parse(raw);
  assert.equal(normalized.dishes[0]!.posSku, defaultPosSku(normalized.dishes[0]!.id));
});
