import test from 'node:test';
import assert from 'node:assert/strict';
import { isDemoGid, demoLabel } from '../lib/demo/identifiers.js';

test('demo identifiers are recognised', () => {
  assert.equal(isDemoGid('gid://creditloop-demo/Customer/1042'), true);
  assert.equal(isDemoGid('gid://creditloop-demo/Order/10400'), true);
});

test('real Shopify identifiers are not treated as demo', () => {
  assert.equal(isDemoGid('gid://shopify/Customer/1042'), false);
  assert.equal(isDemoGid('gid://shopify/Order/10400'), false);
});

test('malformed input never passes as demo', () => {
  for (const value of [null, undefined, '', 42, {}, 'creditloop-demo']) {
    assert.equal(isDemoGid(value), false);
  }
});

test('demo identifiers get a readable label', () => {
  assert.equal(demoLabel('gid://creditloop-demo/Customer/1042'), 'Demo customer 1042');
  assert.equal(demoLabel('gid://shopify/Customer/1'), null);
});
