import { NextResponse } from 'next/server';
import { buildAuthorizeUrl, generateState, OAUTH_STATE_COOKIE } from '@/lib/shopify/oauth';
import { isValidShopDomain } from '@/lib/shopify/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Entry point for installs: /api/auth/login?shop=foo.myshopify.com */
export async function GET(request) {
  const shop = request.nextUrl.searchParams.get('shop');
  if (!isValidShopDomain(shop)) {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_SHOP', message: 'A valid .myshopify.com domain is required.' } },
      { status: 400 }
    );
  }

  const state = generateState();
  const response = NextResponse.redirect(buildAuthorizeUrl(shop, state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return response;
}
