import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, parsePagination } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { recommendCredit } from '@/lib/rules/recommendation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Return → Credit opportunities: open returns with a recommended offer attached.
 *
 * Recommendations are computed here and shown to a merchant. Nothing is issued
 * until a human confirms it on /api/refunds/store-credit.
 */
export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const { take, skip, page } = parsePagination(request.nextUrl.searchParams, { defaultTake: 10 });

  const where = { shopId: shop.id, status: { in: ['OPEN', 'CREDIT_OFFERED'] } };
  const [events, total] = await Promise.all([
    prisma.returnEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.returnEvent.count({ where }),
  ]);

  const opportunities = [];
  for (const event of events) {
    const recommendation = await recommendCredit({
      shopId: shop.id,
      customerGid: event.customerGid,
      refundAmount: event.refundAmount,
      currencyCode: event.currencyCode,
    });
    opportunities.push({
      returnEventId: event.id,
      orderGid: event.orderGid,
      orderName: event.orderName,
      customerGid: event.customerGid,
      customerName: recommendation.context.displayName,
      refundAmount: event.refundAmount,
      currencyCode: event.currencyCode,
      status: event.status,
      recommendation: {
        eligible: recommendation.eligible,
        bonusAmount: recommendation.bonusAmount,
        totalCredit: recommendation.totalCredit,
        appliedRule: recommendation.appliedRule,
        explanation: recommendation.explanation,
      },
      customerProfile: {
        orders: recommendation.context.customerOrderCount ?? null,
        lifetimeValue: recommendation.context.customerLifetimeValue ?? null,
        previousCreditUses: recommendation.context.previousCreditUses,
        daysSinceLastOrder: recommendation.context.daysSinceLastOrder ?? null,
      },
    });
  }

  return ok({
    opportunities,
    pagination: { page, take, total, pages: Math.ceil(total / take) },
    recommendationsEnabled: shop.recommendationsEnabled,
  });
});
