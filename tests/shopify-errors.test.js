import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopifyAccessDeniedError, ShopifyApiError, toErrorResponse } from '../lib/util/errors.js';

test('an access-denied error is distinguishable from a transient failure', () => {
  const denied = new ShopifyAccessDeniedError('Access denied for customers field.');
  assert.equal(denied.code, 'SHOPIFY_ACCESS_DENIED');
  assert.equal(denied.status, 403);

  const generic = new ShopifyApiError('Shopify could not complete the request.');
  assert.equal(generic.code, 'SHOPIFY_API_ERROR');
  assert.notEqual(generic.code, denied.code, 'the two must not be conflated');
});

test("Shopify's own explanation reaches the merchant", () => {
  const message =
    'Access denied for customers field. Required access: `read_customers` access scope.';
  const { body, status } = toErrorResponse(new ShopifyAccessDeniedError(message), 'req-1');

  assert.equal(status, 403);
  assert.equal(body.error.message, message, 'the actionable text is not replaced with a generic one');
  assert.equal(body.error.code, 'SHOPIFY_ACCESS_DENIED');
});

test('unexpected errors still get a generic message', () => {
  const { body } = toErrorResponse(new Error('connect ECONNREFUSED 10.0.0.1:5432'), 'req-2');
  assert.match(body.error.message, /something went wrong/i);
  assert.ok(!body.error.message.includes('ECONNREFUSED'), 'internals never reach the browser');
});
