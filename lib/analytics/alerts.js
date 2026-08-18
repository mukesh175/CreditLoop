import prisma from '@/lib/prisma/client';
import { getOutstandingCredit, getUnusedCreditBuckets, creditTotals } from './metrics';
import { round2 } from '@/lib/util/money';

/**
 * Dashboard alerts. Each one is actionable — it links somewhere the merchant can
 * actually do something about it.
 */
export async function getDashboardAlerts({ shopId, currencyCode }) {
  const now = new Date();
  const monthStart = new Date(now.getTime() - 30 * 86_400_000);
  const prevMonthStart = new Date(now.getTime() - 60 * 86_400_000);

  const [outstanding, unused, thisMonth, lastMonth, expiring, openReturns] = await Promise.all([
    getOutstandingCredit({ shopId, currencyCode }),
    getUnusedCreditBuckets({ shopId, currencyCode }),
    creditTotals({ shopId, currencyCode, start: monthStart, end: now }),
    creditTotals({ shopId, currencyCode, start: prevMonthStart, end: monthStart }),
    prisma.customerCreditSnapshot.aggregate({
      where: {
        shopId,
        currencyCode,
        balance: { gt: 0 },
        expiresAt: { not: null, lte: new Date(now.getTime() + 14 * 86_400_000) },
      },
      _sum: { balance: true },
      _count: true,
    }),
    prisma.returnEvent.count({
      where: {
        shopId,
        status: 'OPEN',
        createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
      },
    }),
  ]);

  const alerts = [];

  if (outstanding.total > 0) {
    alerts.push({
      id: 'outstanding-credit',
      tone: 'info',
      title: 'Outstanding credit',
      amount: outstanding.total,
      currencyCode,
      message: `is currently outstanding across ${outstanding.holders} customer${
        outstanding.holders === 1 ? '' : 's'
      }.`,
      href: '/credit',
    });
  }

  if (unused.days30 > 0) {
    alerts.push({
      id: 'unused-credit',
      tone: 'warning',
      title: 'Unused credit',
      amount: round2(unused.days30 + unused.days60 + unused.days90),
      currencyCode,
      message: 'has remained unused for more than 30 days.',
      href: '/credit/unused',
    });
  }

  if (lastMonth.redeemed > 0) {
    const change = round2(((thisMonth.redeemed - lastMonth.redeemed) / lastMonth.redeemed) * 100);
    if (Math.abs(change) >= 10) {
      alerts.push({
        id: 'redemption-change',
        tone: change > 0 ? 'success' : 'warning',
        title: 'Credit redemption',
        message: `${change > 0 ? 'increased' : 'decreased'} ${Math.abs(change)}% over the last 30 days.`,
        href: '/analytics',
      });
    }
  }

  if ((expiring._sum.balance || 0) > 0) {
    alerts.push({
      id: 'expiring-credit',
      tone: 'warning',
      title: 'Credit expiring',
      amount: round2(expiring._sum.balance),
      currencyCode,
      message: 'in store credit expires within 14 days.',
      href: '/credit/unused?filter=expiring',
    });
  }

  if (openReturns > 0) {
    alerts.push({
      id: 'return-opportunity',
      tone: 'success',
      title: 'Return opportunity',
      message: `${openReturns} recent return${
        openReturns === 1 ? '' : 's'
      } may be eligible for your store-credit offer.`,
      href: '/returns',
    });
  }

  return alerts;
}
