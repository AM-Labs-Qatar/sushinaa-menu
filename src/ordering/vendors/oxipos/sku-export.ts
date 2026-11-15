import type { MenuData } from "@/cms/schema";

/** One row for the restaurant mapping spreadsheet (OXiPOS `weborder.map`). */
export type PosSkuExportRow = {
  posSku: string;
  dishId: string;
  name: string;
  nameAr: string;
  category: string;
  onPickup: boolean;
  onMenu: boolean;
};

/**
 * Pickup-channel dishes that have a POS SKU, for the OXiPOS product map.
 * Sorted by category order then dish order.
 */
export function posSkuExportRows(menu: MenuData): PosSkuExportRow[] {
  const categories = [...menu.categories].sort((a, b) => a.order - b.order);
  const bySection = new Map(categories.map((c) => [c.id, c]));
  const rows: PosSkuExportRow[] = [];
  for (const category of categories) {
    const dishes = menu.dishes
      .filter((d) => d.section === category.id && d.posSku)
      .sort((a, b) => a.order - b.order);
    for (const dish of dishes) {
      rows.push({
        posSku: dish.posSku!,
        dishId: dish.id,
        name: dish.name,
        nameAr: dish.nameAr,
        category: bySection.get(dish.section)?.name ?? dish.section,
        onPickup: dish.channels.pickup.visible && dish.channels.pickup.available,
        onMenu: dish.channels.menu.visible,
      });
    }
  }
  return rows;
}

function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return `"${s.replaceAll('"', '""')}"`;
}

/** CSV with a blank OXiPOS product ID column for the restaurant to fill. */
export function posSkuExportCsv(menu: MenuData): string {
  const header = [
    "posSku",
    "name",
    "nameAr",
    "dishId",
    "category",
    "onPickup",
    "onMenu",
    "oxiposProductId",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of posSkuExportRows(menu)) {
    lines.push(
      [
        row.posSku,
        row.name,
        row.nameAr,
        row.dishId,
        row.category,
        row.onPickup ? "yes" : "no",
        row.onMenu ? "yes" : "no",
        "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}
