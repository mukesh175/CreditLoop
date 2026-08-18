import { APP_URL } from '@/lib/config';
import { adminGraphql } from './graphql';
import {
  WEBHOOK_SUBSCRIPTION_CREATE_MUTATION,
  WEBHOOK_SUBSCRIPTIONS_QUERY,
} from './queries';

/**
 * Webhook topics CreditLoop subscribes to.
 *
 * Only topics Shopify actually publishes are listed here. Where Shopify has no
 * suitable topic for something we need (store-credit balance changes made
 * outside the app, for instance), we rely on scheduled sync + reconciliation
 * rather than inventing a topic.
 *
 * The mandatory compliance topics (customers/data_request, customers/redact,
 * shop/redact) are declared in shopify.app.toml, as Shopify requires.
 */
export const WEBHOOK_TOPICS = [
  { topic: 'ORDERS_CREATE', path: '/api/webhooks/orders-create' },
  { topic: 'ORDERS_UPDATED', path: '/api/webhooks/orders-updated' },
  { topic: 'REFUNDS_CREATE', path: '/api/webhooks/refunds-create' },
  { topic: 'CUSTOMERS_CREATE', path: '/api/webhooks/customers-create' },
  { topic: 'CUSTOMERS_UPDATE', path: '/api/webhooks/customers-update' },
  { topic: 'APP_UNINSTALLED', path: '/api/webhooks/app-uninstalled' },
];

/**
 * Distinguishes "you have not been approved yet" from a genuine failure.
 *
 * The orders/* and customers/* topics carry protected customer data. Until the
 * app is approved for it in the Partner dashboard, Shopify rejects the
 * subscription — that is an account state to surface to the merchant, not a bug
 * to retry.
 */
function classifyFailure(messages) {
  const text = messages.join(' ').toLowerCase();
  return text.includes('protected customer data') || text.includes('not approved')
    ? 'NEEDS_PROTECTED_DATA_APPROVAL'
    : 'FAILED';
}

export async function registerWebhooks({ session }) {
  const existing = await adminGraphql(session, WEBHOOK_SUBSCRIPTIONS_QUERY, {}).catch(() => null);
  const registered = new Set(
    (existing?.data?.webhookSubscriptions?.nodes || []).map(
      (n) => `${n.topic}:${n.endpoint?.callbackUrl}`
    )
  );

  const results = [];
  for (const { topic, path } of WEBHOOK_TOPICS) {
    const callbackUrl = `${APP_URL}${path}`;
    if (registered.has(`${topic}:${callbackUrl}`)) {
      results.push({ topic, status: 'ALREADY_REGISTERED' });
      continue;
    }
    try {
      const { data } = await adminGraphql(session, WEBHOOK_SUBSCRIPTION_CREATE_MUTATION, {
        topic,
        webhookSubscription: { callbackUrl, format: 'JSON' },
      });
      const errors = data?.webhookSubscriptionCreate?.userErrors || [];
      results.push({
        topic,
        status: errors.length ? classifyFailure(errors.map((e) => e.message)) : 'REGISTERED',
        errors,
      });
    } catch (error) {
      const message = String(error?.message || error);
      results.push({ topic, status: classifyFailure([message]), errors: [message] });
    }
  }
  const needsApproval = results.filter((r) => r.status === 'NEEDS_PROTECTED_DATA_APPROVAL');
  if (needsApproval.length) {
    // eslint-disable-next-line no-console
    console.warn(
      '[creditloop] webhook topics awaiting protected customer data approval:',
      needsApproval.map((r) => r.topic).join(', '),
      '— request access under Partner dashboard > App setup > Protected customer data access.'
    );
  }

  return results;
}
