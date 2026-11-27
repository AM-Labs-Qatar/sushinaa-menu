import { NextResponse } from "next/server";
import { OrderingUnavailable } from "@/ordering/guard";
import { posPullAllowed } from "@/ordering/surface";
import { oxiposAuthorized } from "@/ordering/vendors/oxipos/auth";
import { branchForShopId } from "@/ordering/vendors/oxipos/config";
import { listPendingOxiposOrders } from "@/ordering/vendors/oxipos/repository";
import { storefrontFromRequest } from "@/storefront/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OXiPOS polls this endpoint. Response root must be a JSON array.
 * Refuses the pickup storefront — POS may only call a non-pickup server.
 * GET /api/pos/orders?shop_id=…
 */
export async function GET(request: Request) {
  try {
    if (!oxiposAuthorized(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!posPullAllowed(storefrontFromRequest(request))) {
      return NextResponse.json({ code: "POS_UNAVAILABLE_ON_PICKUP" }, { status: 503 });
    }
    const shopId = new URL(request.url).searchParams.get("shop_id")?.trim() || "";
    const branchId = shopId ? branchForShopId(shopId) : undefined;
    if (!branchId) {
      return NextResponse.json([], {
        status: 200,
        headers: { "cache-control": "no-store" },
      });
    }
    const orders = await listPendingOxiposOrders(branchId);
    return NextResponse.json(orders, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof OrderingUnavailable) {
      return NextResponse.json({ code: "ORDERING_UNAVAILABLE" }, { status: 503 });
    }
    return NextResponse.json({ code: "TEMPORARILY_UNAVAILABLE" }, { status: 503 });
  }
}
