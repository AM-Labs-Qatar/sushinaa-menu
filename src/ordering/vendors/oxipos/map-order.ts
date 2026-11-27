import type { OrderSnapshot } from "@/ordering/checkout/quote";
import {
  kitchenAddressLead,
  ORDER_SURFACE_RESTAURANT,
} from "@/ordering/surface";

/** OXiPOS pending-order item (exact field names from their guide). */
export type OxiposItem = {
  item_name: string;
  quantity: number;
  price_sold: number;
  product_id?: string;
  options_display?: string;
  notes?: string;
};

/** OXiPOS pending-order object (exact field names from their guide). */
export type OxiposOrder = {
  id: number;
  customer_name: string;
  customer_phone: string;
  address_text?: string;
  items: OxiposItem[];
};

/**
 * POS export is restaurant-surface only (never car-collection pickup).
 * No plate / car fields — payment and car pickup stay off this path.
 */
export type PosExportSource = {
  posExportId: number;
  branchName: string;
  customerName: string;
  customerPhone: string;
  instructions: string;
  lines: OrderSnapshot["lines"];
};

function phoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return phone;
  return phone.startsWith("+") ? `+${digits}` : `+${digits}`;
}

function optionsDisplay(selection: OrderSnapshot["lines"][number]["selection"]): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(selection ?? {})) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      parts.push(`${key}: ${value.join(", ")}`);
    } else {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.join("; ");
}

/** In-restaurant ticket line — never car-collection copy. */
function addressText(source: PosExportSource): string {
  return [
    kitchenAddressLead(ORDER_SURFACE_RESTAURANT),
    source.branchName,
    source.instructions,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Maps our order row into the OXiPOS JSON object. Pure; no I/O. */
export function toOxiposOrder(source: PosExportSource): OxiposOrder {
  const items: OxiposItem[] = source.lines.map((line) => {
    const item: OxiposItem = {
      item_name: line.name,
      quantity: line.quantity,
      price_sold: Number((line.unitMinor / 100).toFixed(2)),
    };
    if (line.posSku) item.product_id = line.posSku;
    const options = optionsDisplay(line.selection);
    if (options) item.options_display = options;
    if (line.note) item.notes = line.note;
    return item;
  });
  return {
    id: source.posExportId,
    customer_name: source.customerName,
    customer_phone: phoneE164(source.customerPhone),
    address_text: addressText(source),
    items,
  };
}
