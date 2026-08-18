import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { evaluateRules } from '@/lib/rules/engine';
import { validateRulePayload } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dry-run a rule against hypothetical inputs before saving it.
 *
 * Merchants are configuring real money here, so they get to see exactly what a
 * rule would pay out — including which conditions passed and which did not —
 * before it can ever fire.
 */
export const POST = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const body = await readJson(request);

  const context = {
    refundAmount: Number(body.refundAmount) || 0,
    currencyCode: String(body.currencyCode || shop.currencyCode).toUpperCase(),
    customerOrderCount: body.customerOrderCount != null ? Number(body.customerOrderCount) : undefined,
    customerLifetimeValue:
      body.customerLifetimeValue != null ? Number(body.customerLifetimeValue) : undefined,
    averageOrderValue: body.averageOrderValue != null ? Number(body.averageOrderValue) : undefined,
    daysSinceLastOrder:
      body.daysSinceLastOrder != null ? Number(body.daysSinceLastOrder) : undefined,
    previousCreditUses: Number(body.previousCreditUses) || 0,
    previousReturns: Number(body.previousReturns) || 0,
  };

  // Test either an unsaved draft rule or every saved rule for this shop.
  let rules;
  if (body.draftRule) {
    const validated = validateRulePayload(body.draftRule);
    rules = [
      {
        id: 'draft',
        ...validated,
        enabled: true,
        conditions: (body.draftRule.conditions || []).map((c) => ({
          field: c.field,
          operator: c.operator,
          value: Number(c.value),
        })),
      },
    ];
  } else {
    rules = await prisma.creditRule.findMany({
      where: { shopId: shop.id, ...(body.ruleId ? { id: body.ruleId } : { enabled: true }) },
      include: { conditions: true },
    });
  }

  const result = evaluateRules(rules, context);
  return ok({ context, result });
});
