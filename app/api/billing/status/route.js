import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { syncSubscription } from '@/lib/billing/subscriptions';
import { getEntitlements } from '@/lib/billing/entitlements';
import { PLANS } from '@/lib/billing/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request) => {
  const { shop, session } = await requireShop(request);
  const subscription = await syncSubscription({ shop, session }).catch(() => null);
  const entitlements = await getEntitlements({ ...shop, plan: subscription?.plan || shop.plan });
  return ok({
    plans: Object.values(PLANS).map((p) => ({
      ...p,
      maxCreditOffers: Number.isFinite(p.maxCreditOffers) ? p.maxCreditOffers : null,
    })),
    currentPlan: subscription?.plan || shop.plan,
    status: subscription?.status || shop.billingStatus,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    entitlements,
  });
});
