import { configuredBranches } from "@/branches/branches";
import { menuHasOrderingMode } from "@/branches/ordering-modes";
import { qatarClock, staffOrderingOpen } from "@/branches/hours";
import type { MenuData } from "@/cms/schema";
import type { BranchScope } from "@/ordering/scope";
import { OrderError } from "@/ordering/errors";

const STAFF_HOURS_GRACE_MINUTES = 60;

/** Gate staff punch: mode membership, actor branch scope, hours ± grace. */
export function assertStaffCreateAllowed(
  menu: MenuData,
  branchId: string,
  scope: BranchScope,
  now = new Date(),
) {
  if (scope.kind === "branch" && scope.branchId !== branchId) {
    throw new OrderError("FORBIDDEN", 403);
  }
  if (!menuHasOrderingMode(menu.branches, branchId, "staff")) {
    throw new OrderError("BRANCH_UNAVAILABLE", 409);
  }
  const branch = configuredBranches(menu.branches).find((row) => row.slug === branchId);
  if (!branch) throw new OrderError("BRANCH_UNAVAILABLE", 409);
  if (!staffOrderingOpen(branch.hours, qatarClock(now), STAFF_HOURS_GRACE_MINUTES)) {
    throw new OrderError("CLOSED", 409);
  }
  return branch;
}
