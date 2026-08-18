import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret, forEachActiveShop } from '@/lib/api/cron-auth';
import { creditTotals, orderTotals, getOutstandingCredit } from '@/lib/analytics/metrics';
import { weeklyReportEmail } from '@/lib/email/weekly-report';
import { sendEmail } from '@/lib/email/client';
import { APP_URL } from '@/lib/config';
import { round2 } from '@/lib/util/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Weekly merchant report. Dedupe key per week makes a re-run a no-op. */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86_400_000);
  const weekStart = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );

  const results = await forEachActiveShop(prisma, async (shop) => {
    const currencyCode = shop.currencyCode;
    const [credit, orders, outstanding, prefs, topCampaign] = await Promise.all([
      creditTotals({ shopId: shop.id, currencyCode, start, end }),
      orderTotals({ shopId: shop.id, currencyCode, start, end }),
      getOutstandingCredit({ shopId: shop.id, currencyCode }),
      prisma.notificationPreference.findUnique({ where: { shopId: shop.id } }),
      prisma.creditCampaign.findFirst({
        where: { shopId: shop.id, status: 'ACTIVE' },
        orderBy: { lastRunAt: 'desc' },
      }),
    ]);

    const metrics = {
      currencyCode,
      creditIssued: credit.issued,
      creditRedeemed: credit.redeemed,
      ordersUsingCredit: orders.count,
      revenueFromCreditOrders: orders.revenue,
      outstandingCredit: outstanding.total,
      creditRedemptionRate: credit.issued ? round2((credit.redeemed / credit.issued) * 100) : 0,
      topCampaign: topCampaign?.name || null,
    };

    await prisma.weeklyMetric.upsert({
      where: { shopId_weekStart_currencyCode: { shopId: shop.id, weekStart, currencyCode } },
      create: {
        shopId: shop.id,
        weekStart,
        currencyCode,
        creditIssued: metrics.creditIssued,
        creditRedeemed: metrics.creditRedeemed,
        ordersUsingCredit: metrics.ordersUsingCredit,
        revenueFromCreditOrders: metrics.revenueFromCreditOrders,
        outstandingCredit: metrics.outstandingCredit,
        redemptionRate: metrics.creditRedemptionRate,
        topCampaignId: topCampaign?.id || null,
      },
      update: {
        creditIssued: metrics.creditIssued,
        creditRedeemed: metrics.creditRedeemed,
        ordersUsingCredit: metrics.ordersUsingCredit,
        revenueFromCreditOrders: metrics.revenueFromCreditOrders,
        outstandingCredit: metrics.outstandingCredit,
        redemptionRate: metrics.creditRedemptionRate,
      },
    });

    if (!prefs?.weeklyReport || !prefs.merchantEmail) {
      return { emailed: false, reason: 'disabled_or_no_address' };
    }

    const message = weeklyReportEmail({
      shopDomain: shop.domain,
      metrics,
      appUrl: APP_URL,
    });
    const sendResult = await sendEmail({
      shopId: shop.id,
      to: prefs.merchantEmail,
      subject: message.subject,
      html: message.html,
      text: message.text,
      audience: 'MERCHANT',
      template: 'weekly-report',
      dedupeKey: `weekly-report:${weekStart.toISOString().slice(0, 10)}`,
    });

    if (sendResult.sent) {
      await prisma.weeklyMetric.updateMany({
        where: { shopId: shop.id, weekStart, currencyCode },
        data: { reportSentAt: new Date() },
      });
    }
    return { emailed: Boolean(sendResult.sent) };
  });

  return ok({ job: 'weekly-report', results });
});

export const POST = GET;
