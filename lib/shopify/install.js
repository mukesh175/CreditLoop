import prisma from '@/lib/prisma/client';
import { storeOfflineSession, getOfflineSession } from './sessions';
import { exchangeSessionTokenForAccessToken } from './token-exchange';
import { registerWebhooks } from './webhooks';
import { seedDefaultRules } from '@/lib/rules/defaults';
import { syncShopInfo, syncCustomers, syncOrders } from '@/lib/credit/sync';
import { recordAudit, AUDIT } from '@/lib/util/audit';

/**
 * Brings a store into CreditLoop the first time it makes an authenticated
 * request, using token exchange.
 *
 * With managed installation Shopify never sends the merchant through the app's
 * OAuth route, so first contact is an ordinary embedded request. This turns
 * that request into a completed install.
 *
 * Everything after the token is best-effort: a failed webhook registration or
 * shop sync must not stop the merchant from using the app. The onboarding sync
 * retries them and reports what is outstanding.
 */
export async function ensureShopInstalled({ shopDomain, sessionToken }) {
  const { accessToken, scope } = await exchangeSessionTokenForAccessToken({
    shopDomain,
    sessionToken,
  });

  const shop = await storeOfflineSession({ shopDomain, accessToken, scope });
  const session = await getOfflineSession(shopDomain);

  await Promise.allSettled([
    syncShopInfo({ shop, session }),
    registerWebhooks({ session }),
    seedDefaultRules({ shopId: shop.id }),
    // A first page each, so the dashboard is not empty on first open. The
    // onboarding sync and the scheduled job pull the rest.
    syncCustomers({ shop, session, maxPages: 1 }),
    syncOrders({ shop, session, maxPages: 1 }),
    prisma.notificationPreference.upsert({
      where: { shopId: shop.id },
      create: { shopId: shop.id, merchantEmail: shop.email },
      update: {},
    }),
  ]);

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.ADMIN_ACTION,
    actorType: 'SHOPIFY',
    reason: 'Store connected via token exchange (managed installation)',
    metadata: { scope },
  });

  // Re-read: syncShopInfo may have filled in the name and currency.
  const refreshed = await prisma.shop.findUnique({ where: { id: shop.id } });
  return { shop: refreshed || shop, session };
}
