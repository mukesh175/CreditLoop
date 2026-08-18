import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getOverviewMetrics } from '@/lib/analytics/metrics';
import { getDashboardAlerts } from '@/lib/analytics/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const { searchParams } = request.nextUrl;
  const currencyCode = (searchParams.get('currency') || shop.currencyCode).toUpperCase();
  const range = searchParams.get('range') || '30d';

  const [metrics, alerts] = await Promise.all([
    getOverviewMetrics({
      shopId: shop.id,
      currencyCode,
      range,
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    }),
    getDashboardAlerts({ shopId: shop.id, currencyCode }),
  ]);

  return ok({
    metrics,
    alerts,
    // Wording matters: this is an observed association, not a causal claim.
    revenueDisclaimer:
      'Revenue shown is from orders that used store credit. CreditLoop reports what happened after credit was issued; it does not claim to have caused it.',
  });
});
