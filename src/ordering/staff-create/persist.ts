import { randomUUID, createHash } from "node:crypto";
import { db } from "@/cms/db";
import { auditInsert, type AuditContext } from "@/cms/audit";
import { initOrders } from "@/ordering/checkout/repository";
import type { OrderSnapshot } from "@/ordering/checkout/quote";
import { composeOrderNumber, ORDER_NUMBER_FLOOR, orderSequence, qatarDay } from "@/ordering/order-number";
import { ORDER_SURFACE_STAFF } from "@/ordering/surface";
import { COUNTER_PENDING } from "@/ordering/counter-tender";
import { CheckoutError } from "@/ordering/checkout/validation";
import { afterChange } from "@/ordering/write";

function staffSessionHash(username: string) {
  return createHash("sha256").update(`staff:${username}`).digest("hex");
}

export type StaffPersistResult = {
  id: string;
  orderNumber: number;
  totalMinor: number;
  status: "preparing";
  reused: boolean;
};

export async function persistStaffOrder(input: {
  snapshot: OrderSnapshot;
  revision: number;
  plate: string;
  instructions: string;
  idempotencyKey: string;
  createdBy: string;
  ctx: AuditContext;
}): Promise<StaffPersistResult> {
  await initOrders();
  const sessionHash = staffSessionHash(input.createdBy);
  const requestHash = createHash("sha256")
    .update(JSON.stringify({
      branchId: input.snapshot.branchId,
      plate: input.plate,
      instructions: input.instructions,
      lines: input.snapshot.lines,
      totalMinor: input.snapshot.totalMinor,
    }))
    .digest("hex");

  const acquire = async () => {
    for (let n = 0; ; n++) {
      try { return await db.transaction("write"); }
      catch (error) {
        if (n >= 20 || !(error instanceof Error) || !("code" in error) || error.code !== "SQLITE_BUSY") throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (n + 1)));
      }
    }
  };

  const tx = await acquire();
  try {
    const previous = (await tx.execute({
      sql: "SELECT id, order_number, total_minor, status, request_hash FROM orders WHERE session_hash=? AND idempotency_key=?",
      args: [sessionHash, input.idempotencyKey],
    })).rows[0];
    if (previous) {
      if (String(previous.request_hash) !== requestHash) throw new CheckoutError("CONFLICT");
      // Only a live preparing ticket may replay as a successful punch.
      if (String(previous.status) !== "preparing") throw new CheckoutError("CONFLICT");
      await tx.commit();
      return {
        id: String(previous.id),
        orderNumber: Number(previous.order_number),
        totalMinor: Number(previous.total_minor),
        status: "preparing",
        reused: true,
      };
    }

    const id = `SU-${randomUUID()}`;
    const now = new Date().toISOString();
    const day = qatarDay(new Date(now));
    const latest = (await tx.execute({
      sql: "SELECT order_number FROM orders WHERE branch_id=? AND created_at>=? AND created_at<? AND order_number>=? ORDER BY order_number DESC LIMIT 1",
      args: [input.snapshot.branchId, day.start.toISOString(), day.end.toISOString(), ORDER_NUMBER_FLOOR],
    })).rows[0];
    const sequence = latest ? orderSequence(Number(latest.order_number)) + 1 : 1;
    if (sequence > 999) throw new CheckoutError("LIMIT");
    const orderNumber = composeOrderNumber(input.snapshot.branchId, day.month, day.day, sequence);

    const payload = JSON.stringify({
      version: 2,
      menuRevision: input.revision,
      ...input.snapshot,
      customer: {
        ...input.snapshot.customer,
        plate: input.plate,
        instructions: input.instructions,
      },
    });

    await tx.batch([
      {
        sql: `INSERT INTO orders (
          id, session_hash, idempotency_key, request_hash, snapshot, branch_id, order_number,
          total_minor, currency, customer_name, customer_phone, car_plate, car_colour, car_model,
          instructions, created_at, updated_at, payment_method, order_surface, status, created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          id, sessionHash, input.idempotencyKey, requestHash, payload, input.snapshot.branchId, orderNumber,
          input.snapshot.totalMinor, input.snapshot.currency, "", "", input.plate, "", "",
          input.instructions, now, now, COUNTER_PENDING, ORDER_SURFACE_STAFF, "preparing", input.createdBy,
        ],
      },
      {
        sql: "INSERT INTO order_outbox (id,order_id,event,created_at) VALUES (?,?,'order.placed',?)",
        args: [randomUUID(), id, now],
      },
      afterChange(auditInsert(input.ctx, {
        action: "order.created",
        entityType: "order",
        entityId: id,
        diff: { status: { from: null, to: "preparing" }, surface: ORDER_SURFACE_STAFF, createdBy: input.createdBy },
      })),
    ]);
    await tx.commit();
    return { id, orderNumber, totalMinor: input.snapshot.totalMinor, status: "preparing", reused: false };
  } finally {
    tx.close();
  }
}
