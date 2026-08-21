import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { adminGraphql } from '@/lib/shopify/graphql';
import { CUSTOMER_DETAIL_QUERY } from '@/lib/shopify/queries';
import { round2 } from '@/lib/util/money';
import { isDemoGid } from '@/lib/demo/identifiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Customer detail: live Shopify balance alongside CreditLoop's own analytics,
 * each clearly labelled with where it came from.
 */
export const GET = withErrorHandling(async (request, { params }) => {
  const { shop, session } = await requireShop(request);
  const { id } = await params;
  const customerGid = decodeURIComponent(id);

  // Demo customers do not exist in Shopify; asking for them returns an invalid
  // ID error. Everything shown for them comes from the generated data instead.
  const demo = isDemoGid(customerGid);

  const [detail, metric, events, attributions] = await Promise.all([
    demo
      ? Promise.resolve({ data: { customer: null } })
      : adminGraphql(session, CUSTOMER_DETAIL_QUERY, { id: customerGid }),
    prisma.customerMetric.findUnique({
      where: { shopId_customerGid: { shopId: shop.id, customerGid } },
    }),
    prisma.creditEvent.findMany({
      where: { shopId: shop.id, customerGid },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.orderAttribution.findMany({
      where: { shopId: shop.id, customerGid, creditAmountUsed: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
  ]);

  const customer = detail?.data?.customer;

  const snapshots = demo
    ? await prisma.customerCreditSnapshot.findMany({
        where: { shopId: shop.id, customerGid },
      })
    : [];
  const totalIssued = round2(
    events.filter((e) => e.eventType === 'CREDIT').reduce((s, e) => s + Number(e.amount), 0)
  );
  const totalRedeemed = round2(
    attributions.reduce((s, a) => s + Number(a.creditAmountUsed), 0)
  );

  return ok({
    isDemo: demo,
    // From Shopify — authoritative. For demo records this is generated data,
    // flagged by isDemo so the UI never presents it as a Shopify balance.
    shopify: {
      id: customer?.id || customerGid,
      displayName: customer?.displayName || metric?.displayName || null,
      orderCount: Number(customer?.numberOfOrders || metric?.orderCount || 0),
      lifetimeValue: Number(customer?.amountSpent?.amount || metric?.lifetimeValue || 0),
      lifetimeValueCurrency: customer?.amountSpent?.currencyCode || metric?.currencyCode,
      marketingConsent: customer?.emailMarketingConsent?.marketingState === 'SUBSCRIBED',
      storeCreditAccounts: demo
        ? snapshots.map((snapshot) => ({
            id: snapshot.shopifyStoreCreditAccountId,
            balance: snapshot.balance,
            currencyCode: snapshot.currencyCode,
          }))
        : (customer?.storeCreditAccounts?.nodes || []).map((a) => ({
            id: a.id,
            balance: Number(a.balance.amount),
            currencyCode: a.balance.currencyCode,
          })),
      recentOrders: customer?.orders?.nodes || [],
    },
    // From CreditLoop — analytics only.
    creditloop: {
      totalIssued,
      totalRedeemed,
      creditPurchases: attributions.length,
      creditUseCount: metric?.creditUseCount || 0,
      returnCount: metric?.returnCount || 0,
      lastOrderAt: metric?.lastOrderAt || null,
      events,
      creditOrders: attributions,
    },
  });
});
