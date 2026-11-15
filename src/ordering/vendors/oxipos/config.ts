import { BRANCHES, type BranchId } from "@/branches/branches";

function trim(value: string | undefined) {
  return value?.trim() || "";
}

/** Shared secret for OXiPOS `X-POS-API-Key`. Empty means the pull API is off. */
export function oxiposApiKey(): string {
  return trim(process.env.OXIPOS_API_KEY);
}

/**
 * Branch slug → OXiPOS shop_id. Owned here so routes do not parse env.
 * `OXIPOS_SHOP_IDS` is JSON, e.g. `{"down-town":"101"}`.
 */
export function shopIdByBranch(): Map<string, BranchId> {
  const raw = trim(process.env.OXIPOS_SHOP_IDS);
  const out = new Map<string, BranchId>();
  if (!raw) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  const slugs = new Set(BRANCHES.map((b) => b.slug));
  for (const [slug, shop] of Object.entries(parsed as Record<string, unknown>)) {
    if (!slugs.has(slug as BranchId)) continue;
    if (typeof shop !== "string" && typeof shop !== "number") continue;
    const id = String(shop).trim();
    if (!id) continue;
    out.set(id, slug as BranchId);
  }
  return out;
}

export function branchForShopId(shopId: string): BranchId | undefined {
  return shopIdByBranch().get(shopId.trim());
}
