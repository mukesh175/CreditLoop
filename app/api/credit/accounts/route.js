import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getCustomerStoreCredit } from '@/lib/credit/store-credit';
import { ValidationError } from '@/lib/util/errors';
import prisma from '@/lib/prisma/client';
import { isDemoGid } from '@/lib/demo/identifiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live balance straight from Shopify — the authoritative figure. */
export const GET = withErrorHandling(async (request) => {
  const { shop, session } = await requireShop(request);
  const customerGid = request.nextUrl.searchParams.get('customerId');
  if (!customerGid) throw new ValidationError('A customer id is required.');

  // Demo customers have no Shopify account behind them.
  if (isDemoGid(customerGid)) {
    const [snapshots, metric, events] = await Promise.all([
      prisma.customerCreditSnapshot.findMany({ where: { shopId: shop.id, customerGid } }),
      prisma.customerMetric.findUnique({
        where: { shopId_customerGid: { shopId: shop.id, customerGid } },
      }),
      prisma.creditEvent.findMany({
        where: { shopId: shop.id, customerGid },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return ok({
      isDemo: true,
      customer: {
        id: customerGid,
        displayName: metric?.displayName || null,
        orderCount: metric?.orderCount || 0,
        lifetimeValue: metric?.lifetimeValue || 0,
      },
      accounts: snapshots.map((snapshot) => ({
        id: snapshot.shopifyStoreCreditAccountId,
        balance: snapshot.balance,
        currencyCode: snapshot.currencyCode,
        transactions: events.map((event) => ({
          id: event.shopifyTransactionId,
          createdAt: event.createdAt,
          amount: event.amount,
          currencyCode: event.currencyCode,
          type: event.eventType,
          balanceAfter: null,
          expiresAt: event.expiresAt,
        })),
      })),
      source: 'demo',
      note: 'Demo data — generated for development, not from Shopify.',
    });
  }

  const profile = await getCustomerStoreCredit(session, customerGid, { transactions: 10 });
  if (!profile) throw new ValidationError('That customer could not be found.');

  return ok({
    customer: {
      id: profile.customerGid,
      displayName: profile.displayName,
      orderCount: profile.orderCount,
      lifetimeValue: profile.lifetimeValue,
    },
    accounts: profile.accounts,
    source: 'shopify',
    note: 'Balances are read live from Shopify Store Credit, which is the source of truth.',
  });
});
