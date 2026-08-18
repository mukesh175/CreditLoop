import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getCreditTimeSeries } from '@/lib/analytics/metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const { searchParams } = request.nextUrl;
  const series = await getCreditTimeSeries({
    shopId: shop.id,
    currencyCode: (searchParams.get('currency') || shop.currencyCode).toUpperCase(),
    range: searchParams.get('range') || '30d',
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  });
  return ok({ series });
});
