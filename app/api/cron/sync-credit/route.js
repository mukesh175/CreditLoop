import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret, forEachActiveShop } from '@/lib/api/cron-auth';
import { getOfflineSession } from '@/lib/shopify/sessions';
import { syncCreditBalances, syncCustomers } from '@/lib/credit/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Refreshes cached Shopify balances and customer metrics. Idempotent. */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);
  const results = await forEachActiveShop(prisma, async (shop) => {
    const session = await getOfflineSession(shop.domain);
    const customers = await syncCustomers({
      shop,
      session,
      maxPages: 2,
      updatedSince: shop.lastSyncAt,
    });
    const balances = await syncCreditBalances({ shop, session, limit: 100 });
    return { customers: customers.synced, balances: balances.updated };
  });
  return ok({ job: 'sync-credit', results });
});

export const POST = GET;
