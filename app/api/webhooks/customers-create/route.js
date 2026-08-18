import { createWebhookHandler } from '@/lib/shopify/webhook-handler';
import { upsertCustomerMetricFromPayload } from '@/lib/analytics/customer-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createWebhookHandler('customers/create', async ({ shop, payload }) => {
  await upsertCustomerMetricFromPayload({ shop, customerPayload: payload });
});
