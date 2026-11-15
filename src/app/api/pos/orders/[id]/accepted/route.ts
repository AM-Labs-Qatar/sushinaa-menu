import { NextResponse } from "next/server";
import { OrderingUnavailable } from "@/ordering/guard";
import { oxiposAuthorized } from "@/ordering/vendors/oxipos/auth";
import { acceptOxiposOrder } from "@/ordering/vendors/oxipos/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * OXiPOS confirms it imported an order. POST /api/pos/orders/{pos_export_id}/accepted/
 */
export async function POST(request: Request, { params }: Props) {
  try {
    if (!oxiposAuthorized(request)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const id = Number((await params).id);
    const result = await acceptOxiposOrder(id);
    if (result === "missing") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    if (error instanceof OrderingUnavailable) {
      return NextResponse.json({ code: "ORDERING_UNAVAILABLE" }, { status: 503 });
    }
    return NextResponse.json({ code: "TEMPORARILY_UNAVAILABLE" }, { status: 503 });
  }
}
