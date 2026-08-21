import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { createOriginalPaymentRefund } from '@/lib/refunds/store-credit-refund';
import { ValidationError } from '@/lib/util/errors';
import { isDemoGid } from '@/lib/demo/identifiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(async (request) => {
  const { shop, session, userId } = await requireShop(request);
  const body = await readJson(request);
  if (isDemoGid(body.orderId)) {
    throw new ValidationError(
      'This is a demo order. A refund can only be issued against a real Shopify order.'
    );
  }

  if (!body.confirmed) throw new ValidationError('This refund has not been confirmed.');

  const result = await createOriginalPaymentRefund({
    shop,
    session,
    orderId: body.orderId,
    refundLineItems: body.refundLineItems || [],
    amount: body.refundAmount,
    currency: body.currencyCode,
    returnEventId: body.returnEventId || null,
    actorId: userId,
  });

  return ok({ refund: result });
});
