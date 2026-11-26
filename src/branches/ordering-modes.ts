import type { BranchSettings } from "./schema";

/** Modes a branch may expose. Membership is the product gate — not parallel booleans. */
export const BRANCH_ORDER_MODES = ["pickup", "staff"] as const;
export type BranchOrderMode = (typeof BRANCH_ORDER_MODES)[number];

export const DEFAULT_ORDERING_MODES: readonly BranchOrderMode[] = ["pickup"];

export function isBranchOrderMode(value: unknown): value is BranchOrderMode {
  return value === "pickup" || value === "staff";
}

/** Normalize persisted list to a unique set preserving known modes only. */
export function normalizeOrderingModes(raw: unknown): BranchOrderMode[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ORDERING_MODES];
  const seen = new Set<BranchOrderMode>();
  const out: BranchOrderMode[] = [];
  for (const item of raw) {
    if (!isBranchOrderMode(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function enabledOrderingModes(
  branch: Pick<BranchSettings, "orderingModes"> | { orderingModes?: unknown },
): BranchOrderMode[] {
  return normalizeOrderingModes(branch.orderingModes);
}

export function hasOrderingMode(
  branch: Pick<BranchSettings, "orderingModes"> | { orderingModes?: unknown },
  mode: BranchOrderMode,
): boolean {
  return enabledOrderingModes(branch).includes(mode);
}

/** Resolve mode membership from the menu document by branch slug. */
export function menuHasOrderingMode(
  branches: readonly (Pick<BranchSettings, "slug" | "orderingModes"> | { slug: string; orderingModes?: unknown })[],
  branchId: string,
  mode: BranchOrderMode,
): boolean {
  const row = branches.find((branch) => branch.slug === branchId);
  return row ? hasOrderingMode(row, mode) : false;
}

/** Add or remove a mode id; returns a new unique list. */
export function withOrderingMode(
  modes: readonly BranchOrderMode[],
  mode: BranchOrderMode,
  enabled: boolean,
): BranchOrderMode[] {
  const set = new Set(normalizeOrderingModes(modes));
  if (enabled) set.add(mode);
  else set.delete(mode);
  return BRANCH_ORDER_MODES.filter((id) => set.has(id));
}
