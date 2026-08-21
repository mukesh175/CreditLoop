import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { issueStoreCredit } from '@/lib/credit/store-credit';
import { consumeCreditOffer } from '@/lib/billing/entitlements';
import { ValidationError } from '@/lib/util/errors';
import { sha256 } from '@/lib/util/crypto';
import { isDemoGid } from '@/lib/demo/identifiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Issues store credit directly (VIP reward, goodwill gesture, campaign top-up).
 *
 * Requires explicit confirmation and an idempotency key. If the client omits a
 * key we derive a stable one from the request so a double-submit cannot create
 * credit twice.
 */
export const POST = withErrorHandling(async (request) => {
  const { shop, session, userId } = await requireShop(request);
  const body = await readJson(request);

  if (isDemoGid(body.customerId)) {
    throw new ValidationError(
      'This is a demo customer. Store credit can only be issued to a real Shopify customer.'
    );
  }

  if (!body.confirmed) {
    throw new ValidationError('Confirm the amount before issuing store credit.');
  }
  if (!body.reason) {
    throw new ValidationError('A reason is required so the credit is explainable later.');
  }

  await consumeCreditOffer({ shop, dryRun: true });

  const idempotencyKey =
    body.idempotencyKey ||
    `manual:${sha256(
      `${body.customerId}|${body.amount}|${body.currencyCode}|${body.reason}|${new Date()
        .toISOString()
        .slice(0, 13)}`
    )}`;

  const result = await issueStoreCredit({
    shop,
    session,
    customerGid: body.customerId,
    amount: body.amount,
    currencyCode: body.currencyCode || shop.currencyCode,
    reason: body.reason,
    source: body.campaignId ? 'CAMPAIGN' : 'MANUAL',
    campaignId: body.campaignId || null,
    expiresAt: body.expiresAt || null,
    idempotencyKey,
    actorId: userId,
  });

  return ok({ credit: result });
});
