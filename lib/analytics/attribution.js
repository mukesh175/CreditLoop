import prisma from '@/lib/prisma/client';
import { round2 } from '@/lib/util/money';
import { extractStoreCreditUsed } from './store-credit-usage';

/**
 * Order attribution.
 *
 * Careful with wording throughout: we record *revenue from orders that used
 * store credit*. We never claim CreditLoop caused that revenue.
 */

/**
 * Detects store-credit usage on an order payload (REST-shaped webhook body) and
 * records the attribution. Idempotent on (shopId, orderGid).
 */
export async function recordOrderAttribution({ shop, orderPayload }) {
  const orderGid = orderPayload.admin_graphql_api_id;
  if (!orderGid) return null;

  const currencyCode = String(orderPayload.currency || shop.currencyCode || 'USD').toUpperCase();
  const orderTotal = round2(Number(orderPayload.total_price || 0));
  const customerGid = orderPayload.customer?.admin_graphql_api_id || null;

  const creditAmountUsed = extractStoreCreditUsed(orderPayload, currencyCode);

  // Orders without store credit are still recorded — they are the comparison
  // group for repeat-purchase analytics.
  const previous = customerGid
    ? await prisma.orderAttribution.findFirst({
        where: { shopId: shop.id, customerGid, orderGid: { not: orderGid } },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  const createdAt = orderPayload.created_at ? new Date(orderPayload.created_at) : new Date();
  const daysSincePrevious = previous
    ? Math.max(0, Math.floor((createdAt - new Date(previous.createdAt)) / 86_400_000))
    : null;

  const attribution = await prisma.orderAttribution.upsert({
    where: { shopId_orderGid: { shopId: shop.id, orderGid } },
    create: {
      shopId: shop.id,
      orderGid,
      orderName: orderPayload.name || null,
      customerGid,
      creditAmountUsed,
      orderTotal,
      currencyCode,
      isRepeatPurchase: Boolean(previous),
      daysSincePreviousOrder: daysSincePrevious,
      createdAt,
    },
    update: {
      creditAmountUsed,
      orderTotal,
      orderName: orderPayload.name || null,
      isRepeatPurchase: Boolean(previous),
      daysSincePreviousOrder: daysSincePrevious,
    },
  });

  if (creditAmountUsed > 0 && customerGid) {
    await recordCreditRedemption({ shop, attribution, customerGid, creditAmountUsed, currencyCode });
  }

  return attribution;
}

/**
 * Links redeemed credit back to the credit events that funded it, oldest first
 * (store credit is consumed FIFO), so we can report how much of a specific
 * issuance turned into orders.
 */
export async function recordCreditRedemption({
  shop,
  attribution,
  customerGid,
  creditAmountUsed,
  currencyCode,
}) {
  const issuedEvents = await prisma.creditEvent.findMany({
    where: {
      shopId: shop.id,
      customerGid,
      eventType: 'CREDIT',
      currencyCode,
      createdAt: { lte: attribution.createdAt },
    },
    orderBy: { createdAt: 'asc' },
  });

  const alreadyAttributed = await prisma.creditAttribution.groupBy({
    by: ['creditEventId'],
    where: { shopId: shop.id, creditEventId: { in: issuedEvents.map((e) => e.id) } },
    _sum: { amountAttributed: true },
  });
  const attributedMap = new Map(
    alreadyAttributed.map((row) => [row.creditEventId, Number(row._sum.amountAttributed || 0)])
  );

  let remaining = round2(creditAmountUsed);
  for (const event of issuedEvents) {
    if (remaining <= 0) break;
    const consumed = attributedMap.get(event.id) || 0;
    const available = round2(event.amount - consumed);
    if (available <= 0) continue;

    const amount = round2(Math.min(available, remaining));
    remaining = round2(remaining - amount);

    const daysToRedemption = Math.max(
      0,
      Math.floor((new Date(attribution.createdAt) - new Date(event.createdAt)) / 86_400_000)
    );

    await prisma.creditAttribution.upsert({
      where: {
        creditEventId_orderAttributionId: {
          creditEventId: event.id,
          orderAttributionId: attribution.id,
        },
      },
      create: {
        shopId: shop.id,
        creditEventId: event.id,
        orderAttributionId: attribution.id,
        amountAttributed: amount,
        currencyCode,
        daysToRedemption,
      },
      update: { amountAttributed: amount },
    });
  }

  // Keep the customer's rollup metrics current for segmentation.
  await prisma.customerMetric.upsert({
    where: { shopId_customerGid: { shopId: shop.id, customerGid } },
    create: {
      shopId: shop.id,
      customerGid,
      currencyCode,
      creditRedeemedTotal: round2(creditAmountUsed),
      creditUseCount: 1,
    },
    update: {
      creditRedeemedTotal: { increment: round2(creditAmountUsed) },
      creditUseCount: { increment: 1 },
    },
  });
}

export { extractStoreCreditUsed };
