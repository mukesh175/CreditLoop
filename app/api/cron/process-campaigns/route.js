import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret } from '@/lib/api/cron-auth';
import { processCampaignsTask } from '@/lib/cron/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs every ACTIVE campaign in bounded batches.
 *
 * Also runs as part of /api/cron/daily. Idempotent, so invoking both is safe.
 */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);
  return ok({ job: 'process-campaigns', results: await processCampaignsTask() });
});

export const POST = GET;
