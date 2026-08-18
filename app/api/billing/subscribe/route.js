import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { createSubscription, cancelSubscription } from '@/lib/billing/subscriptions';
import { recordAudit, AUDIT } from '@/lib/util/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Starts a Shopify-managed subscription; the merchant approves it in Shopify. */
export const POST = withErrorHandling(async (request) => {
  const { shop, session, userId } = await requireShop(request);
  const body = await readJson(request);

  if (body.action === 'cancel') {
    const result = await cancelSubscription({ shop, session });
    await recordAudit({
      shopId: shop.id,
      action: AUDIT.ADMIN_ACTION,
      actorId: userId,
      reason: 'Subscription cancelled',
    });
    return ok(result);
  }

  const result = await createSubscription({ shop, session, planId: body.plan });
  await recordAudit({
    shopId: shop.id,
    action: AUDIT.ADMIN_ACTION,
    actorId: userId,
    reason: `Subscription requested: ${body.plan}`,
  });
  return ok(result);
});
