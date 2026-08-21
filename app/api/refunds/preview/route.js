import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getSuggestedRefund, loadOrderForRefund } from '@/lib/refunds/store-credit-refund';
import { recommendCredit } from '@/lib/rules/recommendation';
import { getEntitlements } from '@/lib/billing/entitlements';
import { round2 } from '@/lib/util/money';
import { isDemoGid } from '@/lib/demo/identifiers';
import { ValidationError } from '@/lib/util/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Builds the confirmation screen a merchant sees before any money moves:
 * refund value, bonus, total credit, customer, order and currency.
 *
 * Read-only. Nothing here changes a balance.
 */
export const POST = withErrorHandling(async (request) => {
  const { shop, session } = await requireShop(request);
  const body = await readJson(request);

  // A demo order has no real money behind it. Refusing here keeps the refund
  // path honest — there is no meaningful preview to show.
  if (isDemoGid(body.orderId)) {
    throw new ValidationError(
      'This is a demo order. Refunds can only be previewed for real Shopify orders — clear the demo data to work with your live store.'
    );
  }

  const order = await loadOrderForRefund(session, body.orderId);
  const suggested = await getSuggestedRefund(session, body.orderId, body.refundLineItems || []);

  const refundAmount =
    body.refundAmount != null ? round2(Number(body.refundAmount)) : suggested.amount;

  const recommendation = await recommendCredit({
    shopId: shop.id,
    customerGid: order.customer?.id,
    refundAmount,
    currencyCode: suggested.currencyCode,
    customerFromShopify: order.customer,
  });

  const entitlements = await getEntitlements(shop);

  return ok({
    order: {
      id: order.id,
      name: order.name,
      createdAt: order.createdAt,
      currencyCode: suggested.currencyCode,
      total: Number(order.totalPriceSet?.shopMoney?.amount || 0),
      financialStatus: order.displayFinancialStatus,
      lineItems: order.lineItems?.nodes || [],
    },
    customer: order.customer
      ? {
          id: order.customer.id,
          displayName: order.customer.displayName,
          orderCount: Number(order.customer.numberOfOrders || 0),
          lifetimeValue: Number(order.customer.amountSpent?.amount || 0),
        }
      : null,
    refund: {
      refundAmount,
      maximumRefundable: suggested.maximumRefundable,
      currencyCode: suggested.currencyCode,
    },
    recommendation: {
      eligible: recommendation.eligible,
      bonusAmount: recommendation.bonusAmount,
      totalCredit: recommendation.totalCredit,
      appliedRule: recommendation.appliedRule,
      explanation: recommendation.explanation,
      evaluations: recommendation.evaluations,
      context: recommendation.context,
    },
    // Shown verbatim on the confirmation dialog.
    disclosure: recommendation.bonusAmount
      ? `The ${recommendation.bonusAmount} ${suggested.currencyCode} bonus is a merchant-funded promotional incentive paid by your store, on top of the ${refundAmount} ${suggested.currencyCode} refund.`
      : null,
    entitlements,
  });
});
