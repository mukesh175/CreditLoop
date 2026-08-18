import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, parsePagination } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { resolveSegment, SEGMENTS } from '@/lib/analytics/segments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Paginated customer search / segment browse. Never loads all customers. */
export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const { searchParams } = request.nextUrl;
  const { take, skip, page } = parsePagination(searchParams, { defaultTake: 25 });
  const search = (searchParams.get('q') || '').trim();
  const segment = searchParams.get('segment');
  const currencyCode = (searchParams.get('currency') || shop.currencyCode).toUpperCase();

  if (segment && SEGMENTS[segment]) {
    const result = await resolveSegment({ shopId: shop.id, segment, currencyCode, take, skip });
    return ok({
      customers: result.customers,
      segment: SEGMENTS[segment],
      pagination: { page, take, total: result.total, pages: Math.ceil(result.total / take) },
    });
  }

  const where = {
    shopId: shop.id,
    ...(search ? { displayName: { contains: search, mode: 'insensitive' } } : {}),
  };

  const [metrics, total] = await Promise.all([
    prisma.customerMetric.findMany({
      where,
      orderBy: { lifetimeValue: 'desc' },
      take,
      skip,
    }),
    prisma.customerMetric.count({ where }),
  ]);

  const snapshots = await prisma.customerCreditSnapshot.findMany({
    where: { shopId: shop.id, customerGid: { in: metrics.map((m) => m.customerGid) } },
  });
  const byCustomer = new Map(snapshots.map((s) => [s.customerGid, s]));

  return ok({
    customers: metrics.map((m) => {
      const snap = byCustomer.get(m.customerGid);
      return {
        customerGid: m.customerGid,
        displayName: m.displayName,
        orderCount: m.orderCount,
        lifetimeValue: m.lifetimeValue,
        currencyCode: m.currencyCode,
        lastOrderAt: m.lastOrderAt,
        creditUseCount: m.creditUseCount,
        creditIssuedTotal: m.creditIssuedTotal,
        creditRedeemedTotal: m.creditRedeemedTotal,
        balance: snap?.balance ?? 0,
        balanceCurrency: snap?.currencyCode ?? m.currencyCode,
        balanceSyncedAt: snap?.syncedAt ?? null,
      };
    }),
    pagination: { page, take, total, pages: Math.ceil(total / take) },
  });
});
