/**
 * Central runtime configuration.
 *
 * The Shopify API version is intentionally configurable — never hard-code an
 * obsolete version. Verify the value against the current stable release before
 * each deployment (see README → "Shopify API version").
 */
export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-10';

export const APP_URL = (process.env.SHOPIFY_APP_URL || '').replace(/\/$/, '');
export const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
export const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

/**
 * Minimum scopes for the implemented feature set. Each is justified in
 * docs/scopes.md and surfaced to the merchant in Settings → General.
 */
export const SHOPIFY_SCOPES = (
  process.env.SHOPIFY_SCOPES ||
  [
    'read_orders',
    'write_orders',
    'read_returns',
    'read_customers',
    'read_store_credit_accounts',
    'write_store_credit_account_transactions',
  ].join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const CRON_SECRET = process.env.CRON_SECRET || '';
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Demo mode requires an explicit deployment-level opt-in.
 *
 * It is not tied to NODE_ENV, because a development store on a hosted
 * deployment is exactly where you need to exercise the UI. It stays off unless
 * the operator sets CREDITLOOP_DEMO_MODE=true, every demo row is tagged and
 * removable in one action, and the dashboard shows a banner throughout.
 *
 * Never enable this on a deployment serving live merchants.
 */
export const DEMO_MODE_ALLOWED = process.env.CREDITLOOP_DEMO_MODE === 'true';

export const BRAND = {
  name: 'CreditLoop',
  tagline: 'Turn refunds into repeat purchases.',
};
