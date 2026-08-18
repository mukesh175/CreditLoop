import { createWebhookHandler } from '@/lib/shopify/webhook-handler';
import { recordOrderAttribution } from '@/lib/analytics/attribution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Order edits can change totals or add a store-credit payment after the fact. */
export const POST = createWebhookHandler('orders/updated', async ({ shop, payload }) => {
  await recordOrderAttribution({ shop, orderPayload: payload });
});
