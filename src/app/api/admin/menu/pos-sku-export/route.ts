import { readMenu } from "@/cms/repository";
import { requireStaff, failure } from "@/ordering/http";
import { posSkuExportCsv } from "@/ordering/vendors/oxipos/sku-export";

export const dynamic = "force-dynamic";

/** Admin CSV of our `posSku` values for the restaurant’s OXiPOS product map. */
export async function GET() {
  try {
    await requireStaff(undefined, "menu");
    const { menu } = await readMenu();
    const day = new Date().toISOString().slice(0, 10);
    return new Response(posSkuExportCsv(menu), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sushinaa-pos-sku-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
