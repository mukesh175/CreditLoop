import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { syncShopInfo, syncCustomers, syncCreditBalances } from '@/lib/credit/sync';
import { registerWebhooks } from '@/lib/shopify/webhooks';
import { recordAudit, AUDIT } from '@/lib/util/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const [rules, customers, orders] = await Promise.all([
    prisma.creditRule.count({ where: { shopId: shop.id } }),
    prisma.customerMetric.count({ where: { shopId: shop.id } }),
    prisma.orderAttribution.count({ where: { shopId: shop.id } }),
  ]);
  return ok({
    step: shop.onboardingStep,
    done: shop.onboardingDone,
    counts: { rules, customers, orders },
    defaults: {
      defaultBonusPercent: shop.defaultBonusPercent,
      defaultMaxBonus: shop.defaultMaxBonus,
      recommendationsEnabled: shop.recommendationsEnabled,
    },
  });
});

/** Advances onboarding and runs the initial sync on the final step. */
export const POST = withErrorHandling(async (request) => {
  const { shop, session, userId } = await requireShop(request);
  const body = await readJson(request);

  if (body.action === 'sync') {
    const shopRecord = await syncShopInfo({ shop, session });
    const [webhooks, customers, balances] = await Promise.all([
      registerWebhooks({ session }),
      syncCustomers({ shop: shopRecord, session, maxPages: 3 }),
      syncCreditBalances({ shop: shopRecord, session, limit: 50 }),
    ]);
    return ok({
      sync: {
        shop: true,
        webhooks: webhooks.filter((w) => w.status !== 'FAILED').length,
        customers: customers.synced,
        creditBalances: balances.updated,
      },
    });
  }

  const data = {};
  if (body.step != null) data.onboardingStep = Number(body.step);
  if (body.done) {
    data.onboardingDone = true;
    data.onboardingStep = 6;
  }
  if (body.defaultBonusPercent != null) {
    data.defaultBonusPercent = Math.max(0, Math.min(100, Number(body.defaultBonusPercent)));
  }
  if (body.defaultMaxBonus != null) data.defaultMaxBonus = Math.max(0, Number(body.defaultMaxBonus));
  if (body.recommendationsEnabled != null) {
    data.recommendationsEnabled = Boolean(body.recommendationsEnabled);
  }

  const updated = await prisma.shop.update({ where: { id: shop.id }, data });

  if (body.done) {
    await recordAudit({
      shopId: shop.id,
      action: AUDIT.ADMIN_ACTION,
      actorId: userId,
      reason: 'Onboarding completed',
    });
  }

  return ok({ step: updated.onboardingStep, done: updated.onboardingDone });
});
