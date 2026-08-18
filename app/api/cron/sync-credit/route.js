import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret } from '@/lib/api/cron-auth';
import { syncCreditTask } from '@/lib/cron/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Refreshes cached Shopify balances and customer metrics.
 *
 * Also runs as part of /api/cron/daily. Idempotent, so invoking both is safe.
 */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);
  return ok({ job: 'sync-credit', results: await syncCreditTask() });
});

export const POST = GET;
