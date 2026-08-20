import prisma from '@/lib/prisma/client';
import { decrypt, encrypt } from '@/lib/util/crypto';
import { AuthError } from '@/lib/util/errors';

/** Persists an offline access token, encrypted, and upserts the Shop row. */
export async function storeOfflineSession({ shopDomain, accessToken, scope }) {
  const shop = await prisma.shop.upsert({
    where: { domain: shopDomain },
    create: { domain: shopDomain, scopes: scope, isActive: true },
    update: { scopes: scope, isActive: true, uninstalledAt: null },
  });

  const id = `offline_${shopDomain}`;
  await prisma.shopifySession.upsert({
    where: { id },
    create: {
      id,
      shopId: shop.id,
      shopDomain,
      isOnline: false,
      scope,
      accessToken: encrypt(accessToken),
    },
    update: { scope, accessToken: encrypt(accessToken), shopId: shop.id },
  });

  return shop;
}

/**
 * Returns { shopDomain, accessToken } for Admin API calls.
 * Access tokens never leave the server — no route may serialize this object.
 */
export async function getOfflineSession(shopDomain) {
  const record = await prisma.shopifySession.findUnique({
    where: { id: `offline_${shopDomain}` },
  });
  if (!record) throw new AuthError('This store is not connected to CreditLoop.');
  return { shopDomain, accessToken: decrypt(record.accessToken) };
}

export async function getSessionForShop(shop) {
  return getOfflineSession(shop.domain);
}

/**
 * Drops a stored access token that Shopify no longer accepts.
 *
 * Happens routinely after a scope change — granting protected customer data
 * access, for instance, invalidates the token issued under the old scopes. The
 * next authenticated request re-acquires one through token exchange, so the
 * merchant never has to reinstall.
 */
export async function invalidateSession(shopDomain) {
  await prisma.shopifySession.deleteMany({ where: { shopDomain } }).catch(() => null);
}

/** Called on app/uninstalled and shop/redact — the token must stop working for us. */
export async function deleteSessionsForShop(shopDomain) {
  await prisma.shopifySession.deleteMany({ where: { shopDomain } });
}
