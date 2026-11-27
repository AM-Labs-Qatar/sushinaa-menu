import { ORDER_SURFACE_CMS_SQL } from "./surface";

/** Payment gate for a pickup kitchen ticket: pay-at-pickup, or online after paid_at. */
export const KITCHEN_VISIBLE = "(payment_method='pay_at_pickup' OR paid_at IS NOT NULL)";

/**
 * CMS live Orders board.
 * - Pickup: payment-visible (pay-at-pickup or paid).
 * - Staff: always (counter unsettled or settled cash/card/split).
 * Restaurant / OXiPOS tickets never appear here.
 */
export const CMS_KITCHEN = `(((COALESCE(order_surface, 'pickup') = 'pickup' AND ${KITCHEN_VISIBLE}) OR (order_surface = 'staff')) AND ${ORDER_SURFACE_CMS_SQL})`;
