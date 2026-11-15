import { initDb, db, databaseUrl } from "@/cms/db";
import { orderDatabaseAllowed, OrderingUnavailable } from "@/ordering/guard";
import type { BranchId } from "@/branches/branches";
import type { OrderSnapshot } from "@/ordering/checkout/quote";
import { ORDER_SURFACE_POS_SQL } from "@/ordering/surface";
import { toOxiposOrder, type OxiposOrder, type PosExportSource } from "./map-order";

/**
 * Restaurant-surface tickets only. Pickup/CMS orders never enter this list.
 * Payment stays out of band (card machine / counter) for this path.
 */
const POS_EXPORT_ELIGIBLE = `status NOT IN ('cancelled') AND ${ORDER_SURFACE_POS_SQL}`;

async function requireOrderDb() {
  if (!orderDatabaseAllowed(databaseUrl)) throw new OrderingUnavailable();
  await initDb();
}

function sourceFromRow(row: Record<string, unknown>): PosExportSource | null {
  const posExportId = Number(row.pos_export_id);
  if (!Number.isInteger(posExportId) || posExportId < 1) return null;
  let snapshot: OrderSnapshot & { branchName?: string };
  try {
    snapshot = JSON.parse(String(row.snapshot)) as OrderSnapshot & {
      branchName?: string;
    };
  } catch {
    return null;
  }
  if (!Array.isArray(snapshot.lines) || !snapshot.lines.length) return null;
  return {
    posExportId,
    branchName: snapshot.branchName || String(row.branch_id || ""),
    customerName: String(row.customer_name || snapshot.customer?.name || ""),
    customerPhone: String(row.customer_phone || snapshot.customer?.phone || ""),
    plate: String(row.car_plate || snapshot.customer?.plate || ""),
    brand: String(snapshot.customer?.brand || ""),
    car: String(row.car_model || snapshot.customer?.car || ""),
    colour: String(row.car_colour || snapshot.customer?.colour || ""),
    instructions: String(row.instructions || snapshot.customer?.instructions || ""),
    lines: snapshot.lines,
  };
}

/** Assign integer export ids once, outside checkout concurrency. */
async function ensurePosExportIds(branchId: BranchId) {
  const missing = await db.execute({
    sql: `SELECT id FROM orders
      WHERE branch_id=? AND accepted_by_pos_at IS NULL AND pos_export_id IS NULL
        AND ${POS_EXPORT_ELIGIBLE}
      ORDER BY created_at ASC, id ASC
      LIMIT 100`,
    args: [branchId],
  });
  for (const row of missing.rows) {
    await db.execute({
      sql: `UPDATE orders
        SET pos_export_id = (SELECT COALESCE(MAX(pos_export_id), 0) + 1 FROM orders)
        WHERE id=? AND pos_export_id IS NULL`,
      args: [String(row.id)],
    });
  }
}

/** Placed (not cancelled), not yet accepted by POS, for one branch. */
export async function listPendingOxiposOrders(
  branchId: BranchId,
): Promise<OxiposOrder[]> {
  await requireOrderDb();
  await ensurePosExportIds(branchId);
  const result = await db.execute({
    sql: `SELECT pos_export_id, branch_id, snapshot, customer_name, customer_phone,
            car_plate, car_colour, car_model, instructions
       FROM orders
      WHERE branch_id=? AND accepted_by_pos_at IS NULL AND pos_export_id IS NOT NULL
        AND ${POS_EXPORT_ELIGIBLE}
      ORDER BY pos_export_id ASC
      LIMIT 100`,
    args: [branchId],
  });
  const out: OxiposOrder[] = [];
  for (const row of result.rows) {
    const source = sourceFromRow(row as Record<string, unknown>);
    if (!source) continue;
    if (!source.customerName || !source.customerPhone) continue;
    out.push(toOxiposOrder(source));
  }
  return out;
}

/** Marks an order accepted by POS. Idempotent when already accepted. */
export async function acceptOxiposOrder(posExportId: number): Promise<"ok" | "missing"> {
  await requireOrderDb();
  if (!Number.isInteger(posExportId) || posExportId < 1) return "missing";
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `UPDATE orders SET accepted_by_pos_at=COALESCE(accepted_by_pos_at, ?), updated_at=?
            WHERE pos_export_id=? AND status NOT IN ('cancelled') AND ${ORDER_SURFACE_POS_SQL}`,
    args: [now, now, posExportId],
  });
  return result.rowsAffected === 1 ? "ok" : "missing";
}
