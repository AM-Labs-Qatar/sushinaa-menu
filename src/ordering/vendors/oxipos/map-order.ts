import type { OrderSnapshot } from "@/ordering/checkout/quote";

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

export type PosExportSource = {
  posExportId: number;
  branchName: string;
  customerName: string;
  customerPhone: string;
  plate: string;
  brand: string;
  car: string;
  colour: string;
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

function addressText(source: PosExportSource): string {
  const bits = [
    "Car collection",
    source.branchName,
    source.plate ? `Plate ${source.plate}` : "",
    [source.brand, source.car, source.colour].filter(Boolean).join(" "),
    source.instructions,
  ].filter(Boolean);
  return bits.join(" · ");
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
