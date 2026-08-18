import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStoreCreditUsed } from '../lib/analytics/store-credit-usage.js';

test('store credit used is read from successful store-credit transactions', () => {
  const order = {
    currency: 'USD',
    payment_gateway_names: ['store credit', 'shopify_payments'],
    transactions: [
      { gateway: 'store credit', kind: 'sale', status: 'success', amount: '60.00', currency: 'USD' },
      { gateway: 'shopify_payments', kind: 'sale', status: 'success', amount: '20.00', currency: 'USD' },
    ],
  };
  assert.equal(extractStoreCreditUsed(order, 'USD'), 60);
});

test('failed store-credit transactions are not counted', () => {
  const order = {
    currency: 'USD',
    payment_gateway_names: ['store credit'],
    transactions: [
      { gateway: 'store credit', kind: 'sale', status: 'failure', amount: '60.00', currency: 'USD' },
    ],
  };
  assert.equal(extractStoreCreditUsed(order, 'USD'), 0);
});

test('a transaction in another currency is never added to the total', () => {
  const order = {
    currency: 'USD',
    payment_gateway_names: ['store credit'],
    transactions: [
      { gateway: 'store credit', kind: 'sale', status: 'success', amount: '60.00', currency: 'USD' },
      { gateway: 'store credit', kind: 'sale', status: 'success', amount: '40.00', currency: 'EUR' },
    ],
  };
  assert.equal(extractStoreCreditUsed(order, 'USD'), 60);
});

test('orders without store credit report zero', () => {
  const order = {
    currency: 'USD',
    payment_gateway_names: ['shopify_payments'],
    transactions: [
      { gateway: 'shopify_payments', kind: 'sale', status: 'success', amount: '80.00', currency: 'USD' },
    ],
  };
  assert.equal(extractStoreCreditUsed(order, 'USD'), 0);
});

test('credit used is not confused with order revenue', () => {
  // Scenario from the spec: balance $110, customer spends $60 on an $80 order.
  const order = {
    currency: 'USD',
    total_price: '80.00',
    payment_gateway_names: ['store credit', 'shopify_payments'],
    transactions: [
      { gateway: 'store credit', kind: 'sale', status: 'success', amount: '60.00', currency: 'USD' },
      { gateway: 'shopify_payments', kind: 'sale', status: 'success', amount: '20.00', currency: 'USD' },
    ],
  };
  const creditUsed = extractStoreCreditUsed(order, 'USD');
  const orderTotal = Number(order.total_price);

  assert.equal(creditUsed, 60, 'credit used is 60');
  assert.equal(orderTotal, 80, 'revenue from the order is 80');
  assert.notEqual(creditUsed, orderTotal, '60 of credit must never be reported as 80 of revenue');
});
