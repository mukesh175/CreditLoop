import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { ValidationError } from '@/lib/util/errors';
import { requireFeature } from '@/lib/billing/entitlements';
import { recordAudit, AUDIT } from '@/lib/util/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['RETURN_CREDIT', 'WIN_BACK', 'VIP'];

export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const campaigns = await prisma.creditCampaign.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { recipients: true } } },
  });

  const stats = await prisma.campaignRecipient.groupBy({
    by: ['campaignId', 'status'],
    where: { shopId: shop.id },
    _count: true,
  });

  return ok({
    campaigns: campaigns.map((c) => ({
      ...c,
      stats: stats
        .filter((s) => s.campaignId === c.id)
        .reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
    })),
  });
});

export const POST = withErrorHandling(async (request) => {
  const { shop, userId } = await requireShop(request);
  const body = await readJson(request);

  if (!body.name) throw new ValidationError('Give the campaign a name.');
  if (!TYPES.includes(body.type)) {
    throw new ValidationError('Choose a campaign type: Return Credit, Win-back or VIP.');
  }
  if (body.grantsCredit) {
    await requireFeature(shop, 'automatedCampaigns');
    if (!body.grantValue || Number(body.grantValue) <= 0) {
      throw new ValidationError('A credit-granting campaign needs a grant amount above zero.');
    }
    if (body.grantType === 'PERCENTAGE' && body.grantMaxAmount == null) {
      throw new ValidationError(
        'A percentage grant needs a maximum amount so your liability stays capped.'
      );
    }
  }

  const campaign = await prisma.creditCampaign.create({
    data: {
      shopId: shop.id,
      name: String(body.name).trim(),
      type: body.type,
      description: body.description || null,
      // Campaigns always start as drafts — nothing sends or credits until the
      // merchant activates it explicitly.
      status: 'DRAFT',
      segment: body.segment || 'CREDIT_HOLDERS',
      minBalance: body.minBalance != null ? Number(body.minBalance) : null,
      minDaysInactive: body.minDaysInactive != null ? Number(body.minDaysInactive) : null,
      minLifetimeValue: body.minLifetimeValue != null ? Number(body.minLifetimeValue) : null,
      currencyCode: (body.currencyCode || shop.currencyCode).toUpperCase(),
      grantsCredit: Boolean(body.grantsCredit),
      grantType: body.grantType || null,
      grantValue: body.grantValue != null ? Number(body.grantValue) : null,
      grantMaxAmount: body.grantMaxAmount != null ? Number(body.grantMaxAmount) : null,
      grantExpiresInDays:
        body.grantExpiresInDays != null ? Number(body.grantExpiresInDays) : null,
      sendsEmail: body.sendsEmail !== false,
      emailTemplate: body.emailTemplate || null,
      requiresMarketingConsent: body.requiresMarketingConsent !== false,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    },
  });

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.ADMIN_ACTION,
    actorId: userId,
    reason: `Campaign created: ${campaign.name}`,
    metadata: { campaignId: campaign.id, type: campaign.type },
  });

  return ok({ campaign }, { status: 201 });
});
