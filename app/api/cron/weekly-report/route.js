import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret } from '@/lib/api/cron-auth';
import { weeklyReportTask } from '@/lib/cron/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Weekly merchant report.
 *
 * Called directly, this forces a run regardless of weekday; the send is still
 * deduped per ISO week, so it cannot email the same report twice. The daily
 * runner invokes the same task without `force`, so it only acts on Mondays.
 */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);
  return ok({ job: 'weekly-report', ...(await weeklyReportTask({ force: true })) });
});

export const POST = GET;
