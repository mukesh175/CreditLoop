import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getRepeatPurchaseStats, rangeToDates } from '@/lib/analytics/metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const { searchParams } = request.nextUrl;
  const { start, end } = rangeToDates(searchParams.get('range') || '90d', {
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  });

  const stats = await getRepeatPurchaseStats({
    shopId: shop.id,
    currencyCode: (searchParams.get('currency') || shop.currencyCode).toUpperCase(),
    start,
    end,
  });

  return ok({
    stats,
    methodology:
      'Observed comparison between customers who used store credit and those who did not, over the selected period. Differences are not adjusted for customer mix and do not establish causation.',
  });
});
