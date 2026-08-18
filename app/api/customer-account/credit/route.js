import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma/client';
import { getOfflineSession } from '@/lib/shopify/sessions';
import { getCustomerStoreCredit } from '@/lib/credit/store-credit';
import { verifySessionToken } from '@/lib/shopify/session-token';
import { AuthError } from '@/lib/util/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Data source for the Customer Account UI extension.
 *
 * The extension sends a session token issued to the logged-in customer. We
 * verify it and read the balance for *that* customer only — a customer id in the
 * request body would be trivially forgeable, so it is never trusted.
 */
export async function GET(request) {
  try {
    const header = request.headers.get('authorization') || '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
    if (!token) throw new AuthError('Missing session token.');

    const { shopDomain, payload } = verifySessionToken(token);

    // The customer's own id comes from the verified token, never the request.
    const customerGid = payload.sub?.startsWith('gid://')
      ? payload.sub
      : `gid://shopify/Customer/${payload.sub}`;

    const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
    if (!shop || !shop.isActive) throw new AuthError('This store is not connected.');

    const session = await getOfflineSession(shopDomain);
    const profile = await getCustomerStoreCredit(session, customerGid, { transactions: 20 });

    if (!profile || !profile.accounts.length) {
      return NextResponse.json({
        ok: true,
        hasCredit: false,
        accounts: [],
        storeUrl: `https://${shopDomain}`,
      });
    }

    return NextResponse.json({
      ok: true,
      hasCredit: profile.accounts.some((a) => a.balance > 0),
      accounts: profile.accounts.map((account) => ({
        balance: account.balance,
        currencyCode: account.currencyCode,
        transactions: account.transactions.slice(0, 10).map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          currencyCode: t.currencyCode,
          balanceAfter: t.balanceAfter,
          createdAt: t.createdAt,
          expiresAt: t.expiresAt,
        })),
      })),
      storeUrl: `https://${shopDomain}`,
    });
  } catch (error) {
    const status = error instanceof AuthError ? 401 : 500;
    // eslint-disable-next-line no-console
    if (status === 500) console.error('[creditloop] customer account error', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          status === 401
            ? 'Please sign in again to see your store credit.'
            : 'Store credit is temporarily unavailable.',
      },
      { status }
    );
  }
}
