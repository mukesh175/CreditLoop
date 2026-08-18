import prisma from '@/lib/prisma/client';
import { round2 } from '@/lib/util/money';

/**
 * Deterministic demo dataset.
 *
 * Every generated row carries `metadata.demo = true` (or a `demo:` GID prefix)
 * so demo data is identifiable at a glance and removable in one call. It is
 * never written against real Shopify customer ids.
 */
const DEMO_PREFIX = 'gid://creditloop-demo/Customer/';
const DEMO_ORDER_PREFIX = 'gid://creditloop-demo/Order/';

const FIRST_NAMES = ['John', 'Sarah', 'Mike', 'Priya', 'Tom', 'Ana', 'Liam', 'Chloe', 'Noah', 'Maya'];
const LAST_NAMES = ['Smith', 'Chen', 'Patel', 'Garcia', 'Brown', 'Okafor', 'Novak', 'Kim'];

/** Small seeded PRNG so repeated runs produce the same believable dataset. */
function makeRandom(seed = 42) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export async function generateDemoData({
  shopId,
  currencyCode = 'USD',
  customerCount = 250,
  orderCount = 500,
  returnCount = 40,
  creditTransactionCount = 120,
}) {
  const random = makeRandom(1337);
  const now = Date.now();
  const pick = (list) => list[Math.floor(random() * list.length)];

  await clearDemoData({ shopId });

  // --- Customers ---------------------------------------------------------
  const customers = [];
  for (let i = 0; i < customerCount; i += 1) {
    const orders = 1 + Math.floor(random() * 9);
    const aov = 40 + random() * 180;
    const lifetimeValue = round2(orders * aov);
    const lastOrderDaysAgo = Math.floor(random() * 180);
    customers.push({
      shopId,
      customerGid: `${DEMO_PREFIX}${1000 + i}`,
      displayName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      orderCount: orders,
      lifetimeValue,
      currencyCode,
      averageOrderValue: round2(aov),
      lastOrderAt: new Date(now - lastOrderDaysAgo * 86_400_000),
      firstOrderAt: new Date(now - (lastOrderDaysAgo + orders * 30) * 86_400_000),
      marketingConsent: random() > 0.35,
    });
  }
  await prisma.customerMetric.createMany({ data: customers, skipDuplicates: true });

  // --- Credit events (issued) -------------------------------------------
  const creditEvents = [];
  const creditHolders = customers.slice(0, creditTransactionCount);
  for (let i = 0; i < creditTransactionCount; i += 1) {
    const customer = creditHolders[i];
    const daysAgo = Math.floor(random() * 120);
    const refundAmount = round2(30 + random() * 220);
    const bonus = round2(refundAmount * 0.1);
    creditEvents.push({
      shopId,
      customerGid: customer.customerGid,
      shopifyStoreCreditAccountId: `gid://creditloop-demo/StoreCreditAccount/${2000 + i}`,
      shopifyTransactionId: `gid://creditloop-demo/StoreCreditTransaction/${3000 + i}`,
      eventType: 'CREDIT',
      amount: round2(refundAmount + bonus),
      currencyCode,
      source: random() > 0.25 ? 'RETURN_REFUND' : 'CAMPAIGN',
      bonusAmount: bonus,
      createdAt: new Date(now - daysAgo * 86_400_000),
      metadata: { demo: true },
    });
  }
  await prisma.creditEvent.createMany({ data: creditEvents, skipDuplicates: true });
  const storedEvents = await prisma.creditEvent.findMany({
    where: { shopId, shopifyTransactionId: { startsWith: 'gid://creditloop-demo/' } },
  });

  // --- Orders + attribution ---------------------------------------------
  const orders = [];
  for (let i = 0; i < orderCount; i += 1) {
    const customer = customers[Math.floor(random() * customers.length)];
    const daysAgo = Math.floor(random() * 90);
    const total = round2(60 + random() * 260);
    // ~30% of demo orders use store credit, giving a realistic redemption mix.
    const usesCredit = random() < 0.3;
    orders.push({
      shopId,
      orderGid: `${DEMO_ORDER_PREFIX}${10000 + i}`,
      orderName: `#${10400 + i}`,
      customerGid: customer.customerGid,
      creditAmountUsed: usesCredit ? round2(Math.min(total * 0.6, 20 + random() * 90)) : 0,
      orderTotal: total,
      currencyCode,
      isRepeatPurchase: random() < 0.34,
      daysSincePreviousOrder: Math.floor(random() * 60),
      createdAt: new Date(now - daysAgo * 86_400_000),
    });
  }
  await prisma.orderAttribution.createMany({ data: orders, skipDuplicates: true });

  // --- Credit attributions (redemption linkage) --------------------------
  const storedOrders = await prisma.orderAttribution.findMany({
    where: { shopId, orderGid: { startsWith: DEMO_ORDER_PREFIX }, creditAmountUsed: { gt: 0 } },
  });
  const attributions = [];
  for (const order of storedOrders) {
    const event = storedEvents.find(
      (e) => e.customerGid === order.customerGid && e.createdAt <= order.createdAt
    );
    if (!event) continue;
    attributions.push({
      shopId,
      creditEventId: event.id,
      orderAttributionId: order.id,
      amountAttributed: round2(Math.min(event.amount, order.creditAmountUsed)),
      currencyCode,
      daysToRedemption: Math.max(
        0,
        Math.floor((order.createdAt - event.createdAt) / 86_400_000)
      ),
      createdAt: order.createdAt,
    });
  }
  if (attributions.length) {
    await prisma.creditAttribution.createMany({ data: attributions, skipDuplicates: true });
  }

  // --- Balance snapshots (stand in for Shopify balances in demo) ---------
  const snapshots = creditHolders.map((customer, i) => {
    const issued = creditEvents[i].amount;
    const redeemed = random() < 0.55 ? round2(issued * random()) : 0;
    const ageDays = Math.floor(random() * 120);
    return {
      shopId,
      customerGid: customer.customerGid,
      shopifyStoreCreditAccountId: `gid://creditloop-demo/StoreCreditAccount/${2000 + i}`,
      balance: round2(Math.max(0, issued - redeemed)),
      currencyCode,
      lastCreditAt: new Date(now - ageDays * 86_400_000),
      lastDebitAt: redeemed ? new Date(now - Math.floor(ageDays / 2) * 86_400_000) : null,
      syncedAt: new Date(),
    };
  });
  await prisma.customerCreditSnapshot.createMany({ data: snapshots, skipDuplicates: true });

  // --- Returns -----------------------------------------------------------
  const returns = [];
  for (let i = 0; i < returnCount; i += 1) {
    const customer = customers[Math.floor(random() * customers.length)];
    const refundAmount = round2(25 + random() * 200);
    const accepted = random() < 0.55;
    returns.push({
      shopId,
      orderGid: `${DEMO_ORDER_PREFIX}${20000 + i}`,
      orderName: `#${10482 + i}`,
      customerGid: customer.customerGid,
      refundAmount,
      currencyCode,
      refundMethod: accepted ? 'STORE_CREDIT' : 'PENDING',
      creditOffered: round2(refundAmount * 1.1),
      creditAccepted: accepted,
      bonusAmount: accepted ? round2(refundAmount * 0.1) : null,
      status: accepted ? 'CREDIT_ISSUED' : 'OPEN',
      createdAt: new Date(now - Math.floor(random() * 45) * 86_400_000),
    });
  }
  await prisma.returnEvent.createMany({ data: returns, skipDuplicates: true });

  return {
    customers: customers.length,
    orders: orders.length,
    returns: returns.length,
    creditEvents: creditEvents.length,
    attributions: attributions.length,
  };
}

/** Removes every demo row for a shop. Real Shopify-sourced data is untouched. */
export async function clearDemoData({ shopId }) {
  const demoOrders = await prisma.orderAttribution.findMany({
    where: { shopId, orderGid: { startsWith: DEMO_ORDER_PREFIX } },
    select: { id: true },
  });

  const [attributions, events, snapshots, returns, orders, customers] = await prisma.$transaction([
    prisma.creditAttribution.deleteMany({
      where: { shopId, orderAttributionId: { in: demoOrders.map((o) => o.id) } },
    }),
    prisma.creditEvent.deleteMany({
      where: { shopId, customerGid: { startsWith: DEMO_PREFIX } },
    }),
    prisma.customerCreditSnapshot.deleteMany({
      where: { shopId, customerGid: { startsWith: DEMO_PREFIX } },
    }),
    prisma.returnEvent.deleteMany({
      where: { shopId, orderGid: { startsWith: DEMO_ORDER_PREFIX } },
    }),
    prisma.orderAttribution.deleteMany({
      where: { shopId, orderGid: { startsWith: DEMO_ORDER_PREFIX } },
    }),
    prisma.customerMetric.deleteMany({
      where: { shopId, customerGid: { startsWith: DEMO_PREFIX } },
    }),
  ]);

  return {
    attributions: attributions.count,
    creditEvents: events.count,
    snapshots: snapshots.count,
    returns: returns.count,
    orders: orders.count,
    customers: customers.count,
  };
}
