import { auditContext } from '@/cms/audit';
import { readMenu } from '@/cms/repository';
import { orderQuery } from '@/ordering/contracts';
import { listOrders } from '@/ordering/orders';
import { createStaffOrder, staffCreateBody } from '@/ordering/staff-create';
import { requireStaff, reply, failure, jsonBody, writeAccess, OrderError } from '@/ordering/http';
import { rateAllowed } from '@/ordering/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const staff = await requireStaff(undefined, 'orders');
    const query = orderQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
    return reply(await listOrders(staff.branchScope, query, query.mine === '1' ? staff.username : undefined));
  }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaff(request, 'orders');
    writeAccess(request);
    const ctx = auditContext(request, staff.username);
    if (!await rateAllowed('staff', ctx.ip)) throw new OrderError('RATE_LIMIT', 429);
    const input = staffCreateBody.parse(await jsonBody(request));
    const { menu, revision } = await readMenu();
    const created = await createStaffOrder(input, menu, revision, staff.branchScope, ctx, staff.username);
    return reply(created, created.reused ? 200 : 201);
  } catch (error) { return failure(error); }
}
