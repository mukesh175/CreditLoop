import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getEntitlements } from '@/lib/billing/entitlements';
import { recordAudit, AUDIT } from '@/lib/util/audit';
import { SHOPIFY_SCOPES, SHOPIFY_API_VERSION, DEMO_MODE_ALLOWED } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Shop context for the embedded app. Never returns the access token. */
export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const entitlements = await getEntitlements(shop);

  return ok({
    shop: {
      domain: shop.domain,
      name: shop.name,
      currencyCode: shop.currencyCode,
      plan: shop.plan,
      billingStatus: shop.billingStatus,
      onboardingDone: shop.onboardingDone,
      onboardingStep: shop.onboardingStep,
      lastSyncAt: shop.lastSyncAt,
      lastSyncStatus: shop.lastSyncStatus,
      demoMode: shop.demoMode,
      defaultBonusPercent: shop.defaultBonusPercent,
      defaultMaxBonus: shop.defaultMaxBonus,
      recommendationsEnabled: shop.recommendationsEnabled,
    },
    entitlements,
    apiVersion: SHOPIFY_API_VERSION,
    scopes: SHOPIFY_SCOPES,
    demoModeAvailable: DEMO_MODE_ALLOWED,
  });
});

/** Updates general settings. */
export const PATCH = withErrorHandling(async (request) => {
  const { shop, userId } = await requireShop(request);
  const body = await readJson(request);

  const data = {};
  if (body.defaultBonusPercent != null) {
    data.defaultBonusPercent = Math.max(0, Math.min(100, Number(body.defaultBonusPercent)));
  }
  if (body.defaultMaxBonus != null) {
    data.defaultMaxBonus = Math.max(0, Number(body.defaultMaxBonus));
  }
  if (body.recommendationsEnabled != null) {
    data.recommendationsEnabled = Boolean(body.recommendationsEnabled);
  }

  const updated = await prisma.shop.update({ where: { id: shop.id }, data });
  await recordAudit({
    shopId: shop.id,
    action: AUDIT.SETTINGS_UPDATED,
    actorId: userId,
    metadata: data,
  });

  return ok({ shop: { ...data, domain: updated.domain } });
});
