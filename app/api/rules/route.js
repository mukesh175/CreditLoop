import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { ValidationError } from '@/lib/util/errors';
import { recordAudit, AUDIT } from '@/lib/util/audit';
import { CONDITION_FIELDS, OPERATORS } from '@/lib/rules/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const rules = await prisma.creditRule.findMany({
    where: { shopId: shop.id },
    include: { conditions: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
  return ok({ rules });
});

/** Validates a rule payload. Financial config gets strict, explicit bounds. */
export function validateRulePayload(body) {
  if (!body.name || String(body.name).trim().length < 2) {
    throw new ValidationError('Give the rule a name.');
  }
  if (!['PERCENTAGE', 'FIXED'].includes(body.bonusType)) {
    throw new ValidationError('Bonus type must be a percentage or a fixed amount.');
  }
  const bonusValue = Number(body.bonusValue);
  if (!Number.isFinite(bonusValue) || bonusValue < 0) {
    throw new ValidationError('Bonus value must be zero or greater.');
  }
  if (body.bonusType === 'PERCENTAGE' && bonusValue > 100) {
    throw new ValidationError('A percentage bonus cannot exceed 100%.');
  }
  if (body.maxBonusAmount != null && Number(body.maxBonusAmount) < 0) {
    throw new ValidationError('Maximum bonus cannot be negative.');
  }
  if (body.bonusType === 'PERCENTAGE' && body.maxBonusAmount == null) {
    throw new ValidationError(
      'A percentage bonus needs a maximum bonus amount so your liability stays capped.'
    );
  }

  for (const condition of body.conditions || []) {
    if (!CONDITION_FIELDS[condition.field]) {
      throw new ValidationError(`"${condition.field}" is not a condition CreditLoop supports.`);
    }
    if (!OPERATORS[condition.operator]) {
      throw new ValidationError(`"${condition.operator}" is not a supported operator.`);
    }
    if (!Number.isFinite(Number(condition.value))) {
      throw new ValidationError('Every condition needs a numeric value.');
    }
  }

  return {
    name: String(body.name).trim(),
    description: body.description ? String(body.description).slice(0, 500) : null,
    enabled: Boolean(body.enabled),
    priority: Number(body.priority) || 0,
    bonusType: body.bonusType,
    bonusValue,
    maxBonusAmount: body.maxBonusAmount != null ? Number(body.maxBonusAmount) : null,
    minRefundAmount: body.minRefundAmount != null ? Number(body.minRefundAmount) : null,
    customerEligibility: ['ALL', 'NEW', 'RETURNING', 'VIP'].includes(body.customerEligibility)
      ? body.customerEligibility
      : 'ALL',
    currencyCode: body.currencyCode ? String(body.currencyCode).toUpperCase() : null,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
  };
}

export const POST = withErrorHandling(async (request) => {
  const { shop, userId } = await requireShop(request);
  const body = await readJson(request);
  const data = validateRulePayload(body);

  const rule = await prisma.creditRule.create({
    data: {
      shopId: shop.id,
      ...data,
      conditions: {
        create: (body.conditions || []).map((c) => ({
          field: c.field,
          operator: c.operator,
          value: Number(c.value),
        })),
      },
    },
    include: { conditions: true },
  });

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.RULE_CREATED,
    actorId: userId,
    reason: rule.name,
    metadata: { ruleId: rule.id, bonusType: rule.bonusType, bonusValue: rule.bonusValue },
  });

  return ok({ rule }, { status: 201 });
});
