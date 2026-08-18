import prisma from '@/lib/prisma/client';
import { round2 } from '@/lib/util/money';

/**
 * Analytics aggregation.
 *
 * Every figure here is scoped to a single currency. Cross-currency stores get
 * per-currency breakdowns rather than one meaningless combined number.
 */

export function rangeToDates(range, { from, to } = {}) {
  const end = to ? new Date(to) : new Date();
  if (range === 'custom' && from) return { start: new Date(from), end };
  const days = { '7d': 7, '30d': 30, '90d': 90 }[range] || 30;
  const start = new Date(end.getTime() - days * 86_400_000);
  return { start, end, days };
}

/** Headline KPIs, plus period-over-period change on the same window length. */
export async function getOverviewMetrics({ shopId, currencyCode, range = '30d', from, to }) {
  const { start, end } = rangeToDates(range, { from, to });
  const windowMs = end - start;
  const prevStart = new Date(start.getTime() - windowMs);

  const [current, previous, outstanding, creditOrders, prevCreditOrders] = await Promise.all([
    creditTotals({ shopId, currencyCode, start, end }),
    creditTotals({ shopId, currencyCode, start: prevStart, end: start }),
    getOutstandingCredit({ shopId, currencyCode }),
    orderTotals({ shopId, currencyCode, start, end }),
    orderTotals({ shopId, currencyCode, start: prevStart, end: start }),
  ]);

  const redemptionRate = current.issued > 0 ? (current.redeemed / current.issued) * 100 : 0;
  const repeat = await getRepeatPurchaseStats({ shopId, currencyCode, start, end });

  return {
    currencyCode,
    range,
    periodStart: start,
    periodEnd: end,
    creditIssued: current.issued,
    creditIssuedChange: percentChange(current.issued, previous.issued),
    creditRedeemed: current.redeemed,
    creditRedeemedChange: percentChange(current.redeemed, previous.redeemed),
    bonusIssued: current.bonus,
    outstandingCredit: outstanding.total,
    outstandingSyncedAt: outstanding.syncedAt,
    ordersUsingCredit: creditOrders.count,
    ordersUsingCreditChange: percentChange(creditOrders.count, prevCreditOrders.count),
    revenueFromCreditOrders: creditOrders.revenue,
    revenueChange: percentChange(creditOrders.revenue, prevCreditOrders.revenue),
    averageOrderValue: creditOrders.count ? round2(creditOrders.revenue / creditOrders.count) : 0,
    creditRedemptionRate: round2(redemptionRate),
    repeatPurchaseRate: repeat.repeatPurchaseRate,
  };
}

function percentChange(current, previous) {
  if (!previous) return current ? null : 0; // null = no comparable prior period
  return round2(((current - previous) / previous) * 100);
}

export async function creditTotals({ shopId, currencyCode, start, end }) {
  const [credits, debits, bonus] = await Promise.all([
    prisma.creditEvent.aggregate({
      where: {
        shopId,
        currencyCode,
        eventType: 'CREDIT',
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.creditAttribution.aggregate({
      where: { shopId, currencyCode, createdAt: { gte: start, lt: end } },
      _sum: { amountAttributed: true },
    }),
    prisma.creditEvent.aggregate({
      where: {
        shopId,
        currencyCode,
        eventType: 'CREDIT',
        createdAt: { gte: start, lt: end },
      },
      _sum: { bonusAmount: true },
    }),
  ]);

  return {
    issued: round2(credits._sum.amount || 0),
    issuedCount: credits._count || 0,
    redeemed: round2(debits._sum.amountAttributed || 0),
    bonus: round2(bonus._sum.bonusAmount || 0),
  };
}

export async function orderTotals({ shopId, currencyCode, start, end }) {
  const result = await prisma.orderAttribution.aggregate({
    where: {
      shopId,
      currencyCode,
      creditAmountUsed: { gt: 0 },
      createdAt: { gte: start, lt: end },
    },
    _sum: { orderTotal: true, creditAmountUsed: true },
    _count: true,
  });
  return {
    count: result._count || 0,
    revenue: round2(result._sum.orderTotal || 0),
    creditUsed: round2(result._sum.creditAmountUsed || 0),
  };
}

/**
 * Outstanding credit comes from cached Shopify balances, not from summing our
 * own ledger. The snapshot timestamp is returned so the UI can show how fresh
 * the figure is.
 */
export async function getOutstandingCredit({ shopId, currencyCode }) {
  const [agg, latest] = await Promise.all([
    prisma.customerCreditSnapshot.aggregate({
      where: { shopId, currencyCode, balance: { gt: 0 } },
      _sum: { balance: true },
      _count: true,
    }),
    prisma.customerCreditSnapshot.findFirst({
      where: { shopId, currencyCode },
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    }),
  ]);
  return {
    total: round2(agg._sum.balance || 0),
    holders: agg._count || 0,
    syncedAt: latest?.syncedAt || null,
  };
}

/** Ageing buckets for unused credit, driven by the last credit movement. */
export async function getUnusedCreditBuckets({ shopId, currencyCode }) {
  const snapshots = await prisma.customerCreditSnapshot.findMany({
    where: { shopId, currencyCode, balance: { gt: 0 } },
    select: { balance: true, lastCreditAt: true, lastDebitAt: true, syncedAt: true },
  });

  const now = Date.now();
  const buckets = { total: 0, days30: 0, days60: 0, days90: 0 };
  for (const snap of snapshots) {
    const anchor = snap.lastDebitAt || snap.lastCreditAt || snap.syncedAt;
    const age = Math.floor((now - new Date(anchor).getTime()) / 86_400_000);
    buckets.total = round2(buckets.total + snap.balance);
    if (age >= 90) buckets.days90 = round2(buckets.days90 + snap.balance);
    else if (age >= 60) buckets.days60 = round2(buckets.days60 + snap.balance);
    else if (age >= 30) buckets.days30 = round2(buckets.days30 + snap.balance);
  }
  return buckets;
}

/**
 * Repeat-purchase behaviour among customers who used store credit.
 *
 * This is an observed comparison, not a causal claim — the UI labels it as such.
 */
export async function getRepeatPurchaseStats({ shopId, currencyCode, start, end }) {
  const creditOrders = await prisma.orderAttribution.findMany({
    where: {
      shopId,
      currencyCode,
      creditAmountUsed: { gt: 0 },
      createdAt: { gte: start, lt: end },
      customerGid: { not: null },
    },
    select: { customerGid: true, orderTotal: true, isRepeatPurchase: true, daysSincePreviousOrder: true },
  });

  const customers = new Set(creditOrders.map((o) => o.customerGid));
  const repeatCustomers = new Set(
    creditOrders.filter((o) => o.isRepeatPurchase).map((o) => o.customerGid)
  );
  const dayValues = creditOrders
    .map((o) => o.daysSincePreviousOrder)
    .filter((d) => d != null);

  const revenue = creditOrders.reduce((s, o) => s + Number(o.orderTotal), 0);

  // Comparison group: orders in the same window without store credit.
  const nonCredit = await prisma.orderAttribution.aggregate({
    where: {
      shopId,
      currencyCode,
      creditAmountUsed: { lte: 0 },
      createdAt: { gte: start, lt: end },
    },
    _sum: { orderTotal: true },
    _count: true,
  });
  const nonCreditRepeat = await prisma.orderAttribution.count({
    where: {
      shopId,
      currencyCode,
      creditAmountUsed: { lte: 0 },
      isRepeatPurchase: true,
      createdAt: { gte: start, lt: end },
    },
  });

  return {
    creditCustomers: customers.size,
    returnedToPurchase: repeatCustomers.size,
    repeatPurchaseRate: customers.size
      ? round2((repeatCustomers.size / customers.size) * 100)
      : 0,
    averageDaysToNextPurchase: dayValues.length
      ? Math.round(dayValues.reduce((a, b) => a + b, 0) / dayValues.length)
      : null,
    averageOrderValue: creditOrders.length ? round2(revenue / creditOrders.length) : 0,
    comparison: {
      nonCreditOrders: nonCredit._count || 0,
      nonCreditRepeatRate: nonCredit._count
        ? round2((nonCreditRepeat / nonCredit._count) * 100)
        : 0,
      nonCreditAverageOrderValue: nonCredit._count
        ? round2(Number(nonCredit._sum.orderTotal || 0) / nonCredit._count)
        : 0,
    },
  };
}

/** Time series for the dashboard chart: issued / redeemed / revenue by day. */
export async function getCreditTimeSeries({ shopId, currencyCode, range = '30d', from, to }) {
  const { start, end } = rangeToDates(range, { from, to });

  const [events, attributions, orders] = await Promise.all([
    prisma.creditEvent.findMany({
      where: { shopId, currencyCode, eventType: 'CREDIT', createdAt: { gte: start, lt: end } },
      select: { amount: true, createdAt: true },
    }),
    prisma.creditAttribution.findMany({
      where: { shopId, currencyCode, createdAt: { gte: start, lt: end } },
      select: { amountAttributed: true, createdAt: true },
    }),
    prisma.orderAttribution.findMany({
      where: {
        shopId,
        currencyCode,
        creditAmountUsed: { gt: 0 },
        createdAt: { gte: start, lt: end },
      },
      select: { orderTotal: true, createdAt: true },
    }),
  ]);

  const buckets = new Map();
  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const ensure = (key) => {
    if (!buckets.has(key)) buckets.set(key, { date: key, issued: 0, redeemed: 0, revenue: 0 });
    return buckets.get(key);
  };

  for (
    let cursor = new Date(start);
    cursor < end;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    ensure(dayKey(cursor));
  }
  for (const e of events) ensure(dayKey(e.createdAt)).issued += Number(e.amount);
  for (const a of attributions) ensure(dayKey(a.createdAt)).redeemed += Number(a.amountAttributed);
  for (const o of orders) ensure(dayKey(o.createdAt)).revenue += Number(o.orderTotal);

  return [...buckets.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((b) => ({
      date: b.date,
      issued: round2(b.issued),
      redeemed: round2(b.redeemed),
      revenue: round2(b.revenue),
    }));
}
