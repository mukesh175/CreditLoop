import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret, forEachActiveShop } from '@/lib/api/cron-auth';
import { getOfflineSession } from '@/lib/shopify/sessions';
import { reconcileShop } from '@/lib/credit/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Compares Shopify balances against CreditLoop's analytics ledger.
 * Differences are logged and surfaced in the admin — never auto-corrected.
 */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);
  const results = await forEachActiveShop(prisma, async (shop) => {
    const session = await getOfflineSession(shop.domain);
    return reconcileShop({ shop, session, limit: 50 });
  });
  return ok({ job: 'reconcile', results });
});

export const POST = GET;
