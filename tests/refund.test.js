import test from 'node:test';
import assert from 'node:assert/strict';
import fakePrisma from './helpers/prisma-double.mjs';
import { setFakeShopify } from './helpers/shopify-double.mjs';
import { createFakeShopify } from './helpers/fake-shopify.mjs';
import { createStoreCreditRefund } from '../lib/refunds/store-credit-refund.js';

const shop = { id: 'shop_refund', domain: 'demo.myshopify.com', currencyCode: 'USD', plan: 'SCALE' };
const session = { shopDomain: shop.domain, accessToken: 'token' };

let orderCounter = 0;
function scenario({ total = 100, maximumRefundable } = {}) {
  const shopify = setFakeShopify(createFakeShopify());
  const orderId = `gid://shopify/Order/${++orderCounter}`;
  const customerGid = `gid://shopify/Customer/refund-${orderCounter}`;
  shopify.seedOrder({
    id: orderId,
    name: `#1048${orderCounter}`,
    customerGid,
    total,
    maximumRefundable,
  });
  return { shopify, orderId, customerGid };
}

test('a full refund to store credit gives the customer the full amount', async () => {
  const { shopify, orderId, customerGid } = scenario({ total: 100 });

  const result = await createStoreCreditRefund({
    shop,
    session,
    orderId,
    creditAmount: 100,
    currency: 'USD',
    bonusAmount: 0,
  });

  assert.equal(result.refundAmount, 100);
  assert.equal(result.bonusAmount, 0);
  assert.equal(result.totalCredit, 100);
  assert.equal(shopify.balanceFor(customerGid), 100);
});

test('a partial refund only refunds the returned value', async () => {
  const { shopify, orderId, customerGid } = scenario({ total: 100 });

  const result = await createStoreCreditRefund({
    shop,
    session,
    orderId,
    creditAmount: 40,
    currency: 'USD',
  });

  assert.equal(result.totalCredit, 40);
  assert.equal(shopify.balanceFor(customerGid), 40);
});

/**
 * The end-to-end version of the specification's critical test:
 * $100 refund + $10 bonus = $110 of native Shopify store credit.
 */
test('CRITICAL: $100 refund with a 10% bonus produces exactly $110 of Shopify credit', async () => {
  const { shopify, orderId, customerGid } = scenario({ total: 100 });

  const result = await createStoreCreditRefund({
    shop,
    session,
    orderId,
    creditAmount: 100,
    currency: 'USD',
    bonusAmount: 10,
  });

  assert.equal(result.refundAmount, 100, 'the refund is the customer\'s own money');
  assert.equal(result.bonusAmount, 10, 'the bonus is merchant-funded and tracked separately');
  assert.equal(result.totalCredit, 110);
  assert.equal(shopify.balanceFor(customerGid), 110, 'Shopify balance is $110');

  // The two movements stay distinguishable in the ledger.
  const events = await fakePrisma.creditEvent.findMany({
    where: { shopId: shop.id, customerGid },
  });
  assert.equal(events.length, 2, 'refund and bonus are recorded as separate events');
  assert.ok(events.some((e) => e.amount === 100 && !e.bonusAmount));
  assert.ok(events.some((e) => e.amount === 10 && e.bonusAmount === 10));
});

test('CRITICAL: repeating the same refund creates no duplicate credit', async () => {
  const { shopify, orderId, customerGid } = scenario({ total: 100 });

  const first = await createStoreCreditRefund({
    shop,
    session,
    orderId,
    creditAmount: 100,
    currency: 'USD',
    bonusAmount: 10,
  });
  assert.equal(shopify.balanceFor(customerGid), 110);

  const second = await createStoreCreditRefund({
    shop,
    session,
    orderId,
    creditAmount: 100,
    currency: 'USD',
    bonusAmount: 10,
  });

  assert.equal(shopify.balanceFor(customerGid), 110, 'balance is STILL $110 — no duplicate');
  assert.equal(shopify.calls.refund, 1, 'refundCreate ran exactly once');
  assert.equal(shopify.calls.credit, 1, 'the bonus was issued exactly once');
  assert.equal(second.replayed, true);
  assert.equal(second.refundGid, first.refundGid);
});

test('a refund larger than the refundable amount is rejected before any call', async () => {
  const { shopify, orderId } = scenario({ total: 100, maximumRefundable: 60 });

  await assert.rejects(
    () =>
      createStoreCreditRefund({
        shop,
        session,
        orderId,
        creditAmount: 100,
        currency: 'USD',
      }),
    /exceeds/i
  );

  assert.equal(shopify.calls.refund, 0, 'Shopify was never asked to refund');
});

test('a currency that does not match the order is rejected', async () => {
  const { shopify, orderId } = scenario({ total: 100 });

  await assert.rejects(
    () =>
      createStoreCreditRefund({
        shop,
        session,
        orderId,
        creditAmount: 100,
        currency: 'EUR',
      }),
    /currency mismatch/i
  );

  assert.equal(shopify.calls.refund, 0);
});

test('a zero refund is rejected', async () => {
  const { orderId } = scenario({ total: 100 });
  await assert.rejects(
    () => createStoreCreditRefund({ shop, session, orderId, creditAmount: 0, currency: 'USD' }),
    /greater than zero/i
  );
});
