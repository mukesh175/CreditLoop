import { createWebhookHandler } from '@/lib/shopify/webhook-handler';
import { upsertCustomerMetricFromPayload } from '@/lib/analytics/customer-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Keeps marketing-consent state current — campaigns read it before every send. */
export const POST = createWebhookHandler('customers/update', async ({ shop, payload }) => {
  await upsertCustomerMetricFromPayload({ shop, customerPayload: payload });
});
