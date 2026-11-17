import type { MenuChannel } from "@/cms/schema";

/** Which customer surface this request is on. Matches catalog channels. */
export type StorefrontMode = MenuChannel; // "menu" | "pickup"
export type Storefront = { channel: MenuChannel; mode: StorefrontMode };

function hostName(hostHeader: string | null | undefined): string {
  return (hostHeader ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];
}

function parseMode(raw: string | undefined): StorefrontMode | undefined {
  const value = raw?.trim().toLowerCase();
  if (value === "pickup" || value === "order") return "pickup";
  if (value === "menu" || value === "browse") return "menu";
  return undefined;
}

/**
 * Maps the request host (and optional STOREFRONT_MODE override) to a storefront.
 *
 * - `menu` — on-site ordering (`menu.*`) → OXiPOS kitchen; not Sadad
 * - `pickup` — car-collection on `order.*` → CMS kitchen + Sadad
 *
 * Host `order.*` → pickup. Anything else → menu.
 * Env override: STOREFRONT_MODE=pickup|menu (legacy aliases: order|browse).
 */
export function storefrontFromHost(hostHeader: string | null | undefined): Storefront {
  const forced = parseMode(process.env.STOREFRONT_MODE);
  if (forced) return { channel: forced, mode: forced };
  const host = hostName(hostHeader);
  if (host.startsWith("order.")) return { channel: "pickup", mode: "pickup" };
  return { channel: "menu", mode: "menu" };
}

export function storefrontFromRequest(request: Request): Storefront {
  return storefrontFromHost(request.headers.get("host"));
}

export function isPickupStorefront(storefront: Storefront): boolean {
  return storefront.mode === "pickup";
}
