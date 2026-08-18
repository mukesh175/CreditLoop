import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret, forEachActiveShop } from '@/lib/api/cron-auth';
import { creditTotals, orderTotals, getOutstandingCredit } from '@/lib/analytics/metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Snapshots yesterday's metrics per currency. Upsert makes re-runs harmless. */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);

  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 86_400_000);

  const results = await forEachActiveShop(prisma, async (shop) => {
    const currencies = await prisma.creditEvent.findMany({
      where: { shopId: shop.id },
      distinct: ['currencyCode'],
      select: { currencyCode: true },
    });
    const codes = currencies.length
      ? currencies.map((c) => c.currencyCode)
      : [shop.currencyCode];

    for (const currencyCode of codes) {
      const [credit, orders, outstanding, returnsOffered, returnsAccepted] = await Promise.all([
        creditTotals({ shopId: shop.id, currencyCode, start, end }),
        orderTotals({ shopId: shop.id, currencyCode, start, end }),
        getOutstandingCredit({ shopId: shop.id, currencyCode }),
        prisma.returnEvent.count({
          where: { shopId: shop.id, currencyCode, createdAt: { gte: start, lt: end } },
        }),
        prisma.returnEvent.count({
          where: {
            shopId: shop.id,
            currencyCode,
            creditAccepted: true,
            createdAt: { gte: start, lt: end },
          },
        }),
      ]);

      await prisma.dailyMetric.upsert({
        where: { shopId_date_currencyCode: { shopId: shop.id, date: start, currencyCode } },
        create: {
          shopId: shop.id,
          date: start,
          currencyCode,
          creditIssued: credit.issued,
          creditRedeemed: credit.redeemed,
          bonusIssued: credit.bonus,
          outstandingCredit: outstanding.total,
          ordersUsingCredit: orders.count,
          revenueFromCreditOrders: orders.revenue,
          creditOffersUsed: credit.issuedCount,
          returnsOffered,
          returnsAcceptedCredit: returnsAccepted,
        },
        update: {
          creditIssued: credit.issued,
          creditRedeemed: credit.redeemed,
          bonusIssued: credit.bonus,
          outstandingCredit: outstanding.total,
          ordersUsingCredit: orders.count,
          revenueFromCreditOrders: orders.revenue,
          creditOffersUsed: credit.issuedCount,
          returnsOffered,
          returnsAcceptedCredit: returnsAccepted,
        },
      });
    }
    return { currencies: codes.length };
  });

  return ok({ job: 'daily-metrics', date: start.toISOString().slice(0, 10), results });
});

export const POST = GET;
