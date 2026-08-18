import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret } from '@/lib/api/cron-auth';
import { reconcileTask } from '@/lib/cron/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Compares Shopify balances against CreditLoop's ledger and reports differences. Never writes to Shopify.
 *
 * Also runs as part of /api/cron/daily. Idempotent, so invoking both is safe.
 */
export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);
  return ok({ job: 'reconcile', results: await reconcileTask() });
});

export const POST = GET;
