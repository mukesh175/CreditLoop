import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireCronSecret } from '@/lib/api/cron-auth';
import {
  syncCreditTask,
  dailyMetricsTask,
  processCampaignsTask,
  reconcileTask,
  weeklyReportTask,
} from '@/lib/cron/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Leaves room to finish and respond before the platform kills the invocation. */
const TIME_BUDGET_MS = 50_000;

/**
 * Consolidated daily maintenance.
 *
 * Vercel's Hobby plan fires each cron at most once per day, so everything
 * CreditLoop needs to do on a schedule runs here in one invocation. On Pro you
 * can schedule the individual endpoints more frequently instead — see
 * `vercel.json` and the README.
 *
 * Tasks run in priority order under a shared time budget. If the budget runs
 * out, the remaining tasks are reported as deferred rather than half-executed;
 * every task is idempotent, so the next day's run picks them up cleanly.
 */
const TASKS = [
  // Fresh balances first — everything below reads what this writes.
  { name: 'sync-credit', run: () => syncCreditTask() },
  { name: 'daily-metrics', run: () => dailyMetricsTask() },
  { name: 'process-campaigns', run: () => processCampaignsTask() },
  { name: 'reconcile', run: () => reconcileTask() },
  // Self-skips on non-Mondays and dedupes per week.
  { name: 'weekly-report', run: () => weeklyReportTask() },
];

export const GET = withErrorHandling(async (request) => {
  requireCronSecret(request);

  const startedAt = Date.now();
  const completed = [];
  const deferred = [];
  const failed = [];

  for (const task of TASKS) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      deferred.push(task.name);
      continue;
    }
    try {
      const result = await task.run();
      completed.push({ task: task.name, result });
    } catch (error) {
      // One failing task must not stop the rest of the day's maintenance.
      // eslint-disable-next-line no-console
      console.error('[creditloop] daily task failed', task.name, error?.message);
      failed.push({ task: task.name, error: String(error?.message || error) });
    }
  }

  return ok({
    job: 'daily',
    durationMs: Date.now() - startedAt,
    completed,
    failed,
    deferred,
  });
});

export const POST = GET;
