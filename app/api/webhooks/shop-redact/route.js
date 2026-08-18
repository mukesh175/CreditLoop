import prisma from '@/lib/prisma/client';
import { createWebhookHandler } from '@/lib/shopify/webhook-handler';
import { deleteSessionsForShop } from '@/lib/shopify/sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GDPR: shop/redact — mandatory for App Store apps.
 *
 * Sent 48 hours after uninstall. Everything CreditLoop holds for the shop is
 * deleted, including access tokens. Cascade deletes on Shop remove the rest.
 *
 * Customers' store-credit balances live in Shopify and are unaffected.
 */
export const POST = createWebhookHandler(
  'shop/redact',
  async ({ shop, shopDomain }) => {
    await deleteSessionsForShop(shopDomain);
    if (!shop) return;
    await prisma.shop.delete({ where: { id: shop.id } });
  },
  { requireShop: false }
);
