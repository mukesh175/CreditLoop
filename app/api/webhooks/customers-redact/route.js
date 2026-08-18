import prisma from '@/lib/prisma/client';
import { createWebhookHandler } from '@/lib/shopify/webhook-handler';
import { recordAudit, AUDIT } from '@/lib/util/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GDPR: customers/redact — mandatory for App Store apps.
 *
 * Personal data is deleted. Financial audit rows are anonymized rather than
 * dropped: the amounts and Shopify transaction ids remain for the merchant's
 * accounting record, with the customer identifier removed.
 */
export const POST = createWebhookHandler('customers/redact', async ({ shop, payload }) => {
  if (!shop) return;
  const customerGid = payload.customer?.id
    ? `gid://shopify/Customer/${payload.customer.id}`
    : null;
  if (!customerGid) return;

  const anonymized = `redacted:${Buffer.from(customerGid).toString('base64').slice(0, 24)}`;

  await prisma.$transaction([
    // Personal data — deleted outright.
    prisma.customerMetric.deleteMany({ where: { shopId: shop.id, customerGid } }),
    prisma.customerCreditSnapshot.deleteMany({ where: { shopId: shop.id, customerGid } }),
    prisma.campaignRecipient.deleteMany({ where: { shopId: shop.id, customerGid } }),
    prisma.notificationLog.updateMany({
      where: { shopId: shop.id, customerGid },
      data: { customerGid: anonymized, recipientHash: null },
    }),
    // Financial records — anonymized, amounts retained for accounting.
    prisma.creditEvent.updateMany({
      where: { shopId: shop.id, customerGid },
      data: { customerGid: anonymized },
    }),
    prisma.orderAttribution.updateMany({
      where: { shopId: shop.id, customerGid },
      data: { customerGid: anonymized },
    }),
    prisma.returnEvent.updateMany({
      where: { shopId: shop.id, customerGid },
      data: { customerGid: anonymized },
    }),
    prisma.auditLog.updateMany({
      where: { shopId: shop.id, customerGid },
      data: { customerGid: anonymized },
    }),
    prisma.reconciliationRecord.deleteMany({ where: { shopId: shop.id, customerGid } }),
  ]);

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.DATA_REDACTED,
    actorType: 'SHOPIFY',
    reason: 'Customer redaction request processed. Personal data deleted; financial records anonymized.',
    metadata: { anonymizedId: anonymized },
  });
});
