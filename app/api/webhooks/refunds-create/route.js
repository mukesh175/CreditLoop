import prisma from '@/lib/prisma/client';
import { createWebhookHandler } from '@/lib/shopify/webhook-handler';
import { round2 } from '@/lib/util/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Records refunds as return opportunities.
 *
 * This handler deliberately does NOT convert anything to store credit. A webhook
 * is not merchant authorization — it only surfaces the opportunity on the
 * Returns page, where a human decides.
 */
export const POST = createWebhookHandler('refunds/create', async ({ shop, payload }) => {
  const orderGid = payload.order_id
    ? `gid://shopify/Order/${payload.order_id}`
    : null;
  if (!orderGid) return;

  const refundGid = payload.admin_graphql_api_id || `gid://shopify/Refund/${payload.id}`;

  const amount = round2(
    (payload.transactions || [])
      .filter((t) => t.kind === 'refund' && t.status === 'success')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );

  const currencyCode = String(
    payload.transactions?.[0]?.currency || shop.currencyCode || 'USD'
  ).toUpperCase();

  const usedStoreCredit = (payload.transactions || []).some((t) =>
    String(t.gateway || '').toLowerCase().includes('store credit')
  );

  const existing = await prisma.returnEvent.findFirst({
    where: { shopId: shop.id, orderGid, refundGid },
  });
  if (existing) return;

  await prisma.returnEvent.create({
    data: {
      shopId: shop.id,
      orderGid,
      refundGid,
      customerGid: null,
      refundAmount: amount,
      currencyCode,
      refundMethod: usedStoreCredit ? 'STORE_CREDIT' : 'ORIGINAL_PAYMENT',
      creditAccepted: usedStoreCredit,
      status: usedStoreCredit ? 'CREDIT_ISSUED' : 'REFUNDED',
    },
  });
});
