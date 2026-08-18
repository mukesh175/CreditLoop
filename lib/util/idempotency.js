import prisma from '@/lib/prisma/client';
import { AppError } from '@/lib/util/errors';
import { sha256 } from '@/lib/util/crypto';

/**
 * Idempotency guard for financial mutations.
 *
 * The contract: a given (shop, key) executes `operationFn` at most once. A
 * concurrent or repeated call either returns the stored result or — if the first
 * attempt is still in flight — refuses rather than risking a duplicate credit.
 *
 * This is what makes "merchant double-clicks Confirm" safe.
 */
export async function withIdempotency(
  { shopId, key, operation, requestPayload },
  operationFn
) {
  const requestHash = sha256(JSON.stringify(requestPayload ?? {}));

  const existing = await prisma.idempotencyRecord.findUnique({
    where: { shopId_key: { shopId, key } },
  });

  if (existing) {
    if (existing.status === 'SUCCEEDED') {
      return { replayed: true, result: existing.responseJson };
    }
    if (existing.status === 'IN_PROGRESS') {
      throw new AppError(
        'An identical request is already being processed. No additional store credit was created.',
        { code: 'IDEMPOTENT_IN_PROGRESS', status: 409 }
      );
    }
    // Previous attempt failed before reaching Shopify — allow one retry.
    await prisma.idempotencyRecord.update({
      where: { id: existing.id },
      data: { status: 'IN_PROGRESS', requestHash },
    });
  } else {
    try {
      await prisma.idempotencyRecord.create({
        data: { shopId, key, operation, status: 'IN_PROGRESS', requestHash },
      });
    } catch (error) {
      // Unique-constraint race: another request won. Do not execute.
      throw new AppError(
        'An identical request is already being processed. No additional store credit was created.',
        { code: 'IDEMPOTENT_IN_PROGRESS', status: 409, details: String(error) }
      );
    }
  }

  try {
    const result = await operationFn();
    await prisma.idempotencyRecord.update({
      where: { shopId_key: { shopId, key } },
      data: {
        status: 'SUCCEEDED',
        responseJson: result ?? undefined,
        shopifyTransactionId: result?.transactionId || null,
      },
    });
    return { replayed: false, result };
  } catch (error) {
    // The mutation may or may not have reached Shopify. We mark FAILED so the
    // record is inspectable, and the caller surfaces a "verify before retrying"
    // message rather than retrying automatically.
    await prisma.idempotencyRecord.update({
      where: { shopId_key: { shopId, key } },
      data: { status: 'FAILED', responseJson: { error: String(error?.message || error) } },
    });
    throw error;
  }
}

/** Stable key for a refund so a repeated confirm cannot double-refund. */
export function refundIdempotencyKey({ orderGid, amount, currencyCode, bonusAmount = 0 }) {
  return `refund:${sha256(`${orderGid}|${amount}|${currencyCode}|${bonusAmount}`)}`;
}

/** Stable key for a campaign grant so a re-run cannot double-credit. */
export function campaignCreditKey({ campaignId, customerGid }) {
  return `campaign:${campaignId}:${customerGid}`;
}
