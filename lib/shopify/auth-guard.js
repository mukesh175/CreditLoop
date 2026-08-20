import prisma from '@/lib/prisma/client';
import { AppError, AuthError, ForbiddenError } from '@/lib/util/errors';
import { verifySessionToken } from './session-token';
import { getOfflineSession } from './sessions';
import { ensureShopInstalled, getMerchantSession } from './install';

/**
 * The single entry point for authenticating an embedded admin API request.
 *
 * Returns { shop, session, userId }. `shop` is loaded from the database using
 * the shop domain in the *verified* session token, so a caller cannot act on a
 * store they are not authenticated for.
 */
export async function requireShop(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
  if (!token) throw new AuthError('Missing Authorization: Bearer <session token> header.');

  const { shopDomain, userId } = verifySessionToken(token);

  let shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

  // First contact, a reinstall, or a lost offline token. Under managed
  // installation Shopify never sends the merchant through the app's OAuth
  // route, so this request is where the install actually completes.
  if (!shop?.isActive) {
    ({ shop } = await ensureShopInstalled({ shopDomain, sessionToken: token }));
  } else {
    // Keep the offline token current for background jobs, without blocking the
    // merchant if it cannot be obtained.
    await getOfflineSession(shopDomain).catch(() =>
      ensureShopInstalled({ shopDomain, sessionToken: token }).catch(() => null)
    );
  }

  // Merchant requests act as the signed-in user, on a token that expires.
  const session = await getMerchantSession({ shopDomain, userId, sessionToken: token });
  return { shop, session, userId };
}

/**
 * Ownership check for any record carrying a shopId. Never trust an id from the
 * client without running it through this.
 */
export function assertOwnedByShop(record, shop, label = 'record') {
  if (!record || record.shopId !== shop.id) {
    throw new ForbiddenError(`That ${label} does not belong to this store.`);
  }
  return record;
}
