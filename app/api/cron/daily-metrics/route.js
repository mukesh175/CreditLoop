import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret } from '@/lib/api/cron-auth';
import { dailyMetricsTask } from '@/lib/cron/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Snapshots yesterday's metrics per currency.
 *
 * Also runs as part of /api/cron/daily. Upserts make re-runs harmless.
 */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);
  return ok({ job: 'daily-metrics', ...(await dailyMetricsTask()) });
});

export const POST = GET;
