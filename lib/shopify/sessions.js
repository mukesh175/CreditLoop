import prisma from '@/lib/prisma/client';
import { decrypt, encrypt } from '@/lib/util/crypto';
import { AuthError } from '@/lib/util/errors';

/** Persists an offline access token, encrypted, and upserts the Shop row. */
export async function storeOfflineSession({ shopDomain, accessToken, scope, expiresAt = null }) {
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
      expiresAt,
    },
    update: { scope, accessToken: encrypt(accessToken), shopId: shop.id, expiresAt },
  });

  return shop;
}

/**
 * Returns { shopDomain, accessToken } for Admin API calls.
 * Access tokens never leave the server — no route may serialize this object.
 */
/** Refresh a little early rather than racing the expiry mid-request. */
const EXPIRY_GRACE_MS = 60_000;

export async function getOfflineSession(shopDomain) {
  const record = await prisma.shopifySession.findUnique({
    where: { id: `offline_${shopDomain}` },
  });
  if (!record) throw new AuthError('This store is not connected to CreditLoop.');

  if (record.expiresAt && record.expiresAt.getTime() - EXPIRY_GRACE_MS <= Date.now()) {
    // Expired. Throwing sends the caller down the token-exchange path, which
    // mints a fresh one — the merchant never notices.
    throw new AuthError('The access token for this store has expired.');
  }

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
