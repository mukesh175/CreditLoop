import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRules,
  computeBonus,
  evaluateCondition,
  ruleIsApplicable,
} from '../lib/rules/engine.js';

const baseRule = {
  id: 'r1',
  name: 'Standard Return Credit',
  enabled: true,
  priority: 10,
  bonusType: 'PERCENTAGE',
  bonusValue: 10,
  maxBonusAmount: 25,
  minRefundAmount: 50,
  customerEligibility: 'ALL',
  conditions: [{ field: 'refundAmount', operator: 'gte', value: 50 }],
};

const baseContext = {
  refundAmount: 100,
  currencyCode: 'USD',
  customerOrderCount: 3,
  customerLifetimeValue: 300,
  averageOrderValue: 100,
  daysSinceLastOrder: 20,
  previousCreditUses: 1,
  previousReturns: 1,
};

test('10% bonus on a $100 refund gives $110 total credit', () => {
  const result = evaluateRules([baseRule], baseContext);
  assert.equal(result.eligible, true);
  assert.equal(result.bonusAmount, 10);
  assert.equal(result.totalCredit, 110);
  assert.equal(result.appliedRule.name, 'Standard Return Credit');
});

test('fixed bonus is applied as a flat amount', () => {
  const rule = { ...baseRule, bonusType: 'FIXED', bonusValue: 15, maxBonusAmount: null };
  const result = evaluateRules([rule], baseContext);
  assert.equal(result.bonusAmount, 15);
  assert.equal(result.totalCredit, 115);
});

test('maximum bonus caps a percentage payout', () => {
  const result = evaluateRules([baseRule], { ...baseContext, refundAmount: 1000 });
  assert.equal(result.bonusAmount, 25, 'bonus is capped at maxBonusAmount');
  assert.equal(result.totalCredit, 1025);
  assert.equal(result.capped, true);
});

test('minimum refund amount blocks a rule below the floor', () => {
  const result = evaluateRules([baseRule], { ...baseContext, refundAmount: 20 });
  assert.equal(result.eligible, false);
  assert.equal(result.bonusAmount, 0);
  assert.equal(result.totalCredit, 20, 'refund still returns in full, just without a bonus');
});

test('VIP rule matches customers with 5+ orders', () => {
  const vip = {
    ...baseRule,
    id: 'vip',
    name: 'VIP Return',
    bonusValue: 15,
    maxBonusAmount: 50,
    minRefundAmount: null,
    customerEligibility: 'VIP',
    conditions: [{ field: 'customerOrderCount', operator: 'gte', value: 5 }],
  };

  const notVip = evaluateRules([vip], baseContext);
  assert.equal(notVip.eligible, false);

  const isVip = evaluateRules([vip], { ...baseContext, customerOrderCount: 7 });
  assert.equal(isVip.eligible, true);
  assert.equal(isVip.bonusAmount, 15);
});

test('a disabled rule never fires', () => {
  const result = evaluateRules([{ ...baseRule, enabled: false }], baseContext);
  assert.equal(result.eligible, false);
  assert.equal(result.totalCredit, 100);
});

test('overlapping rules do not stack — highest priority wins', () => {
  const vip = {
    ...baseRule,
    id: 'vip',
    name: 'VIP Return',
    priority: 30,
    bonusValue: 15,
    maxBonusAmount: 50,
    conditions: [{ field: 'customerOrderCount', operator: 'gte', value: 5 }],
  };

  const result = evaluateRules([baseRule, vip], { ...baseContext, customerOrderCount: 7 });
  assert.equal(result.appliedRule.name, 'VIP Return');
  assert.equal(result.bonusAmount, 15, 'only the winning rule pays out — 10% + 15% must not stack');
  assert.equal(result.totalCredit, 115);
});

test('a condition on unknown data fails closed rather than granting money', () => {
  const result = evaluateCondition(
    { field: 'customerLifetimeValue', operator: 'gte', value: 500 },
    { ...baseContext, customerLifetimeValue: undefined }
  );
  assert.equal(result.passed, false);
  assert.match(result.explanation, /unknown/i);
});

test('rules are currency-scoped and never apply across currencies', () => {
  const eurRule = { ...baseRule, currencyCode: 'EUR' };
  const { applicable, reasons } = ruleIsApplicable(eurRule, baseContext);
  assert.equal(applicable, false);
  assert.match(reasons.join(' '), /EUR/);
});

test('an expired rule stops paying out', () => {
  const expired = { ...baseRule, endsAt: new Date('2020-01-01') };
  const result = evaluateRules([expired], baseContext);
  assert.equal(result.eligible, false);
});

test('bonus never goes negative', () => {
  const { bonus } = computeBonus({ ...baseRule, bonusValue: -50 }, baseContext);
  assert.equal(bonus, 0);
});
