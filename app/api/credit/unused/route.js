import { withErrorHandling, ok, parsePagination } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getUnusedCreditBuckets, getOutstandingCredit } from '@/lib/analytics/metrics';
import { resolveSegment } from '@/lib/analytics/segments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Unused credit dashboard: ageing buckets plus the customers behind them. */
export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const { searchParams } = request.nextUrl;
  const currencyCode = (searchParams.get('currency') || shop.currencyCode).toUpperCase();
  const { take, skip, page } = parsePagination(searchParams, { defaultTake: 25 });
  const segment = searchParams.get('filter') === 'expiring' ? 'EXPIRING_CREDIT' : 'CREDIT_HOLDERS';

  const [buckets, outstanding, segmentResult] = await Promise.all([
    getUnusedCreditBuckets({ shopId: shop.id, currencyCode }),
    getOutstandingCredit({ shopId: shop.id, currencyCode }),
    resolveSegment({ shopId: shop.id, segment, currencyCode, take, skip }),
  ]);

  return ok({
    currencyCode,
    buckets,
    outstanding,
    customers: segmentResult.customers,
    pagination: { page, take, total: segmentResult.total, pages: Math.ceil(segmentResult.total / take) },
    note: 'Balances are cached from Shopify. The sync time is shown next to each figure.',
  });
});
