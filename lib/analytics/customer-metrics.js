import prisma from '@/lib/prisma/client';
import { round2 } from '@/lib/util/money';

/**
 * Customer rollups used by the rules engine and segments.
 *
 * We keep the minimum needed to make a credit decision: counts, spend, recency
 * and consent state. No addresses or phone numbers are ever written here.
 */
export async function upsertCustomerMetricFromPayload({ shop, customerPayload }) {
  const customerGid =
    customerPayload.admin_graphql_api_id ||
    (customerPayload.id ? `gid://shopify/Customer/${customerPayload.id}` : null);
  if (!customerGid) return null;

  const orderCount = Number(customerPayload.orders_count || 0);
  const lifetimeValue = round2(Number(customerPayload.total_spent || 0));
  const currencyCode = String(customerPayload.currency || shop.currencyCode || 'USD').toUpperCase();
  const displayName =
    [customerPayload.first_name, customerPayload.last_name].filter(Boolean).join(' ') || null;
  const marketingConsent =
    customerPayload.email_marketing_consent?.state === 'subscribed' ||
    customerPayload.accepts_marketing === true;

  const data = {
    displayName,
    orderCount,
    lifetimeValue,
    currencyCode,
    averageOrderValue: orderCount ? round2(lifetimeValue / orderCount) : 0,
    marketingConsent,
  };

  return prisma.customerMetric.upsert({
    where: { shopId_customerGid: { shopId: shop.id, customerGid } },
    create: { shopId: shop.id, customerGid, ...data },
    update: data,
  });
}

/** Keeps order recency current so "days since last purchase" stays meaningful. */
export async function updateCustomerMetricsFromOrder({ shop, orderPayload }) {
  const customerGid = orderPayload.customer?.admin_graphql_api_id;
  if (!customerGid) return null;

  const createdAt = orderPayload.created_at ? new Date(orderPayload.created_at) : new Date();
  const orderTotal = round2(Number(orderPayload.total_price || 0));
  const currencyCode = String(orderPayload.currency || shop.currencyCode || 'USD').toUpperCase();

  const existing = await prisma.customerMetric.findUnique({
    where: { shopId_customerGid: { shopId: shop.id, customerGid } },
  });

  if (!existing) {
    return prisma.customerMetric.create({
      data: {
        shopId: shop.id,
        customerGid,
        displayName:
          [orderPayload.customer?.first_name, orderPayload.customer?.last_name]
            .filter(Boolean)
            .join(' ') || null,
        orderCount: 1,
        lifetimeValue: orderTotal,
        currencyCode,
        averageOrderValue: orderTotal,
        firstOrderAt: createdAt,
        lastOrderAt: createdAt,
      },
    });
  }

  // Only count each order once — orders/updated fires repeatedly.
  const alreadyCounted = await prisma.orderAttribution.findUnique({
    where: {
      shopId_orderGid: { shopId: shop.id, orderGid: orderPayload.admin_graphql_api_id || '' },
    },
  });

  const orderCount = alreadyCounted ? existing.orderCount : existing.orderCount + 1;
  const lifetimeValue = alreadyCounted
    ? existing.lifetimeValue
    : round2(existing.lifetimeValue + orderTotal);

  return prisma.customerMetric.update({
    where: { id: existing.id },
    data: {
      orderCount,
      lifetimeValue,
      averageOrderValue: orderCount ? round2(lifetimeValue / orderCount) : 0,
      lastOrderAt: createdAt,
      firstOrderAt: existing.firstOrderAt || createdAt,
    },
  });
}
