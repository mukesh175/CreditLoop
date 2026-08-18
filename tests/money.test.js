import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSameCurrency,
  CurrencyMismatchError,
  addMoney,
  sumByCurrency,
  round2,
  formatMoney,
} from '../lib/util/money.js';

test('adding different currencies is rejected', () => {
  assert.throws(
    () => addMoney({ amount: 100, currencyCode: 'USD' }, { amount: 100, currencyCode: 'EUR' }),
    CurrencyMismatchError
  );
});

test('same-currency addition is exact in cents', () => {
  const result = addMoney({ amount: 0.1, currencyCode: 'USD' }, { amount: 0.2, currencyCode: 'USD' });
  assert.equal(result.amount, 0.3, 'no floating point drift');
});

test('sums are grouped per currency and never merged', () => {
  const totals = sumByCurrency([
    { amount: 100, currencyCode: 'USD' },
    { amount: 50, currencyCode: 'USD' },
    { amount: 100, currencyCode: 'EUR' },
  ]);
  assert.deepEqual(totals, { USD: 150, EUR: 100 });
});

test('assertSameCurrency normalises case', () => {
  assert.equal(assertSameCurrency('usd', 'USD'), 'USD');
});

test('rounding uses cents, not float arithmetic', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(100.1 * 3), 300.3);
});

test('currency codes are displayed, not assumed', () => {
  assert.match(formatMoney(100, 'EUR'), /100/);
  assert.notEqual(formatMoney(100, 'USD'), formatMoney(100, 'EUR'));
});
