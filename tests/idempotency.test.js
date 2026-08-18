import test from 'node:test';
import assert from 'node:assert/strict';
import fakePrisma from './helpers/prisma-double.mjs';
import { withIdempotency, refundIdempotencyKey } from '../lib/util/idempotency.js';

const shopId = 'shop_1';

test('an operation runs once and replays on repeat', async () => {
  let executions = 0;
  const operation = async () => {
    executions += 1;
    return { transactionId: 'gid://shopify/StoreCreditAccountTransaction/1', amount: 110 };
  };

  const first = await withIdempotency(
    { shopId, key: 'issue:abc', operation: 'ISSUE_CREDIT', requestPayload: { amount: 110 } },
    operation
  );
  const second = await withIdempotency(
    { shopId, key: 'issue:abc', operation: 'ISSUE_CREDIT', requestPayload: { amount: 110 } },
    operation
  );

  assert.equal(executions, 1, 'the financial mutation executed exactly once');
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true, 'the repeat returned the stored result');
  assert.equal(second.result.transactionId, first.result.transactionId);
});

test('a concurrent duplicate is refused rather than risking double credit', async () => {
  let started = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const slowOperation = async () => {
    started += 1;
    await gate;
    return { transactionId: 'gid://txn/2' };
  };

  const inFlight = withIdempotency(
    { shopId, key: 'issue:concurrent', operation: 'ISSUE_CREDIT' },
    slowOperation
  );

  await assert.rejects(
    () => withIdempotency({ shopId, key: 'issue:concurrent', operation: 'ISSUE_CREDIT' }, slowOperation),
    (error) => {
      assert.equal(error.code, 'IDEMPOTENT_IN_PROGRESS');
      assert.match(error.message, /No additional store credit was created/);
      return true;
    }
  );

  release();
  await inFlight;
  assert.equal(started, 1, 'only one attempt ever reached Shopify');
});

test('a failed attempt is recorded and may be retried once', async () => {
  let attempts = 0;
  const flaky = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('Shopify rejected the request.');
    return { transactionId: 'gid://txn/3' };
  };

  await assert.rejects(() =>
    withIdempotency({ shopId, key: 'issue:flaky', operation: 'ISSUE_CREDIT' }, flaky)
  );

  const record = await fakePrisma.idempotencyRecord.findUnique({
    where: { shopId_key: { shopId, key: 'issue:flaky' } },
  });
  assert.equal(record.status, 'FAILED', 'the failure is inspectable, not silently retried');

  const retry = await withIdempotency(
    { shopId, key: 'issue:flaky', operation: 'ISSUE_CREDIT' },
    flaky
  );
  assert.equal(retry.result.transactionId, 'gid://txn/3');
});

test('refund keys are stable for identical requests and differ otherwise', () => {
  const a = refundIdempotencyKey({ orderGid: 'gid://shopify/Order/1', amount: 100, currencyCode: 'USD', bonusAmount: 10 });
  const b = refundIdempotencyKey({ orderGid: 'gid://shopify/Order/1', amount: 100, currencyCode: 'USD', bonusAmount: 10 });
  const c = refundIdempotencyKey({ orderGid: 'gid://shopify/Order/1', amount: 100, currencyCode: 'EUR', bonusAmount: 10 });
  const d = refundIdempotencyKey({ orderGid: 'gid://shopify/Order/2', amount: 100, currencyCode: 'USD', bonusAmount: 10 });

  assert.equal(a, b, 'the same refund produces the same key');
  assert.notEqual(a, c, 'a different currency is a different operation');
  assert.notEqual(a, d, 'a different order is a different operation');
});
