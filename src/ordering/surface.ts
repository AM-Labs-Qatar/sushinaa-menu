import type { Storefront, StorefrontMode } from "@/storefront/resolve";

/**
 * Which kitchen owns the ticket. One owner for this decision.
 *
 * - `pickup` — car-collection; CMS live Orders only
 * - `restaurant` — guest already in branch; OXiPOS pull only (dormant until cutover)
 * - `staff` — staff-punched at branch; CMS live Orders only (not OXiPOS)
 */
export type OrderSurface = "pickup" | "restaurant" | "staff";

export const ORDER_SURFACE_PICKUP: OrderSurface = "pickup";
export const ORDER_SURFACE_RESTAURANT: OrderSurface = "restaurant";
export const ORDER_SURFACE_STAFF: OrderSurface = "staff";

/** Kitchen destination for a surface. OXiPOS stays restaurant-only. */
export type KitchenDestination = "cms" | "oxipos";

export function kitchenDestination(surface: OrderSurface): KitchenDestination {
  return surface === ORDER_SURFACE_RESTAURANT ? "oxipos" : "cms";
}

/** Map customer storefront mode → order kitchen surface. Never maps to staff. */
export function orderSurfaceFromStorefront(mode: StorefrontMode): OrderSurface {
  return mode === "pickup" ? ORDER_SURFACE_PICKUP : ORDER_SURFACE_RESTAURANT;
}

/**
 * OXiPOS may only call a server that does not expose car-collection pickup.
 * Pickup host / STOREFRONT_MODE=pickup → refuse the pull API.
 */
export function posPullAllowed(storefront: Storefront): boolean {
  return storefront.mode !== "pickup";
}

/**
 * Surfaces that appear on the CMS board (not OXiPOS).
 * Legacy NULL (pre-column) counts as pickup.
 * SQL fragment only — compose with payment visibility at the visibility layer.
 */
export const ORDER_SURFACE_CMS_SQL = `(COALESCE(order_surface, 'pickup') IN ('pickup', 'staff'))`;

/** POS pending list — restaurant surface only; never pickup/staff CMS tickets. */
export const ORDER_SURFACE_POS_SQL = `(order_surface = 'restaurant')`;

export function isOrderSurface(value: unknown): value is OrderSurface {
  return value === "pickup" || value === "restaurant" || value === "staff";
}

/**
 * Kitchen ticket fulfilment line (thermal print / staff ticket).
 */
export function kitchenFulfilmentLabel(surface: OrderSurface): string {
  if (surface === ORDER_SURFACE_RESTAURANT) return "AT RESTAURANT";
  if (surface === ORDER_SURFACE_STAFF) return "STAFF POS";
  return "CAR PICKUP";
}

/**
 * Left phrase on the thermal source row. Staff tickets are punched in Admin,
 * not a website order — omit the website channel label.
 */
export function kitchenChannelLabel(surface: OrderSurface): string {
  if (surface === ORDER_SURFACE_STAFF) return "";
  return "Website order";
}

/**
 * Lead phrase for OXiPOS `address_text` (and similar kitchen copy).
 * Restaurant tickets must not reuse the car-collection summary.
 */
export function kitchenAddressLead(surface: OrderSurface): string {
  if (surface === ORDER_SURFACE_RESTAURANT) return "At restaurant";
  if (surface === ORDER_SURFACE_STAFF) return "At restaurant · staff";
  return "Car collection";
}
