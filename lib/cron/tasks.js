import prisma from '@/lib/prisma/client';
import { forEachActiveShop } from '@/lib/api/cron-auth';
import { getOfflineSession } from '@/lib/shopify/sessions';
import { syncCreditBalances, syncCustomers, syncOrders } from '@/lib/credit/sync';
import { reconcileShop } from '@/lib/credit/reconcile';
import { runCampaign } from '@/lib/campaigns/runner';
import { creditTotals, orderTotals, getOutstandingCredit } from '@/lib/analytics/metrics';
import { weeklyReportEmail } from '@/lib/email/weekly-report';
import { sendEmail } from '@/lib/email/client';
import { APP_URL } from '@/lib/config';
import { round2 } from '@/lib/util/money';

/**
 * Scheduled work, factored out of the route handlers.
 *
 * Each task is callable on its own endpoint *and* from the consolidated
 * `/api/cron/daily` runner, which is what Vercel's Hobby plan needs — it allows
 * a cron to fire only once a day, so all of these have to share one invocation.
 *
 * Every task is idempotent: running one twice in a day produces no duplicate
 * credit, emails or metric rows.
 */

/** Refreshes cached Shopify balances and customer metrics. */
export async function syncCreditTask({ shopLimit = 25 } = {}) {
  return forEachActiveShop(
    prisma,
    async (shop) => {
      const session = await getOfflineSession(shop.domain);
      const customers = await syncCustomers({
        shop,
        session,
        maxPages: 2,
        updatedSince: shop.lastSyncAt,
      });
      const orders = await syncOrders({
        shop,
        session,
        maxPages: 2,
        createdSince: shop.lastSyncAt,
      });
      const balances = await syncCreditBalances({ shop, session, limit: 100 });
      return {
        customers: customers.synced,
        orders: orders.synced,
        balances: balances.updated,
      };
    },
    { limit: shopLimit }
  );
}

/** Snapshots yesterday's metrics per currency. Upsert makes re-runs harmless. */
export async function dailyMetricsTask({ shopLimit = 25 } = {}) {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 86_400_000);

  const results = await forEachActiveShop(
    prisma,
    async (shop) => {
      const currencies = await prisma.creditEvent.findMany({
        where: { shopId: shop.id },
        distinct: ['currencyCode'],
        select: { currencyCode: true },
      });
      const codes = currencies.length ? currencies.map((c) => c.currencyCode) : [shop.currencyCode];

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

        const metrics = {
          creditIssued: credit.issued,
          creditRedeemed: credit.redeemed,
          bonusIssued: credit.bonus,
          outstandingCredit: outstanding.total,
          ordersUsingCredit: orders.count,
          revenueFromCreditOrders: orders.revenue,
          creditOffersUsed: credit.issuedCount,
          returnsOffered,
          returnsAcceptedCredit: returnsAccepted,
        };

        await prisma.dailyMetric.upsert({
          where: { shopId_date_currencyCode: { shopId: shop.id, date: start, currencyCode } },
          create: { shopId: shop.id, date: start, currencyCode, ...metrics },
          update: metrics,
        });
      }
      return { currencies: codes.length };
    },
    { limit: shopLimit }
  );

  return { date: start.toISOString().slice(0, 10), results };
}

/** Runs every ACTIVE campaign in bounded batches. */
export async function processCampaignsTask({ shopLimit = 25, batchSize = 25 } = {}) {
  return forEachActiveShop(
    prisma,
    async (shop) => {
      const now = new Date();
      const campaigns = await prisma.creditCampaign.findMany({
        where: {
          shopId: shop.id,
          status: 'ACTIVE',
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        take: 5,
      });
      if (!campaigns.length) return { campaigns: 0 };

      const session = await getOfflineSession(shop.domain);
      const summaries = [];
      for (const campaign of campaigns) {
        summaries.push({
          campaign: campaign.name,
          ...(await runCampaign({ shop, session, campaign, batchSize })),
        });
      }
      return { campaigns: campaigns.length, summaries };
    },
    { limit: shopLimit }
  );
}

/** Compares Shopify balances against the ledger. Never writes to Shopify. */
export async function reconcileTask({ shopLimit = 25, customerLimit = 50 } = {}) {
  return forEachActiveShop(
    prisma,
    async (shop) => {
      const session = await getOfflineSession(shop.domain);
      return reconcileShop({ shop, session, limit: customerLimit });
    },
    { limit: shopLimit }
  );
}

/**
 * Weekly merchant report.
 *
 * Safe to invoke daily: the send is deduped per ISO week, so only the first run
 * of a given week actually emails. `force` bypasses the weekday check for manual
 * runs and for Pro deployments that schedule this on its own cron.
 */
export async function weeklyReportTask({ shopLimit = 25, force = false, now = new Date() } = {}) {
  // On the consolidated daily runner we only want this to do work on Mondays.
  if (!force && now.getUTCDay() !== 1) {
    return { skipped: 'not_report_day', results: [] };
  }

  const end = now;
  const start = new Date(end.getTime() - 7 * 86_400_000);
  const weekStart = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );

  const results = await forEachActiveShop(
    prisma,
    async (shop) => {
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

      const snapshot = {
        creditIssued: metrics.creditIssued,
        creditRedeemed: metrics.creditRedeemed,
        ordersUsingCredit: metrics.ordersUsingCredit,
        revenueFromCreditOrders: metrics.revenueFromCreditOrders,
        outstandingCredit: metrics.outstandingCredit,
        redemptionRate: metrics.creditRedemptionRate,
      };

      await prisma.weeklyMetric.upsert({
        where: { shopId_weekStart_currencyCode: { shopId: shop.id, weekStart, currencyCode } },
        create: {
          shopId: shop.id,
          weekStart,
          currencyCode,
          topCampaignId: topCampaign?.id || null,
          ...snapshot,
        },
        update: snapshot,
      });

      if (!prefs?.weeklyReport || !prefs.merchantEmail) {
        return { emailed: false, reason: 'disabled_or_no_address' };
      }

      const message = weeklyReportEmail({
        shopDomain: shop.domain,
        metrics,
        appUrl: APP_URL,
        brandName: prefs.emailFromName || shop.name || null,
      });
      const sendResult = await sendEmail({
        shopId: shop.id,
        shop,
        fromName: prefs.emailFromName || null,
        to: prefs.merchantEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
        audience: 'MERCHANT',
        template: 'weekly-report',
        // One report per week, however many times this task runs.
        dedupeKey: `weekly-report:${weekStart.toISOString().slice(0, 10)}`,
      });

      if (sendResult.sent) {
        await prisma.weeklyMetric.updateMany({
          where: { shopId: shop.id, weekStart, currencyCode },
          data: { reportSentAt: new Date() },
        });
      }
      return { emailed: Boolean(sendResult.sent), skipped: sendResult.reason || null };
    },
    { limit: shopLimit }
  );

  return { weekStart: weekStart.toISOString().slice(0, 10), results };
}
