import { randomUUID } from "node:crypto";
import type { SqlStatement } from "@/cms/sql";
import { markAttemptPaidStatement } from "./payment-attempt";
import { redeemHeldCouponStatement } from "./coupons/repository";
import {
  COUNTER_PENDING,
  paymentMethodFromTenders,
  type TenderLine,
} from "./counter-tender";

/**
 * Statements to settle a staff counter order with tender lines.
 * Caller runs them in the status batch after changes()=1 on the status UPDATE.
 * Server-only — do not import from client components.
 */
export function counterTenderSettlementStatements(
  orderId: string,
  at: string,
  tenders: TenderLine[],
): SqlStatement[] {
  const method = paymentMethodFromTenders(tenders);
  return [
    {
      sql: `UPDATE orders SET paid_at=COALESCE(paid_at, ?), payment_method=? WHERE id=? AND payment_method=? AND changes()=1`,
      args: [at, method, orderId, COUNTER_PENDING],
    },
    ...tenders.map((line) => ({
      sql: `INSERT INTO order_tenders (id, order_id, kind, amount_minor, created_at)
        SELECT ?,?,?,?,? WHERE changes()=1`,
      args: [randomUUID(), orderId, line.kind, line.amountMinor, at] as (string | number)[],
    })),
    { sql: "INSERT OR IGNORE INTO order_outbox (id,order_id,event,created_at) SELECT ?,?,'order.paid',? WHERE changes()=1", args: [randomUUID(), orderId, at] },
    { sql: "INSERT OR IGNORE INTO order_events (id,order_id,provider_event,type,created_at) SELECT ?,?,?,?,? WHERE changes()=1", args: [randomUUID(), orderId, `counter:${orderId}`, "counter.paid", at] },
    markAttemptPaidStatement(orderId, at),
    redeemHeldCouponStatement(orderId, at),
  ];
}
