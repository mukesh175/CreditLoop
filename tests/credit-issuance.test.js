import test from 'node:test';
import assert from 'node:assert/strict';
import fakePrisma from './helpers/prisma-double.mjs';
import { setFakeShopify } from './helpers/shopify-double.mjs';
import { createFakeShopify } from './helpers/fake-shopify.mjs';
import { issueStoreCredit, getCustomerStoreCredit } from '../lib/credit/store-credit.js';

const shop = { id: 'shop_credit', domain: 'demo.myshopify.com', currencyCode: 'USD', plan: 'SCALE' };
const session = { shopDomain: shop.domain, accessToken: 'token' };
const customerGid = 'gid://shopify/Customer/1';

function freshShopify() {
  return setFakeShopify(createFakeShopify());
}

test('issuing credit moves money in Shopify and records an analytics event', async () => {
  const shopify = freshShopify();

  const result = await issueStoreCredit({
    shop,
    session,
    customerGid,
    amount: 110,
    currencyCode: 'USD',
    reason: 'Return credit',
    source: 'RETURN_REFUND',
    idempotencyKey: 'test:issue:1',
  });

  assert.equal(result.amount, 110);
  assert.equal(result.currencyCode, 'USD');
  assert.ok(result.transactionId, 'a Shopify transaction id is always recorded');
  assert.equal(shopify.balanceFor(customerGid), 110, 'Shopify holds the balance');

  const events = await fakePrisma.creditEvent.findMany({ where: { shopId: shop.id } });
  assert.equal(events.length, 1);
  assert.equal(events[0].shopifyTransactionId, result.transactionId);
});

/**
 * The critical financial test from the specification.
 *
 * $100 refund + a 10% rule = $110 credit. Running the identical request a second
 * time must NOT create a second $110 credit.
 */
test('CRITICAL: repeating an identical credit request creates no duplicate credit', async () => {
  const shopify = freshShopify();
  const key = 'refund:order-10482:110:USD';
  // Own customer so this assertion counts only this scenario's ledger entries.
  const customerGid = 'gid://shopify/Customer/critical-1';

  const first = await issueStoreCredit({
    shop,
    session,
    customerGid,
    amount: 110,
    currencyCode: 'USD',
    reason: 'Return Credit Rule',
    idempotencyKey: key,
  });

  assert.equal(shopify.balanceFor(customerGid), 110, 'balance is $110 after the first issuance');

  const second = await issueStoreCredit({
    shop,
    session,
    customerGid,
    amount: 110,
    currencyCode: 'USD',
    reason: 'Return Credit Rule',
    idempotencyKey: key,
  });

  assert.equal(shopify.balanceFor(customerGid), 110, 'balance is STILL $110 — no duplicate credit');
  assert.equal(shopify.calls.credit, 1, 'the Shopify mutation was called exactly once');
  assert.equal(second.replayed, true);
  assert.equal(second.transactionId, first.transactionId);

  const events = await fakePrisma.creditEvent.findMany({
    where: { shopId: shop.id, customerGid },
  });
  assert.equal(events.length, 1, 'exactly one ledger entry exists');
});

test('a currency mismatch is rejected before any money moves', async () => {
  const shopify = freshShopify();
  shopify.seedBalance(customerGid, 50, 'USD');

  await assert.rejects(
    () =>
      issueStoreCredit({
        shop,
        session,
        customerGid,
        amount: 25,
        currencyCode: '',
        reason: 'Bad currency',
        idempotencyKey: 'test:bad-currency',
      }),
    /currency code is required/i
  );
  assert.equal(shopify.calls.credit, 0, 'Shopify was never called');
});

test('a zero or negative amount is rejected', async () => {
  const shopify = freshShopify();
  for (const amount of [0, -10]) {
    await assert.rejects(
      () =>
        issueStoreCredit({
          shop,
          session,
          customerGid,
          amount,
          currencyCode: 'USD',
          reason: 'Invalid',
          idempotencyKey: `test:invalid:${amount}`,
        }),
      /greater than zero/i
    );
  }
  assert.equal(shopify.calls.credit, 0);
});

test('a Shopify failure issues no credit and surfaces a safe message', async () => {
  const shopify = freshShopify();
  shopify.failNextCreditWith(new Error('Throttled by Shopify'));

  await assert.rejects(() =>
    issueStoreCredit({
      shop,
      session,
      customerGid,
      amount: 40,
      currencyCode: 'USD',
      reason: 'Return credit',
      idempotencyKey: 'test:failure',
    })
  );

  assert.equal(shopify.balanceFor(customerGid), 0, 'no credit was created');

  const record = await fakePrisma.idempotencyRecord.findUnique({
    where: { shopId_key: { shopId: shop.id, key: 'test:failure' } },
  });
  assert.equal(record.status, 'FAILED');

  const audit = await fakePrisma.auditLog.findFirst({
    where: { shopId: shop.id, result: 'FAILURE' },
  });
  assert.ok(audit, 'the failed attempt is audited');
});

test('issuing credit requires an idempotency key', async () => {
  freshShopify();
  await assert.rejects(
    () =>
      issueStoreCredit({
        shop,
        session,
        customerGid,
        amount: 10,
        currencyCode: 'USD',
        reason: 'No key',
      }),
    /idempotency key is required/i
  );
});

test('balances are read from Shopify, never derived from the local ledger', async () => {
  const shopify = freshShopify();
  shopify.seedBalance(customerGid, 250, 'USD');

  const profile = await getCustomerStoreCredit(session, customerGid);
  assert.equal(profile.accounts[0].balance, 250);
  assert.equal(profile.accounts[0].currencyCode, 'USD');
});
