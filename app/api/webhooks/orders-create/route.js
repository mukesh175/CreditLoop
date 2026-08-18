import { createWebhookHandler } from '@/lib/shopify/webhook-handler';
import { recordOrderAttribution } from '@/lib/analytics/attribution';
import { updateCustomerMetricsFromOrder } from '@/lib/analytics/customer-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Detects store-credit usage on new orders and builds the attribution record.
 * This is the "customer spent their credit" half of the CreditLoop loop.
 */
export const POST = createWebhookHandler('orders/create', async ({ shop, payload }) => {
  await recordOrderAttribution({ shop, orderPayload: payload });
  await updateCustomerMetricsFromOrder({ shop, orderPayload: payload });
});
