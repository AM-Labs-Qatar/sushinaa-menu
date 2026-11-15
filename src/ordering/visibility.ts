import { ORDER_SURFACE_CMS_SQL } from "./surface";

/** Payment gate for a kitchen ticket: pay-at-pickup, or online after paid_at. */
export const KITCHEN_VISIBLE = "(payment_method='pay_at_pickup' OR paid_at IS NOT NULL)";

/**
 * CMS live Orders board: payment-visible **and** car-collection (pickup) surface.
 * Restaurant / POS tickets never appear here.
 */
export const CMS_KITCHEN = `(${KITCHEN_VISIBLE}) AND ${ORDER_SURFACE_CMS_SQL}`;
