import prisma from '@/lib/prisma/client';
import { adminGraphql, paginate } from '@/lib/shopify/graphql';
import { CUSTOMERS_QUERY, ORDERS_LIST_QUERY, SHOP_INFO_QUERY } from '@/lib/shopify/queries';
import { recordOrderAttribution } from '@/lib/analytics/attribution';
import { getCustomerStoreCredit, upsertBalanceSnapshot } from './store-credit';
import { round2 } from '@/lib/util/money';
import { isDemoGid } from '@/lib/demo/identifiers';

/**
 * Pulls shop identity and currency from Shopify. The shop's currency drives
 * every default in the app, so we never guess it.
 */
export async function syncShopInfo({ shop, session }) {
  const { data } = await adminGraphql(session, SHOP_INFO_QUERY, {});
  const info = data?.shop;
  if (!info) return shop;
  return prisma.shop.update({
    where: { id: shop.id },
    data: {
      shopifyShopGid: info.id,
      name: info.name,
      email: info.email,
      currencyCode: info.currencyCode || shop.currencyCode,
    },
  });
}

/**
 * Refreshes CustomerMetric rows from Shopify.
 *
 * We store order counts, spend and consent state — the inputs the rules engine
 * and segments need — plus a display name for the merchant UI. No addresses, no
 * phone numbers, no emails (see README → data minimization).
 */
export async function syncCustomers({ shop, session, maxPages = 5, updatedSince = null }) {
  const query = updatedSince
    ? `updated_at:>='${new Date(updatedSince).toISOString()}'`
    : null;

  const customers = await paginate(
    session,
    CUSTOMERS_QUERY,
    { first: 100, query },
    (data) => data?.customers,
    { maxPages }
  );

  let synced = 0;
  for (const customer of customers) {
    const lifetimeValue = Number(customer.amountSpent?.amount || 0);
    const orderCount = Number(customer.numberOfOrders || 0);
    await prisma.customerMetric.upsert({
      where: { shopId_customerGid: { shopId: shop.id, customerGid: customer.id } },
      create: {
        shopId: shop.id,
        customerGid: customer.id,
        displayName: customer.displayName || null,
        orderCount,
        lifetimeValue,
        currencyCode: customer.amountSpent?.currencyCode || shop.currencyCode,
        averageOrderValue: orderCount ? round2(lifetimeValue / orderCount) : 0,
        lastOrderAt: customer.lastOrder?.createdAt ? new Date(customer.lastOrder.createdAt) : null,
        marketingConsent: customer.emailMarketingConsent?.marketingState === 'SUBSCRIBED',
      },
      update: {
        displayName: customer.displayName || null,
        orderCount,
        lifetimeValue,
        averageOrderValue: orderCount ? round2(lifetimeValue / orderCount) : 0,
        lastOrderAt: customer.lastOrder?.createdAt ? new Date(customer.lastOrder.createdAt) : null,
        marketingConsent: customer.emailMarketingConsent?.marketingState === 'SUBSCRIBED',
      },
    });
    synced += 1;
  }

  return { synced };
}

/**
 * Backfills orders from Shopify.
 *
 * Webhooks only cover orders placed *after* install, so without this the Orders
 * page and every attribution figure stay empty on a store with existing
 * history. Runs on install and on each scheduled sync; the upsert on
 * (shopId, orderGid) makes re-runs harmless.
 */
export async function syncOrders({ shop, session, maxPages = 3, createdSince = null }) {
  const query = createdSince
    ? `created_at:>='${new Date(createdSince).toISOString()}'`
    : null;

  const orders = await paginate(
    session,
    ORDERS_LIST_QUERY,
    { first: 50, query },
    (data) => data?.orders,
    { maxPages }
  );

  let synced = 0;
  let withCredit = 0;

  for (const node of orders) {
    try {
      const attribution = await recordOrderAttribution({
        shop,
        orderPayload: toWebhookShape(node, shop),
      });
      synced += 1;
      if (attribution?.creditAmountUsed > 0) withCredit += 1;
    } catch (error) {
      // One malformed order must not abort the backfill.
      // eslint-disable-next-line no-console
      console.error('[creditloop] order backfill failed', node?.id, error?.message);
    }
  }

  return { synced, withCredit };
}

/**
 * Adapts a GraphQL order node to the REST-shaped payload the attribution code
 * takes, so webhook and backfill paths share one implementation of "how much
 * store credit did this order use".
 */
function toWebhookShape(node, shop) {
  const currencyCode =
    node.currencyCode || node.totalPriceSet?.shopMoney?.currencyCode || shop.currencyCode;

  return {
    admin_graphql_api_id: node.id,
    name: node.name,
    created_at: node.createdAt,
    currency: currencyCode,
    total_price: node.totalPriceSet?.shopMoney?.amount || '0',
    customer: node.customer
      ? {
          admin_graphql_api_id: node.customer.id,
          orders_count: node.customer.numberOfOrders,
        }
      : null,
    payment_gateway_names: (node.transactions || []).map((t) => t.gateway).filter(Boolean),
    transactions: (node.transactions || []).map((t) => ({
      gateway: t.gateway,
      // The webhook payload uses lowercase; GraphQL enums are uppercase.
      kind: String(t.kind || '').toLowerCase(),
      status: String(t.status || '').toLowerCase(),
      amount: t.amountSet?.shopMoney?.amount || '0',
      currency: t.amountSet?.shopMoney?.currencyCode || currencyCode,
    })),
  };
}

/**
 * Refreshes the cached balance for customers CreditLoop has touched.
 *
 * Shopify remains authoritative — this only updates the snapshot the dashboard
 * reads so we don't issue one Admin API call per row on every page load.
 */
export async function syncCreditBalances({ shop, session, limit = 100 }) {
  const candidates = await prisma.creditEvent.findMany({
    where: { shopId: shop.id },
    distinct: ['customerGid'],
    select: { customerGid: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  let updated = 0;
  const errors = [];

  for (const { customerGid } of candidates) {
    // Generated customers have no Shopify account to read.
    if (isDemoGid(customerGid)) continue;

    try {
      const profile = await getCustomerStoreCredit(session, customerGid, { transactions: 5 });
      if (!profile) continue;

      for (const account of profile.accounts) {
        const lastCredit = account.transactions.find((t) => t.type === 'CREDIT');
        const lastDebit = account.transactions.find((t) => t.type === 'DEBIT');
        await upsertBalanceSnapshot({
          shopId: shop.id,
          customerGid,
          accountId: account.id,
          balance: account.balance,
          currencyCode: account.currencyCode,
          lastCreditAt: lastCredit ? new Date(lastCredit.createdAt) : null,
          lastDebitAt: lastDebit ? new Date(lastDebit.createdAt) : null,
          expiresAt: lastCredit?.expiresAt ? new Date(lastCredit.expiresAt) : null,
        });
        updated += 1;
      }
    } catch (error) {
      errors.push({ customerGid, error: String(error?.message || error) });
    }
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: errors.length ? 'PARTIAL' : 'OK',
    },
  });

  return { updated, errors };
}
