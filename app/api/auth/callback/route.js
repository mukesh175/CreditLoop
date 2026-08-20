import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma/client';
import { APP_URL, SHOPIFY_API_KEY } from '@/lib/config';
import { exchangeCodeForToken, OAUTH_STATE_COOKIE } from '@/lib/shopify/oauth';
import { isValidShopDomain, verifyQueryHmac } from '@/lib/shopify/hmac';
import { storeOfflineSession, getOfflineSession } from '@/lib/shopify/sessions';
import { registerWebhooks } from '@/lib/shopify/webhooks';
import { syncShopInfo } from '@/lib/credit/sync';
import { seedDefaultRules } from '@/lib/rules/defaults';
import { safeEqual } from '@/lib/util/crypto';
import { recordAudit, AUDIT } from '@/lib/util/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = request.nextUrl;
  const shop = url.searchParams.get('shop');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!isValidShopDomain(shop) || !code) {
    return NextResponse.json({ ok: false, error: 'Invalid OAuth callback.' }, { status: 400 });
  }
  if (!verifyQueryHmac(url.searchParams)) {
    return NextResponse.json({ ok: false, error: 'HMAC validation failed.' }, { status: 401 });
  }

  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!cookieState || !safeEqual(cookieState, state)) {
    return NextResponse.json({ ok: false, error: 'OAuth state mismatch.' }, { status: 401 });
  }

  const { accessToken, scope, expiresAt } = await exchangeCodeForToken(shop, code);
  const shopRecord = await storeOfflineSession({
    shopDomain: shop,
    accessToken,
    scope,
    expiresAt,
  });

  // Post-install setup. Failures here must not block the merchant from landing
  // in the app — the onboarding sync step retries them.
  const session = await getOfflineSession(shop);
  await Promise.allSettled([
    syncShopInfo({ shop: shopRecord, session }),
    registerWebhooks({ session }),
    seedDefaultRules({ shopId: shopRecord.id }),
    prisma.notificationPreference.upsert({
      where: { shopId: shopRecord.id },
      create: { shopId: shopRecord.id, merchantEmail: shopRecord.email },
      update: {},
    }),
  ]);

  await recordAudit({
    shopId: shopRecord.id,
    action: AUDIT.ADMIN_ACTION,
    actorType: 'SHOPIFY',
    reason: 'App installed / re-authorized',
    metadata: { scope },
  });

  const target = shopRecord.onboardingDone ? '' : '/onboarding';
  const response = NextResponse.redirect(
    `https://admin.shopify.com/store/${shop.replace('.myshopify.com', '')}/apps/${SHOPIFY_API_KEY}${target}`
  );
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
