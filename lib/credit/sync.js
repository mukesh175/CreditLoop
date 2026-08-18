import prisma from '@/lib/prisma/client';
import { adminGraphql, paginate } from '@/lib/shopify/graphql';
import { CUSTOMERS_QUERY, SHOP_INFO_QUERY } from '@/lib/shopify/queries';
import { getCustomerStoreCredit, upsertBalanceSnapshot } from './store-credit';
import { round2 } from '@/lib/util/money';

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
