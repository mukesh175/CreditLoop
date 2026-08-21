import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { createStoreCreditRefund } from '@/lib/refunds/store-credit-refund';
import { ValidationError } from '@/lib/util/errors';
import { isDemoGid } from '@/lib/demo/identifiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Executes a refund to store credit.
 *
 * This is the only path in the app that turns a return into credit, and it runs
 * exclusively from an explicit, confirmed merchant action — never from a webhook
 * or a background job.
 */
export const POST = withErrorHandling(async (request) => {
  const { shop, session, userId } = await requireShop(request);
  const body = await readJson(request);

  if (isDemoGid(body.orderId)) {
    throw new ValidationError(
      'This is a demo order. A refund to store credit can only be issued against a real Shopify order.'
    );
  }

  if (!body.confirmed) {
    throw new ValidationError(
      'This refund has not been confirmed. Review the amounts and confirm before submitting.'
    );
  }

  const result = await createStoreCreditRefund({
    shop,
    session,
    orderId: body.orderId,
    refundLineItems: body.refundLineItems || [],
    creditAmount: body.refundAmount,
    currency: body.currencyCode,
    bonusAmount: body.bonusAmount || 0,
    note: body.note || null,
    returnEventId: body.returnEventId || null,
    ruleId: body.ruleId || null,
    actorId: userId,
  });

  return ok({ refund: result });
});
