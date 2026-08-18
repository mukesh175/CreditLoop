/**
 * Transparent credit-incentive rules engine.
 *
 * This is deliberately a deterministic rules engine, not a model. Every offer it
 * produces can be explained to a merchant line by line, which matters because
 * these rules configure real money.
 *
 * Pure functions only — no I/O — so the engine is fully unit-testable and can be
 * run in "test rule" mode against hypothetical inputs.
 */

import { round2 } from '@/lib/util/money';

export const CONDITION_FIELDS = {
  refundAmount: { label: 'Refund amount', type: 'money' },
  customerOrderCount: { label: 'Customer orders', type: 'number' },
  customerLifetimeValue: { label: 'Customer lifetime value', type: 'money' },
  averageOrderValue: { label: 'Average order value', type: 'money' },
  daysSinceLastOrder: { label: 'Days since last order', type: 'number' },
  previousCreditUses: { label: 'Previous store-credit uses', type: 'number' },
  previousReturns: { label: 'Previous returns', type: 'number' },
};

export const OPERATORS = {
  gt: { label: 'is greater than', apply: (a, b) => a > b },
  gte: { label: 'is at least', apply: (a, b) => a >= b },
  lt: { label: 'is less than', apply: (a, b) => a < b },
  lte: { label: 'is at most', apply: (a, b) => a <= b },
  eq: { label: 'equals', apply: (a, b) => a === b },
  neq: { label: 'does not equal', apply: (a, b) => a !== b },
};

/**
 * Context shape:
 * { refundAmount, currencyCode, customerOrderCount, customerLifetimeValue,
 *   averageOrderValue, daysSinceLastOrder, previousCreditUses, previousReturns }
 */
export function evaluateCondition(condition, context) {
  const operator = OPERATORS[condition.operator];
  if (!operator) {
    return { passed: false, explanation: `Unknown operator "${condition.operator}".` };
  }
  const actual = Number(context[condition.field]);
  const fieldMeta = CONDITION_FIELDS[condition.field];
  if (!fieldMeta) {
    return { passed: false, explanation: `Unknown field "${condition.field}".` };
  }
  if (!Number.isFinite(actual)) {
    // Missing data must never silently pass a money-granting condition.
    return {
      passed: false,
      explanation: `${fieldMeta.label} is unknown for this customer.`,
      field: condition.field,
    };
  }
  const passed = operator.apply(actual, Number(condition.value));
  return {
    passed,
    field: condition.field,
    explanation: `${fieldMeta.label} (${actual}) ${operator.label} ${condition.value} → ${
      passed ? 'met' : 'not met'
    }`,
  };
}

function eligibilityMatches(eligibility, context) {
  const orders = Number(context.customerOrderCount) || 0;
  switch (eligibility) {
    case 'NEW':
      return orders <= 1;
    case 'RETURNING':
      return orders >= 2;
    case 'VIP':
      return orders >= 5 || Number(context.customerLifetimeValue) >= 500;
    case 'ALL':
    default:
      return true;
  }
}

/** Is the rule live right now, for this currency, and above the refund floor? */
export function ruleIsApplicable(rule, context, now = new Date()) {
  const reasons = [];
  if (!rule.enabled) reasons.push('Rule is disabled.');
  if (rule.startsAt && new Date(rule.startsAt) > now) reasons.push('Rule has not started yet.');
  if (rule.endsAt && new Date(rule.endsAt) < now) reasons.push('Rule has ended.');
  if (
    rule.currencyCode &&
    context.currencyCode &&
    String(rule.currencyCode).toUpperCase() !== String(context.currencyCode).toUpperCase()
  ) {
    reasons.push(`Rule applies to ${rule.currencyCode}, not ${context.currencyCode}.`);
  }
  if (rule.minRefundAmount != null && Number(context.refundAmount) < Number(rule.minRefundAmount)) {
    reasons.push(`Refund is below the ${rule.minRefundAmount} minimum for this rule.`);
  }
  if (!eligibilityMatches(rule.customerEligibility, context)) {
    reasons.push(`Customer does not match the "${rule.customerEligibility}" eligibility group.`);
  }
  return { applicable: reasons.length === 0, reasons };
}

/** Computes the bonus a single rule would grant, capped by maxBonusAmount. */
export function computeBonus(rule, context) {
  const refund = Number(context.refundAmount) || 0;
  let bonus =
    rule.bonusType === 'FIXED'
      ? Number(rule.bonusValue) || 0
      : (refund * (Number(rule.bonusValue) || 0)) / 100;

  let capped = false;
  if (rule.maxBonusAmount != null && bonus > Number(rule.maxBonusAmount)) {
    bonus = Number(rule.maxBonusAmount);
    capped = true;
  }
  if (bonus < 0) bonus = 0;
  return { bonus: round2(bonus), capped };
}

/**
 * Evaluates every rule and picks a single winner.
 *
 * Overlapping rules do NOT stack — bonuses are never summed. The winner is the
 * highest-priority matching rule; ties break on the larger bonus. Stacking
 * percentage bonuses would make merchant liability unpredictable.
 */
export function evaluateRules(rules, context, now = new Date()) {
  const evaluations = [];

  for (const rule of rules || []) {
    const applicability = ruleIsApplicable(rule, context, now);
    const conditionResults = (rule.conditions || []).map((c) => evaluateCondition(c, context));
    const conditionsPassed = conditionResults.every((r) => r.passed);
    const matched = applicability.applicable && conditionsPassed;
    const { bonus, capped } = matched ? computeBonus(rule, context) : { bonus: 0, capped: false };

    evaluations.push({
      ruleId: rule.id,
      ruleName: rule.name,
      matched,
      bonus,
      capped,
      priority: Number(rule.priority) || 0,
      reasons: [
        ...applicability.reasons,
        ...conditionResults.filter((r) => !r.passed).map((r) => r.explanation),
      ],
      conditionResults,
    });
  }

  const matches = evaluations.filter((e) => e.matched);
  matches.sort((a, b) => b.priority - a.priority || b.bonus - a.bonus);
  const winner = matches[0] || null;

  const refundAmount = round2(Number(context.refundAmount) || 0);
  const bonusAmount = winner ? winner.bonus : 0;

  return {
    eligible: Boolean(winner),
    refundAmount,
    bonusAmount,
    totalCredit: round2(refundAmount + bonusAmount),
    currencyCode: context.currencyCode,
    appliedRule: winner ? { id: winner.ruleId, name: winner.ruleName } : null,
    capped: winner ? winner.capped : false,
    evaluations,
  };
}
