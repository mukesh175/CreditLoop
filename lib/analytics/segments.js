import prisma from '@/lib/prisma/client';
import { round2 } from '@/lib/util/money';

/**
 * Customer segments, all derived from cached Shopify balances plus CreditLoop
 * behavioural metrics. Every query is paginated — the dashboard never loads a
 * whole customer list into memory.
 */
export const SEGMENTS = {
  CREDIT_HOLDERS: {
    id: 'CREDIT_HOLDERS',
    label: 'Credit Holders',
    description: 'Customers with a store credit balance above zero.',
  },
  HIGH_CREDIT: {
    id: 'HIGH_CREDIT',
    label: 'High Credit',
    description: 'Customers holding more than your high-balance threshold.',
  },
  UNUSED_CREDIT: {
    id: 'UNUSED_CREDIT',
    label: 'Unused Credit',
    description: 'Holders who have not redeemed any credit for X days.',
  },
  EXPIRING_CREDIT: {
    id: 'EXPIRING_CREDIT',
    label: 'Expiring Credit',
    description: 'Holders whose credit has an expiry date approaching.',
  },
  REPEAT_CREDIT_USERS: {
    id: 'REPEAT_CREDIT_USERS',
    label: 'Repeat Credit Users',
    description: 'Customers who have redeemed store credit more than once.',
  },
  HIGH_VALUE: {
    id: 'HIGH_VALUE',
    label: 'High Value Customers',
    description: 'Customers with high lifetime value.',
  },
};

/** Builds the Prisma `where` clause for a segment against CustomerCreditSnapshot. */
export function segmentSnapshotWhere(
  segment,
  { shopId, currencyCode, minBalance = 100, inactiveDays = 30, expiringInDays = 14 } = {}
) {
  const base = { shopId, ...(currencyCode ? { currencyCode } : {}) };
  const cutoff = new Date(Date.now() - inactiveDays * 86_400_000);

  switch (segment) {
    case 'HIGH_CREDIT':
      return { ...base, balance: { gte: minBalance } };
    case 'UNUSED_CREDIT':
      return {
        ...base,
        balance: { gt: 0 },
        OR: [{ lastDebitAt: null }, { lastDebitAt: { lt: cutoff } }],
        lastCreditAt: { lt: cutoff },
      };
    case 'EXPIRING_CREDIT':
      return {
        ...base,
        balance: { gt: 0 },
        expiresAt: { not: null, lte: new Date(Date.now() + expiringInDays * 86_400_000) },
      };
    case 'CREDIT_HOLDERS':
    default:
      return { ...base, balance: { gt: 0 } };
  }
}

/** Segments that are answered from CustomerMetric instead of balances. */
export function segmentMetricWhere(segment, { shopId, minLifetimeValue = 500 } = {}) {
  switch (segment) {
    case 'REPEAT_CREDIT_USERS':
      return { shopId, creditUseCount: { gte: 2 } };
    case 'HIGH_VALUE':
      return { shopId, lifetimeValue: { gte: minLifetimeValue } };
    default:
      return null;
  }
}

/**
 * Resolves a segment to a page of customers. Returns Shopify GIDs plus cached
 * analytics — never a bulk dump of personal data.
 */
export async function resolveSegment({
  shopId,
  segment,
  currencyCode,
  options = {},
  take = 50,
  skip = 0,
}) {
  const metricWhere = segmentMetricWhere(segment, { shopId, ...options });

  if (metricWhere) {
    const [rows, total] = await Promise.all([
      prisma.customerMetric.findMany({
        where: metricWhere,
        orderBy: { lifetimeValue: 'desc' },
        take,
        skip,
      }),
      prisma.customerMetric.count({ where: metricWhere }),
    ]);
    const snapshots = await prisma.customerCreditSnapshot.findMany({
      where: { shopId, customerGid: { in: rows.map((r) => r.customerGid) } },
    });
    const balanceByCustomer = new Map(snapshots.map((s) => [s.customerGid, s]));
    return {
      total,
      customers: rows.map((r) => ({
        customerGid: r.customerGid,
        displayName: r.displayName,
        orderCount: r.orderCount,
        lifetimeValue: r.lifetimeValue,
        creditUseCount: r.creditUseCount,
        balance: balanceByCustomer.get(r.customerGid)?.balance ?? 0,
        currencyCode: balanceByCustomer.get(r.customerGid)?.currencyCode ?? r.currencyCode,
        syncedAt: balanceByCustomer.get(r.customerGid)?.syncedAt ?? null,
        lastOrderAt: r.lastOrderAt,
      })),
    };
  }

  const where = segmentSnapshotWhere(segment, { shopId, currencyCode, ...options });
  const [snapshots, total] = await Promise.all([
    prisma.customerCreditSnapshot.findMany({
      where,
      orderBy: { balance: 'desc' },
      take,
      skip,
    }),
    prisma.customerCreditSnapshot.count({ where }),
  ]);

  const metrics = await prisma.customerMetric.findMany({
    where: { shopId, customerGid: { in: snapshots.map((s) => s.customerGid) } },
  });
  const metricByCustomer = new Map(metrics.map((m) => [m.customerGid, m]));

  return {
    total,
    customers: snapshots.map((s) => {
      const m = metricByCustomer.get(s.customerGid);
      const anchor = s.lastDebitAt || s.lastCreditAt || s.syncedAt;
      const creditAgeDays = Math.floor((Date.now() - new Date(anchor).getTime()) / 86_400_000);
      return {
        customerGid: s.customerGid,
        displayName: m?.displayName || null,
        balance: round2(s.balance),
        currencyCode: s.currencyCode,
        syncedAt: s.syncedAt,
        expiresAt: s.expiresAt,
        creditAgeDays,
        status: creditAgeDays >= 90 ? 'LONG_UNUSED' : creditAgeDays >= 30 ? 'UNUSED' : 'ACTIVE',
        orderCount: m?.orderCount ?? 0,
        lifetimeValue: m?.lifetimeValue ?? 0,
        lastOrderAt: m?.lastOrderAt ?? null,
        creditUseCount: m?.creditUseCount ?? 0,
        marketingConsent: m?.marketingConsent ?? false,
      };
    }),
  };
}
