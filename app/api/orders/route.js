import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, parsePagination } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Orders list, served from CreditLoop's attribution table rather than a live
 * Shopify query — the dashboard must not fetch thousands of Shopify records on
 * every page load.
 */
export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const { searchParams } = request.nextUrl;
  const { take, skip, page } = parsePagination(searchParams);
  const creditOnly = searchParams.get('creditOnly') === 'true';

  const where = {
    shopId: shop.id,
    ...(creditOnly ? { creditAmountUsed: { gt: 0 } } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.orderAttribution.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.orderAttribution.count({ where }),
  ]);

  const customerGids = [...new Set(orders.map((o) => o.customerGid).filter(Boolean))];
  const [metrics, refunds] = await Promise.all([
    prisma.customerMetric.findMany({
      where: { shopId: shop.id, customerGid: { in: customerGids } },
      select: { customerGid: true, displayName: true },
    }),
    prisma.returnEvent.findMany({
      where: { shopId: shop.id, orderGid: { in: orders.map((o) => o.orderGid) } },
      select: { orderGid: true, refundAmount: true, refundMethod: true, currencyCode: true },
    }),
  ]);

  const nameByCustomer = new Map(metrics.map((m) => [m.customerGid, m.displayName]));
  const refundByOrder = new Map(refunds.map((r) => [r.orderGid, r]));

  return ok({
    orders: orders.map((o) => ({
      orderGid: o.orderGid,
      orderName: o.orderName,
      customerGid: o.customerGid,
      customerName: o.customerGid ? nameByCustomer.get(o.customerGid) || null : null,
      total: o.orderTotal,
      creditUsed: o.creditAmountUsed,
      currencyCode: o.currencyCode,
      refund: refundByOrder.get(o.orderGid) || null,
      isRepeatPurchase: o.isRepeatPurchase,
      createdAt: o.createdAt,
    })),
    pagination: { page, take, total, pages: Math.ceil(total / take) },
  });
});
