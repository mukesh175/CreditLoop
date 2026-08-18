import prisma from '@/lib/prisma/client';
import { createWebhookHandler } from '@/lib/shopify/webhook-handler';
import { recordAudit, AUDIT } from '@/lib/util/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GDPR: customers/data_request — mandatory for App Store apps.
 *
 * Assembles everything CreditLoop holds about the customer. Delivery to the
 * merchant happens out of band; we log the request and the assembled payload
 * reference so it is auditable.
 */
export const POST = createWebhookHandler('customers/data_request', async ({ shop, payload }) => {
  if (!shop) return;
  const customerGid = payload.customer?.id
    ? `gid://shopify/Customer/${payload.customer.id}`
    : null;
  if (!customerGid) return;

  const [metric, snapshots, creditEvents, orderAttributions, notifications] = await Promise.all([
    prisma.customerMetric.findUnique({
      where: { shopId_customerGid: { shopId: shop.id, customerGid } },
    }),
    prisma.customerCreditSnapshot.findMany({ where: { shopId: shop.id, customerGid } }),
    prisma.creditEvent.findMany({ where: { shopId: shop.id, customerGid } }),
    prisma.orderAttribution.findMany({ where: { shopId: shop.id, customerGid } }),
    prisma.notificationLog.findMany({
      where: { shopId: shop.id, customerGid },
      select: { template: true, status: true, sentAt: true, audience: true },
    }),
  ]);

  const dataPackage = {
    note: 'CreditLoop stores analytics and audit records keyed to Shopify customer IDs. Store-credit balances themselves are held by Shopify.',
    customerGid,
    metrics: metric,
    creditBalanceSnapshots: snapshots,
    creditEvents,
    orderAttributions,
    notifications,
  };

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.ADMIN_ACTION,
    actorType: 'SHOPIFY',
    customerGid,
    reason: 'GDPR data request fulfilled',
    metadata: {
      recordCounts: {
        creditEvents: creditEvents.length,
        orderAttributions: orderAttributions.length,
        snapshots: snapshots.length,
        notifications: notifications.length,
      },
      dataPackage,
    },
  });
});
