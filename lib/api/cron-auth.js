import { CRON_SECRET } from '@/lib/config';
import { AuthError } from '@/lib/util/errors';
import { safeEqual } from '@/lib/util/crypto';

/**
 * Cron endpoints are publicly routable on Vercel, so every one of them is
 * secret-gated. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export function requireCronSecret(request) {
  if (!CRON_SECRET) {
    throw new AuthError('CRON_SECRET is not configured for this deployment.');
  }
  const header = request.headers.get('authorization') || '';
  const provided = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : request.nextUrl?.searchParams.get('secret') || '';
  if (!safeEqual(provided, CRON_SECRET)) {
    throw new AuthError('Invalid cron secret.');
  }
  return true;
}

/** Cron jobs process shops in bounded batches to stay inside the time budget. */
export async function forEachActiveShop(prisma, handler, { limit = 25 } = {}) {
  const shops = await prisma.shop.findMany({
    where: { isActive: true },
    orderBy: { lastSyncAt: 'asc' },
    take: limit,
  });

  const results = [];
  for (const shop of shops) {
    try {
      results.push({ shop: shop.domain, ...(await handler(shop)) });
    } catch (error) {
      // One broken store must never stop the run for everyone else.
      // eslint-disable-next-line no-console
      console.error('[creditloop] cron failed for shop', shop.domain, error?.message);
      results.push({ shop: shop.domain, error: String(error?.message || error) });
    }
  }
  return results;
}
