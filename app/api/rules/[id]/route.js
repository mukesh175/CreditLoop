import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop, assertOwnedByShop } from '@/lib/shopify/auth-guard';
import { recordAudit, AUDIT } from '@/lib/util/audit';
import { validateRulePayload } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadRule(shop, id) {
  const rule = await prisma.creditRule.findUnique({
    where: { id },
    include: { conditions: true },
  });
  return assertOwnedByShop(rule, shop, 'rule');
}

export const GET = withErrorHandling(async (request, { params }) => {
  const { shop } = await requireShop(request);
  const rule = await loadRule(shop, (await params).id);
  return ok({ rule });
});

export const PATCH = withErrorHandling(async (request, { params }) => {
  const { shop, userId } = await requireShop(request);
  const { id } = await params;
  const existing = await loadRule(shop, id);
  const body = await readJson(request);

  // Toggling enabled is the common case and does not require a full payload.
  if (Object.keys(body).length === 1 && body.enabled != null) {
    const rule = await prisma.creditRule.update({
      where: { id },
      data: { enabled: Boolean(body.enabled) },
      include: { conditions: true },
    });
    await recordAudit({
      shopId: shop.id,
      action: body.enabled ? AUDIT.RULE_UPDATED : AUDIT.RULE_DISABLED,
      actorId: userId,
      reason: rule.name,
      metadata: { ruleId: rule.id, enabled: rule.enabled },
    });
    return ok({ rule });
  }

  const data = validateRulePayload({ ...existing, ...body });
  const rule = await prisma.$transaction(async (tx) => {
    await tx.creditRuleCondition.deleteMany({ where: { ruleId: id } });
    return tx.creditRule.update({
      where: { id },
      data: {
        ...data,
        conditions: {
          create: (body.conditions || existing.conditions || []).map((c) => ({
            field: c.field,
            operator: c.operator,
            value: Number(c.value),
          })),
        },
      },
      include: { conditions: true },
    });
  });

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.RULE_UPDATED,
    actorId: userId,
    reason: rule.name,
    metadata: { ruleId: rule.id },
  });
  return ok({ rule });
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const { shop, userId } = await requireShop(request);
  const { id } = await params;
  const rule = await loadRule(shop, id);
  await prisma.creditRule.delete({ where: { id } });
  await recordAudit({
    shopId: shop.id,
    action: AUDIT.RULE_DELETED,
    actorId: userId,
    reason: rule.name,
    metadata: { ruleId: id },
  });
  return ok({ deleted: true });
});
