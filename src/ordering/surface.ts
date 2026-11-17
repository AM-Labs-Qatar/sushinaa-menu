import type { Storefront, StorefrontMode } from "@/storefront/resolve";

/**
 * Which kitchen owns the ticket. One owner for this decision.
 *
 * - `pickup` — car-collection; CMS live Orders only
 * - `restaurant` — guest already in branch; OXiPOS pull only
 */
export type OrderSurface = "pickup" | "restaurant";

export const ORDER_SURFACE_PICKUP: OrderSurface = "pickup";
export const ORDER_SURFACE_RESTAURANT: OrderSurface = "restaurant";

/** Map customer storefront mode → order kitchen surface. */
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
 * CMS board rows. Legacy NULL (pre-column) counts as pickup.
 * SQL fragment only — compose with payment visibility at the visibility layer.
 */
export const ORDER_SURFACE_CMS_SQL = `(COALESCE(order_surface, 'pickup') = 'pickup')`;

/** POS pending list — restaurant surface only; never pickup/CMS tickets. */
export const ORDER_SURFACE_POS_SQL = `(order_surface = 'restaurant')`;

export function isOrderSurface(value: unknown): value is OrderSurface {
  return value === "pickup" || value === "restaurant";
}

/**
 * Kitchen ticket fulfilment line (thermal print / staff ticket).
 * Pickup = car collection; restaurant = guest already in branch.
 */
export function kitchenFulfilmentLabel(surface: OrderSurface): string {
  return surface === ORDER_SURFACE_RESTAURANT ? "AT RESTAURANT" : "CAR PICKUP";
}

/**
 * Lead phrase for OXiPOS `address_text` (and similar kitchen copy).
 * Restaurant tickets must not reuse the car-collection summary.
 */
export function kitchenAddressLead(surface: OrderSurface): string {
  return surface === ORDER_SURFACE_RESTAURANT ? "At restaurant" : "Car collection";
}
