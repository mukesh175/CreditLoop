import test from 'node:test';
import assert from 'node:assert/strict';
import { expandGrantedScopes, findMissingScopes } from '../lib/shopify/scopes.js';

const REQUIRED = [
  'read_orders',
  'write_orders',
  'read_returns',
  'read_customers',
  'read_store_credit_accounts',
  'write_store_credit_account_transactions',
];

test('a write scope covers the matching read scope', () => {
  const granted = expandGrantedScopes('write_orders');
  assert.ok(granted.has('write_orders'));
  assert.ok(granted.has('read_orders'), 'write_orders implies read_orders');
});

test("Shopify's collapsed scope list is not reported as missing scopes", () => {
  // What Shopify actually returns when every requested scope was granted: the
  // implied read scopes are omitted.
  const returned =
    'write_orders,read_returns,read_customers,read_store_credit_accounts,write_store_credit_account_transactions';
  assert.deepEqual(findMissingScopes(REQUIRED, returned), []);
});

test('a genuinely missing scope is still reported', () => {
  const returned = 'write_orders,read_returns';
  const missing = findMissingScopes(REQUIRED, returned);
  assert.ok(missing.includes('read_customers'));
  assert.ok(missing.includes('read_store_credit_accounts'));
  assert.ok(!missing.includes('read_orders'), 'implied by write_orders');
});

test('an empty grant reports everything as missing', () => {
  assert.deepEqual(findMissingScopes(REQUIRED, ''), REQUIRED);
  assert.deepEqual(findMissingScopes(REQUIRED, null), REQUIRED);
});

test('a read scope does not imply the write scope', () => {
  const granted = expandGrantedScopes('read_orders');
  assert.ok(!granted.has('write_orders'), 'reading must never imply writing');
});
