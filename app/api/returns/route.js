import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, parsePagination } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILTERS = {
  all: {},
  credit_offered: { status: 'CREDIT_OFFERED' },
  credit_accepted: { creditAccepted: true },
  original_payment: { refundMethod: 'ORIGINAL_PAYMENT' },
  pending: { status: 'OPEN' },
};

/** Server-side paginated returns list. */
export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const { searchParams } = request.nextUrl;
  const { take, skip, page } = parsePagination(searchParams);
  const filter = FILTERS[searchParams.get('filter')] ?? FILTERS.all;

  const where = { shopId: shop.id, ...filter };
  const [returns, total] = await Promise.all([
    prisma.returnEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.returnEvent.count({ where }),
  ]);

  const customerGids = [...new Set(returns.map((r) => r.customerGid).filter(Boolean))];
  const metrics = await prisma.customerMetric.findMany({
    where: { shopId: shop.id, customerGid: { in: customerGids } },
    select: { customerGid: true, displayName: true, orderCount: true, lifetimeValue: true },
  });
  const byCustomer = new Map(metrics.map((m) => [m.customerGid, m]));

  return ok({
    returns: returns.map((r) => ({ ...r, customer: byCustomer.get(r.customerGid) || null })),
    pagination: { page, take, total, pages: Math.ceil(total / take) },
  });
});
