import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret, forEachActiveShop } from '@/lib/api/cron-auth';
import { getOfflineSession } from '@/lib/shopify/sessions';
import { runCampaign } from '@/lib/campaigns/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs every ACTIVE campaign in bounded batches.
 * Recipients already processed are skipped, so re-entry is safe.
 */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);

  const results = await forEachActiveShop(prisma, async (shop) => {
    const campaigns = await prisma.creditCampaign.findMany({
      where: {
        shopId: shop.id,
        status: 'ACTIVE',
        OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
      },
      take: 5,
    });
    if (!campaigns.length) return { campaigns: 0 };

    const session = await getOfflineSession(shop.domain);
    const summaries = [];
    for (const campaign of campaigns) {
      summaries.push({
        campaign: campaign.name,
        ...(await runCampaign({ shop, session, campaign, batchSize: 25 })),
      });
    }
    return { campaigns: campaigns.length, summaries };
  });

  return ok({ job: 'process-campaigns', results });
});

export const POST = GET;
