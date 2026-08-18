import prisma from '@/lib/prisma/client';
import { createWebhookHandler } from '@/lib/shopify/webhook-handler';
import { deleteSessionsForShop } from '@/lib/shopify/sessions';
import { recordAudit, AUDIT } from '@/lib/util/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Uninstall.
 *
 * We stop processing, pause every campaign and destroy our access tokens. We do
 * NOT touch the customers' store-credit balances — that money belongs to the
 * customers and stays in Shopify. CreditLoop never holds it hostage.
 */
export const POST = createWebhookHandler('app/uninstalled', async ({ shop, shopDomain }) => {
  if (!shop) return;

  await prisma.$transaction([
    prisma.shop.update({
      where: { id: shop.id },
      data: { isActive: false, uninstalledAt: new Date(), plan: 'FREE', billingSubGid: null },
    }),
    prisma.creditCampaign.updateMany({
      where: { shopId: shop.id, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    }),
  ]);

  await deleteSessionsForShop(shopDomain);

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.APP_UNINSTALLED,
    actorType: 'SHOPIFY',
    reason: 'App uninstalled — processing stopped, campaigns paused, access tokens removed. Customer store credit in Shopify is untouched.',
  });
});
