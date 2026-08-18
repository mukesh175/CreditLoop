import prisma from '@/lib/prisma/client';
import { evaluateRules } from './engine';
import { round2 } from '@/lib/util/money';

/**
 * Builds the rules-engine context for a customer from cached CreditLoop metrics
 * plus whatever Shopify has already told us about this order.
 *
 * Anything we genuinely do not know is left undefined rather than defaulted to
 * zero, so conditions on unknown fields fail closed instead of granting money.
 */
export async function buildRecommendationContext({
  shopId,
  customerGid,
  refundAmount,
  currencyCode,
  customerFromShopify = null,
}) {
  const metric = customerGid
    ? await prisma.customerMetric.findUnique({
        where: { shopId_customerGid: { shopId, customerGid } },
      })
    : null;

  const orderCount =
    customerFromShopify?.numberOfOrders != null
      ? Number(customerFromShopify.numberOfOrders)
      : metric?.orderCount;

  const lifetimeValue =
    customerFromShopify?.amountSpent?.amount != null
      ? Number(customerFromShopify.amountSpent.amount)
      : metric?.lifetimeValue;

  const averageOrderValue =
    metric?.averageOrderValue ||
    (orderCount && lifetimeValue ? round2(lifetimeValue / orderCount) : undefined);

  const daysSinceLastOrder = metric?.lastOrderAt
    ? Math.floor((Date.now() - new Date(metric.lastOrderAt).getTime()) / 86_400_000)
    : undefined;

  return {
    refundAmount: round2(refundAmount),
    currencyCode: String(currencyCode || '').toUpperCase(),
    customerOrderCount: orderCount,
    customerLifetimeValue: lifetimeValue,
    averageOrderValue,
    daysSinceLastOrder,
    previousCreditUses: metric?.creditUseCount ?? 0,
    previousReturns: metric?.returnCount ?? 0,
    displayName: metric?.displayName || customerFromShopify?.displayName || null,
  };
}

/** Human-readable justification shown next to every recommendation. */
export function explainRecommendation(context, result) {
  if (!result.eligible) {
    return 'No credit rule matched this return. Refunding to the original payment method is recommended.';
  }
  const signals = [];
  if (Number(context.customerOrderCount) >= 5) {
    signals.push(`${context.customerOrderCount} previous orders`);
  } else if (Number(context.customerOrderCount) >= 2) {
    signals.push('a repeat customer');
  }
  if (Number(context.customerLifetimeValue) >= 500) {
    signals.push('high lifetime value');
  }
  if (Number(context.previousCreditUses) > 0) {
    signals.push(`has redeemed store credit ${context.previousCreditUses} time(s) before`);
  }
  if (Number(context.daysSinceLastOrder) <= 30 && context.daysSinceLastOrder != null) {
    signals.push('purchased recently');
  }

  const base = `Matched rule "${result.appliedRule.name}".`;
  if (!signals.length) return base;
  return `${base} This customer is ${signals.join(', ')}.`;
}

export async function recommendCredit({
  shopId,
  customerGid,
  refundAmount,
  currencyCode,
  customerFromShopify = null,
  now = new Date(),
}) {
  const rules = await prisma.creditRule.findMany({
    where: { shopId, enabled: true },
    include: { conditions: true },
    orderBy: { priority: 'desc' },
  });

  const context = await buildRecommendationContext({
    shopId,
    customerGid,
    refundAmount,
    currencyCode,
    customerFromShopify,
  });

  const result = evaluateRules(rules, context, now);
  return { ...result, context, explanation: explainRecommendation(context, result) };
}
