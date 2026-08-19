import prisma from '@/lib/prisma/client';
import { AppError, AuthError, ForbiddenError } from '@/lib/util/errors';
import { verifySessionToken } from './session-token';
import { getOfflineSession } from './sessions';

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

  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });

  // A distinct code, because the client can recover from this on its own by
  // sending the merchant through OAuth — unlike a genuine auth failure.
  if (!shop || !shop.isActive) {
    throw new AppError('This store has not completed installation.', {
      code: 'SHOP_NOT_INSTALLED',
      status: 401,
      details: { shopDomain, reason: shop ? 'inactive' : 'missing' },
    });
  }

  let session;
  try {
    session = await getOfflineSession(shopDomain);
  } catch {
    // The shop row exists but its access token is gone — reinstalling is the
    // only way back, so it is the same recoverable case.
    throw new AppError('This store has not completed installation.', {
      code: 'SHOP_NOT_INSTALLED',
      status: 401,
      details: { shopDomain, reason: 'no_session' },
    });
  }

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
