import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop, assertOwnedByShop } from '@/lib/shopify/auth-guard';
import { requireFeature } from '@/lib/billing/entitlements';
import { recordAudit, AUDIT } from '@/lib/util/audit';
import { runCampaign } from '@/lib/campaigns/runner';
import { ValidationError } from '@/lib/util/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request, { params }) => {
  const { shop } = await requireShop(request);
  const { id } = await params;
  const campaign = await prisma.creditCampaign.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  assertOwnedByShop(campaign, shop, 'campaign');

  const [recipientStats, creditIssued] = await Promise.all([
    prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: true,
    }),
    prisma.creditEvent.aggregate({
      where: { shopId: shop.id, campaignId: id, eventType: 'CREDIT' },
      _sum: { amount: true },
    }),
  ]);

  return ok({
    campaign,
    stats: {
      recipients: recipientStats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      creditIssued: Number(creditIssued._sum.amount || 0),
    },
  });
});

/** Status changes and a manual "run now" trigger. */
export const PATCH = withErrorHandling(async (request, { params }) => {
  const { shop, session, userId } = await requireShop(request);
  const { id } = await params;
  const body = await readJson(request);

  const existing = await prisma.creditCampaign.findUnique({ where: { id } });
  assertOwnedByShop(existing, shop, 'campaign');

  if (body.action === 'run') {
    if (existing.status !== 'ACTIVE') {
      throw new ValidationError('Activate the campaign before running it.');
    }
    const summary = await runCampaign({ shop, session, campaign: existing, batchSize: 25 });
    return ok({ summary });
  }

  const data = {};
  if (body.status) {
    if (!['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'].includes(body.status)) {
      throw new ValidationError('Unknown campaign status.');
    }
    if (body.status === 'ACTIVE') {
      await requireFeature(shop, 'automatedCampaigns');
    }
    data.status = body.status;
  }
  for (const field of [
    'name',
    'description',
    'segment',
    'emailTemplate',
    'sendsEmail',
    'requiresMarketingConsent',
  ]) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  for (const field of [
    'minBalance',
    'minDaysInactive',
    'minLifetimeValue',
    'grantValue',
    'grantMaxAmount',
    'grantExpiresInDays',
  ]) {
    if (body[field] !== undefined) data[field] = body[field] == null ? null : Number(body[field]);
  }

  const campaign = await prisma.creditCampaign.update({ where: { id }, data });

  if (data.status === 'ACTIVE' || data.status === 'PAUSED') {
    await prisma.campaignEvent.create({
      data: {
        campaignId: id,
        shopId: shop.id,
        type: data.status === 'ACTIVE' ? 'ACTIVATED' : 'PAUSED',
      },
    });
    await recordAudit({
      shopId: shop.id,
      action: data.status === 'ACTIVE' ? AUDIT.CAMPAIGN_ACTIVATED : AUDIT.CAMPAIGN_PAUSED,
      actorId: userId,
      reason: campaign.name,
      metadata: { campaignId: id },
    });
  }

  return ok({ campaign });
});

export const DELETE = withErrorHandling(async (request, { params }) => {
  const { shop, userId } = await requireShop(request);
  const { id } = await params;
  const campaign = await prisma.creditCampaign.findUnique({ where: { id } });
  assertOwnedByShop(campaign, shop, 'campaign');
  await prisma.creditCampaign.delete({ where: { id } });
  await recordAudit({
    shopId: shop.id,
    action: AUDIT.ADMIN_ACTION,
    actorId: userId,
    reason: `Campaign deleted: ${campaign.name}`,
  });
  return ok({ deleted: true });
});
