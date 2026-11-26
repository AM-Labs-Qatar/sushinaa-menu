import { auditContext } from '@/cms/audit';
import { orderId } from '@/ordering/contracts';
import { settleAdjustment } from '@/ordering/order-edits';
import { requireStaff, reply, failure, jsonBody, writeAccess, OrderError } from '@/ordering/http';
import { rateAllowed } from '@/ordering/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const adjustmentIdSchema = z.string().min(1).max(80);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; adjustmentId: string }> },
) {
  try {
    const staff = await requireStaff(request, 'orders');
    writeAccess(request);
    await jsonBody(request);
    const ctx = auditContext(request, staff.username);
    if (!await rateAllowed('staff', ctx.ip)) throw new OrderError('RATE_LIMIT', 429);
    const { id, adjustmentId } = await params;
    await settleAdjustment(staff.branchScope, orderId.parse(id), adjustmentIdSchema.parse(adjustmentId), ctx);
    return reply({ ok: true });
  } catch (error) { return failure(error); }
}
