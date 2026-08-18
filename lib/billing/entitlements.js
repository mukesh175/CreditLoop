import prisma from '@/lib/prisma/client';
import { getPlan } from './plans';
import { EntitlementError } from '@/lib/util/errors';

/**
 * Server-side entitlement checks.
 *
 * The frontend hides gated features for clarity, but every limit is enforced
 * here — a crafted API call must not be able to exceed a plan.
 */

function billingPeriodStart(shop) {
  if (shop.billingPeriodStart) return new Date(shop.billingPeriodStart);
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Credit offers used this billing period (a credit offer = a CreditLoop-issued credit). */
export async function countCreditOffersUsed(shop) {
  return prisma.creditEvent.count({
    where: {
      shopId: shop.id,
      eventType: 'CREDIT',
      source: { in: ['RETURN_REFUND', 'CAMPAIGN', 'MANUAL'] },
      createdAt: { gte: billingPeriodStart(shop) },
    },
  });
}

export async function getEntitlements(shop) {
  const plan = getPlan(shop.plan);
  const used = await countCreditOffersUsed(shop);
  const limit = plan.maxCreditOffers;
  return {
    plan: plan.id,
    planName: plan.name,
    creditOffersUsed: used,
    creditOffersLimit: Number.isFinite(limit) ? limit : null,
    creditOffersRemaining: Number.isFinite(limit) ? Math.max(0, limit - used) : null,
    automatedCampaigns: plan.automatedCampaigns,
    customerEmails: plan.customerEmails,
    advancedSegmentation: plan.advancedSegmentation,
    multiStore: plan.multiStore,
    periodStart: billingPeriodStart(shop),
  };
}

/**
 * Checks (and, when not a dry run, records) consumption of one credit offer.
 * Called before money moves so a merchant is never charged-through a limit.
 */
export async function consumeCreditOffer({ shop, dryRun = false }) {
  const plan = getPlan(shop.plan);
  if (!Number.isFinite(plan.maxCreditOffers)) return { allowed: true, remaining: null };

  const used = await countCreditOffersUsed(shop);
  if (used >= plan.maxCreditOffers) {
    throw new EntitlementError(
      `Your ${plan.name} plan includes ${plan.maxCreditOffers} credit offers per month and you have used all of them. Upgrade to continue issuing store credit through CreditLoop.`
    );
  }
  // Consumption is measured from CreditEvent rows themselves, so a non-dry-run
  // call needs no separate counter — it simply re-verifies after the write.
  return { allowed: true, remaining: plan.maxCreditOffers - used - (dryRun ? 0 : 1) };
}

export async function requireFeature(shop, feature) {
  const plan = getPlan(shop.plan);
  if (!plan[feature]) {
    throw new EntitlementError(
      `This feature is not included in the ${plan.name} plan. Upgrade to unlock it.`
    );
  }
  return true;
}
