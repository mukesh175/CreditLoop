import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { syncShopInfo, syncCustomers, syncOrders, syncCreditBalances } from '@/lib/credit/sync';
import { registerWebhooks } from '@/lib/shopify/webhooks';
import { recordAudit, AUDIT } from '@/lib/util/audit';
import { SHOPIFY_SCOPES } from '@/lib/config';

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
/** Shopify's wording for an unapproved protected-data request. */
function isProtectedDataError(message) {
  const text = String(message).toLowerCase();
  return (
    text.includes('protected customer data') ||
    text.includes('not approved') ||
    text.includes('access denied')
  );
}

export const POST = withErrorHandling(async (request) => {
  const { shop, session, userId } = await requireShop(request);
  const body = await readJson(request);

  if (body.action === 'sync') {
    const shopRecord = await syncShopInfo({ shop, session }).catch(() => shop);

    // Each part reports independently. One rejection must not hide the results
    // of the others, or mask *why* it failed — a store waiting on protected
    // customer data approval needs to be told that, not shown a blank page.
    const [webhooks, customers, orders, balances] = await Promise.allSettled([
      registerWebhooks({ session }),
      syncCustomers({ shop: shopRecord, session, maxPages: 3 }),
      syncOrders({ shop: shopRecord, session, maxPages: 3 }),
      syncCreditBalances({ shop: shopRecord, session, limit: 50 }),
    ]);

    const webhookResults = webhooks.status === 'fulfilled' ? webhooks.value : [];
    const blockedTopics = webhookResults
      .filter((w) => w.status === 'NEEDS_PROTECTED_DATA_APPROVAL')
      .map((w) => w.topic);

    const blocked = [];
    const describe = (label, settled, read) => {
      if (settled.status === 'fulfilled') return read(settled.value);

      const reason = settled.reason;
      const message = String(reason?.message || reason);
      const denied = reason?.code === 'SHOPIFY_ACCESS_DENIED' || isProtectedDataError(message);
      if (denied) blocked.push(label);

      return {
        error: denied ? 'NEEDS_PROTECTED_DATA_APPROVAL' : 'FAILED',
        // Shopify names the missing scope or approval — show it verbatim.
        detail: message.slice(0, 300),
      };
    };

    const sync = {
      shop: true,
      webhooks: webhookResults.filter(
        (w) => w.status === 'REGISTERED' || w.status === 'ALREADY_REGISTERED'
      ).length,
      customers: describe('customers', customers, (v) => v.synced),
      orders: describe('orders', orders, (v) => v.synced),
      ordersUsingCredit: orders.status === 'fulfilled' ? orders.value.withCredit : null,
      creditBalances: describe('store credit balances', balances, (v) => v.updated),
    };

    const needsApproval = [...new Set([...blocked, ...(blockedTopics.length ? ['webhooks'] : [])])];

    // A scope the app asks for but the token does not carry cannot be fixed by
    // any approval — the store has to re-authorise. Worth telling apart.
    const granted = (shopRecord.scopes || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const missingScopes = SHOPIFY_SCOPES.filter((scope) => !granted.includes(scope));

    return ok({
      sync,
      // Not an error — the app works, but this data stays empty until the
      // Partner dashboard grants protected customer data access.
      missingScopes: missingScopes.length
        ? {
            scopes: missingScopes,
            message:
              'The access token for this store does not carry ' +
              missingScopes.join(', ') +
              '. That is a re-authorisation, not an approval — uninstall CreditLoop from the store and open it again to grant the current scopes.',
          }
        : null,
      grantedScopes: granted,
      pendingApproval: needsApproval.length
        ? {
            topics: blockedTopics,
            blocked: needsApproval,
            message:
              'Shopify is blocking ' +
              needsApproval.join(', ') +
              ' until your app is approved for protected customer data. Request it in your Partner dashboard under App setup > Protected customer data access, then run this sync again.',
          }
        : null,
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
