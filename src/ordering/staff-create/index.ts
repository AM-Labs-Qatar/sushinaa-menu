import type { MenuData } from "@/cms/schema";
import type { AuditContext } from "@/cms/audit";
import type { BranchScope } from "@/ordering/scope";
import { quoteCatalogLines, type OrderSnapshot } from "@/ordering/checkout/quote";
import { assertStaffCreateAllowed } from "./policy";
import { persistStaffOrder } from "./persist";
import type { StaffCreateInput } from "./input";

export { staffCreateBody, type StaffCreateInput } from "./input";
export { assertStaffCreateAllowed } from "./policy";

export async function createStaffOrder(
  input: StaffCreateInput,
  menu: MenuData,
  revision: number,
  scope: BranchScope,
  ctx: AuditContext,
  createdBy: string,
  now = new Date(),
) {
  const branch = assertStaffCreateAllowed(menu, input.branchId, scope, now);
  const lines = quoteCatalogLines(input.lines, menu);
  // Staff v1 only collects plate — no name/phone/vehicle. Empty brand (not a fake brand id).
  const snapshot: OrderSnapshot = {
    branchId: branch.slug,
    branchName: branch.name,
    customer: {
      name: "",
      phone: "",
      plate: input.plate,
      brand: "" as OrderSnapshot["customer"]["brand"],
      colour: "",
      car: "",
      instructions: input.instructions,
    },
    collection: "car",
    lines,
    totalMinor: lines.reduce((n, line) => n + line.totalMinor, 0),
    currency: "QAR",
  };
  return persistStaffOrder({
    snapshot,
    revision,
    plate: input.plate,
    instructions: input.instructions,
    idempotencyKey: input.idempotencyKey,
    createdBy,
    ctx,
  });
}
