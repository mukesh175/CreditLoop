import prisma from '@/lib/prisma/client';
import { adminGraphql, assertNoUserErrors } from '@/lib/shopify/graphql';
import {
  ORDER_FOR_REFUND_QUERY,
  REFUND_CREATE_MUTATION,
  SUGGESTED_REFUND_QUERY,
} from '@/lib/shopify/queries';
import { AppError, ValidationError } from '@/lib/util/errors';
import { assertSameCurrency, isPositiveAmount, round2 } from '@/lib/util/money';
import { withIdempotency, refundIdempotencyKey } from '@/lib/util/idempotency';
import { recordAudit, AUDIT } from '@/lib/util/audit';
import { issueStoreCredit } from '@/lib/credit/store-credit';
import { consumeCreditOffer } from '@/lib/billing/entitlements';

/** Loads an order and confirms it is refundable, with its currency and customer. */
export async function loadOrderForRefund(session, orderGid) {
  const { data } = await adminGraphql(session, ORDER_FOR_REFUND_QUERY, { id: orderGid });
  const order = data?.order;
  if (!order) throw new ValidationError('That order could not be found in this store.');
  return order;
}

/** Asks Shopify what it would refund for these line items — never guessed locally. */
export async function getSuggestedRefund(session, orderGid, refundLineItems) {
  const { data } = await adminGraphql(session, SUGGESTED_REFUND_QUERY, {
    orderId: orderGid,
    refundLineItems: refundLineItems?.length ? refundLineItems : null,
  });
  const suggested = data?.order?.suggestedRefund;
  if (!suggested) {
    throw new ValidationError('Shopify did not return a refund suggestion for this order.');
  }
  return {
    amount: Number(suggested.amountSet.shopMoney.amount),
    currencyCode: suggested.amountSet.shopMoney.currencyCode,
    maximumRefundable: Number(suggested.maximumRefundableSet?.shopMoney?.amount || 0),
    subtotal: Number(suggested.subtotalSet?.shopMoney?.amount || 0),
    totalTax: Number(suggested.totalTaxSet?.shopMoney?.amount || 0),
  };
}

/**
 * Refunds an order to native Shopify store credit, optionally with a
 * merchant-funded bonus on top.
 *
 * Two distinct movements of money, kept visibly separate at every layer:
 *   1. refundCreate with a store-credit refund method — the customer's own money
 *      coming back as credit.
 *   2. an optional promotional top-up issued via storeCreditAccountCredit — the
 *      merchant's money. Never folded into the refund figure.
 *
 * This is only ever called from an explicit, confirmed merchant action.
 */
export async function createStoreCreditRefund({
  shop,
  session,
  orderId,
  refundLineItems = [],
  creditAmount,
  currency,
  bonusAmount = 0,
  note = null,
  returnEventId = null,
  ruleId = null,
  actorId = null,
}) {
  // --- Validation ---------------------------------------------------------
  if (!orderId) throw new ValidationError('An order is required.');
  if (!isPositiveAmount(creditAmount)) {
    throw new ValidationError('The refund amount must be greater than zero.');
  }
  const bonus = round2(Math.max(0, Number(bonusAmount) || 0));
  const refundValue = round2(creditAmount);

  const order = await loadOrderForRefund(session, orderId);

  // Ownership: the order must come from the authenticated shop's own Admin API.
  const orderCurrency = order.currencyCode || order.totalPriceSet?.shopMoney?.currencyCode;
  const code = assertSameCurrency(orderCurrency, currency);

  const customerGid = order.customer?.id;
  if (!customerGid) {
    throw new ValidationError(
      'This order has no customer account, so store credit cannot be issued for it.'
    );
  }

  const suggested = await getSuggestedRefund(session, orderId, refundLineItems);
  assertSameCurrency(suggested.currencyCode, code);

  if (refundValue > round2(suggested.maximumRefundable || suggested.amount)) {
    throw new ValidationError(
      `The refund amount exceeds the ${round2(
        suggested.maximumRefundable || suggested.amount
      )} ${code} still refundable on this order.`
    );
  }

  // Plan limits are enforced server-side, before any money moves.
  await consumeCreditOffer({ shop, dryRun: true });

  const idempotencyKey = refundIdempotencyKey({
    orderGid: orderId,
    amount: refundValue,
    currencyCode: code,
    bonusAmount: bonus,
  });

  // --- Execution ----------------------------------------------------------
  const { replayed, result } = await withIdempotency(
    {
      shopId: shop.id,
      key: idempotencyKey,
      operation: 'REFUND',
      requestPayload: { orderId, refundValue, code, bonus },
    },
    async () => {
      const input = {
        orderId,
        note: note || 'Refunded to store credit by CreditLoop',
        notify: true,
        refundMethods: [
          {
            storeCreditRefund: {
              amount: { amount: refundValue.toFixed(2), currencyCode: code },
            },
          },
        ],
      };
      if (refundLineItems?.length) input.refundLineItems = refundLineItems;

      const { data } = await adminGraphql(
        session,
        REFUND_CREATE_MUTATION,
        { input },
        { retryOnThrottle: false } // financial mutation: never auto-retry
      );

      const payload = data?.refundCreate;
      assertNoUserErrors(payload?.userErrors, 'The refund was not created.');

      const refund = payload?.refund;
      if (!refund?.id) {
        throw new AppError('Shopify did not confirm the refund.', {
          code: 'REFUND_UNCONFIRMED',
          status: 502,
        });
      }
      return { refundGid: refund.id, refundedAmount: refundValue, currencyCode: code };
    }
  ).catch(async (error) => {
    await recordAudit({
      shopId: shop.id,
      action: AUDIT.REFUND_CREATED,
      actorId,
      customerGid,
      orderGid: orderId,
      amount: refundValue,
      currencyCode: code,
      result: 'FAILURE',
      errorMessage: error?.message,
      reason: 'Refund to store credit',
    });
    throw error;
  });

  // Record the refund-sourced credit for analytics. Shopify already moved the
  // money as part of refundCreate — this row is a ledger entry, not a balance.
  if (!replayed) {
    await recordAudit({
      shopId: shop.id,
      action: AUDIT.REFUND_CREATED,
      actorId,
      customerGid,
      orderGid: orderId,
      amount: refundValue,
      currencyCode: code,
      reason: 'Refund to store credit',
      metadata: { refundGid: result.refundGid, bonusAmount: bonus },
    });

    await prisma.creditEvent.create({
      data: {
        shopId: shop.id,
        customerGid,
        eventType: 'CREDIT',
        amount: refundValue,
        currencyCode: code,
        source: 'RETURN_REFUND',
        orderGid: orderId,
        refundGid: result.refundGid,
        returnEventId,
        ruleId,
        metadata: { refundMethod: 'STORE_CREDIT' },
      },
    });
  }

  // --- Optional merchant-funded bonus ------------------------------------
  let bonusResult = null;
  if (bonus > 0) {
    bonusResult = await issueStoreCredit({
      shop,
      session,
      customerGid,
      amount: bonus,
      currencyCode: code,
      reason: 'Return credit bonus (merchant-funded promotional incentive)',
      source: 'RETURN_REFUND',
      orderGid: orderId,
      refundGid: result.refundGid,
      returnEventId,
      ruleId,
      bonusAmount: bonus,
      idempotencyKey: `${idempotencyKey}:bonus`,
      actorId,
      metadata: { promotional: true },
    });
  }

  if (!replayed) await consumeCreditOffer({ shop });

  if (returnEventId) {
    await prisma.returnEvent.update({
      where: { id: returnEventId },
      data: {
        refundMethod: 'STORE_CREDIT',
        creditAccepted: true,
        creditOffered: round2(refundValue + bonus),
        bonusAmount: bonus || null,
        refundGid: result.refundGid,
        ruleIdApplied: ruleId,
        status: 'CREDIT_ISSUED',
      },
    }).catch(() => null);
  }

  return {
    refundGid: result.refundGid,
    refundAmount: refundValue,
    bonusAmount: bonus,
    totalCredit: round2(refundValue + bonus),
    currencyCode: code,
    customerGid,
    orderName: order.name,
    bonusTransactionId: bonusResult?.transactionId || null,
    replayed,
  };
}

/**
 * Refunds to the original payment method — the "no thanks" path, kept in the
 * same service so both outcomes of the Return → Credit decision are auditable.
 */
export async function createOriginalPaymentRefund({
  shop,
  session,
  orderId,
  refundLineItems = [],
  amount,
  currency,
  returnEventId = null,
  actorId = null,
}) {
  const order = await loadOrderForRefund(session, orderId);
  const code = assertSameCurrency(
    order.currencyCode || order.totalPriceSet?.shopMoney?.currencyCode,
    currency
  );
  const value = round2(amount);
  if (!isPositiveAmount(value)) throw new ValidationError('Refund amount must be greater than zero.');

  const parentTransaction = (order.transactions || []).find(
    (t) => t.kind === 'SALE' || t.kind === 'CAPTURE'
  );
  if (!parentTransaction) {
    throw new ValidationError('This order has no captured payment to refund against.');
  }

  const key = `${refundIdempotencyKey({
    orderGid: orderId,
    amount: value,
    currencyCode: code,
  })}:original`;

  const { result } = await withIdempotency(
    { shopId: shop.id, key, operation: 'REFUND', requestPayload: { orderId, value, code } },
    async () => {
      const input = {
        orderId,
        note: 'Refunded to original payment method',
        notify: true,
        transactions: [
          {
            orderId,
            gateway: parentTransaction.gateway,
            kind: 'REFUND',
            parentId: parentTransaction.id,
            amount: value.toFixed(2),
          },
        ],
      };
      if (refundLineItems?.length) input.refundLineItems = refundLineItems;

      const { data } = await adminGraphql(
        session,
        REFUND_CREATE_MUTATION,
        { input },
        { retryOnThrottle: false }
      );
      assertNoUserErrors(data?.refundCreate?.userErrors, 'The refund was not created.');
      const refund = data?.refundCreate?.refund;
      if (!refund?.id) throw new AppError('Shopify did not confirm the refund.', { status: 502 });
      return { refundGid: refund.id };
    }
  );

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.REFUND_CREATED,
    actorId,
    customerGid: order.customer?.id || null,
    orderGid: orderId,
    amount: value,
    currencyCode: code,
    reason: 'Refund to original payment method',
    metadata: { refundGid: result.refundGid },
  });

  if (returnEventId) {
    await prisma.returnEvent.update({
      where: { id: returnEventId },
      data: {
        refundMethod: 'ORIGINAL_PAYMENT',
        creditAccepted: false,
        refundGid: result.refundGid,
        status: 'REFUNDED',
      },
    }).catch(() => null);
  }

  return { refundGid: result.refundGid, amount: value, currencyCode: code };
}
