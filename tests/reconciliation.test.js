import test from 'node:test';
import assert from 'node:assert/strict';
import fakePrisma from './helpers/prisma-double.mjs';
import { setFakeShopify } from './helpers/shopify-double.mjs';
import { createFakeShopify } from './helpers/fake-shopify.mjs';
import { reconcileShop } from '../lib/credit/reconcile.js';

const session = { shopDomain: 'demo.myshopify.com', accessToken: 'token' };

let counter = 0;
function freshShop() {
  return { id: `shop_recon_${++counter}`, domain: session.shopDomain, currencyCode: 'USD' };
}

test('a balance that matches the ledger raises no warning', async () => {
  const shop = freshShop();
  const shopify = setFakeShopify(createFakeShopify());
  const customerGid = 'gid://shopify/Customer/match';

  shopify.seedBalance(customerGid, 110, 'USD');
  await fakePrisma.creditEvent.create({
    data: {
      shopId: shop.id,
      customerGid,
      eventType: 'CREDIT',
      amount: 110,
      currencyCode: 'USD',
      source: 'RETURN_REFUND',
    },
  });

  const result = await reconcileShop({ shop, session });
  assert.equal(result.mismatched, 0);
  assert.equal(result.matched, 1);
});

test('a difference is logged for review and Shopify is never modified', async () => {
  const shop = freshShop();
  const shopify = setFakeShopify(createFakeShopify());
  const customerGid = 'gid://shopify/Customer/mismatch';

  // CreditLoop recorded $120 of credit; Shopify only holds $95 — someone spent
  // or adjusted it outside the app.
  shopify.seedBalance(customerGid, 95, 'USD');
  await fakePrisma.creditEvent.create({
    data: {
      shopId: shop.id,
      customerGid,
      eventType: 'CREDIT',
      amount: 120,
      currencyCode: 'USD',
      source: 'RETURN_REFUND',
    },
  });

  const result = await reconcileShop({ shop, session });

  assert.equal(result.mismatched, 1);
  assert.equal(shopify.balanceFor(customerGid), 95, 'the Shopify balance is untouched');
  assert.equal(shopify.calls.credit, 0, 'reconciliation never issues credit');
  assert.equal(shopify.calls.debit, 0, 'reconciliation never debits credit');

  const record = await fakePrisma.reconciliationRecord.findFirst({
    where: { shopId: shop.id, customerGid },
  });
  assert.ok(record, 'the difference is recorded');
  assert.equal(record.shopifyBalance, 95);
  assert.equal(record.expectedFromEvents, 120);
  assert.equal(record.difference, -25);
  assert.equal(record.status, 'OPEN');
});

test('attributed redemptions are subtracted before comparing', async () => {
  const shop = freshShop();
  const shopify = setFakeShopify(createFakeShopify());
  const customerGid = 'gid://shopify/Customer/redeemed';

  // Issued $110, the customer spent $60, so Shopify should hold $50.
  shopify.seedBalance(customerGid, 50, 'USD');
  const event = await fakePrisma.creditEvent.create({
    data: {
      shopId: shop.id,
      customerGid,
      eventType: 'CREDIT',
      amount: 110,
      currencyCode: 'USD',
      source: 'RETURN_REFUND',
    },
  });
  await fakePrisma.creditAttribution.create({
    data: {
      shopId: shop.id,
      creditEventId: event.id,
      orderAttributionId: 'order_1',
      amountAttributed: 60,
      currencyCode: 'USD',
      creditEvent: { customerGid },
    },
  });

  const result = await reconcileShop({ shop, session });
  assert.equal(result.mismatched, 0, '110 issued − 60 redeemed = 50, which matches Shopify');
});
