import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getEntitlements } from '@/lib/billing/entitlements';
import { recordAudit, AUDIT } from '@/lib/util/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOOLEAN_FIELDS = [
  'weeklyReport',
  'largeCreditIssued',
  'redemptionSpike',
  'expiringCreditSummary',
  'customerCreditIssued',
  'customerCreditReminder',
  'customerExpirationReminder',
  'customerWinBack',
];

export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const [preferences, entitlements] = await Promise.all([
    prisma.notificationPreference.upsert({
      where: { shopId: shop.id },
      create: { shopId: shop.id, merchantEmail: shop.email },
      update: {},
    }),
    getEntitlements(shop),
  ]);
  return ok({ preferences, entitlements });
});

export const PATCH = withErrorHandling(async (request) => {
  const { shop, userId } = await requireShop(request);
  const body = await readJson(request);

  const data = {};
  for (const field of BOOLEAN_FIELDS) {
    if (body[field] !== undefined) data[field] = Boolean(body[field]);
  }
  if (body.merchantEmail !== undefined) data.merchantEmail = body.merchantEmail || null;
  if (body.largeCreditThreshold !== undefined) {
    data.largeCreditThreshold = Math.max(0, Number(body.largeCreditThreshold));
  }
  if (body.reminderAfterDays !== undefined) {
    data.reminderAfterDays = Math.max(1, Number(body.reminderAfterDays));
  }

  const preferences = await prisma.notificationPreference.update({
    where: { shopId: shop.id },
    data,
  });

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.SETTINGS_UPDATED,
    actorId: userId,
    reason: 'Notification preferences updated',
    metadata: data,
  });

  return ok({ preferences });
});
