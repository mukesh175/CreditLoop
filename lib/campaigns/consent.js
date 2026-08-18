import { adminGraphql } from '@/lib/shopify/graphql';

/**
 * Consent gate for every customer-facing marketing email.
 *
 * Holding store credit is NOT consent to be marketed to. A campaign email is
 * only sent when all of these hold:
 *   1. the merchant enabled the campaign,
 *   2. the campaign is ACTIVE,
 *   3. the customer's Shopify marketing state is subscribed,
 *   4. we actually have an address to send to.
 */
const CUSTOMER_CONSENT_QUERY = `#graphql
  query CreditLoopCustomerConsent($id: ID!) {
    customer(id: $id) {
      id
      email
      displayName
      emailMarketingConsent { marketingState marketingOptInLevel consentUpdatedAt }
    }
  }
`;

const SUBSCRIBED_STATES = new Set(['SUBSCRIBED']);

/**
 * Fetches contact details at send time. The address is returned for immediate
 * use and must not be persisted (we store only a hash in NotificationLog).
 */
export async function getCustomerContact(session, customerGid) {
  const { data } = await adminGraphql(session, CUSTOMER_CONSENT_QUERY, { id: customerGid });
  const customer = data?.customer;
  if (!customer) return null;
  return {
    customerGid: customer.id,
    email: customer.email || null,
    displayName: customer.displayName || null,
    marketingState: customer.emailMarketingConsent?.marketingState || 'NOT_SUBSCRIBED',
  };
}

export function hasMarketingConsent(contact) {
  return Boolean(contact?.email) && SUBSCRIBED_STATES.has(contact.marketingState);
}

/** Returns { allowed, reason } so the skip reason is recorded on the recipient. */
export function checkCampaignEligibility({ campaign, contact, entitlements }) {
  if (campaign.status !== 'ACTIVE') return { allowed: false, reason: 'CAMPAIGN_NOT_ACTIVE' };
  if (!entitlements.customerEmails && campaign.sendsEmail) {
    return { allowed: false, reason: 'PLAN_DOES_NOT_INCLUDE_CUSTOMER_EMAILS' };
  }
  if (!contact) return { allowed: false, reason: 'CUSTOMER_NOT_FOUND' };
  if (!contact.email) return { allowed: false, reason: 'NO_EMAIL_ADDRESS' };
  if (campaign.requiresMarketingConsent && !hasMarketingConsent(contact)) {
    return { allowed: false, reason: 'NO_MARKETING_CONSENT' };
  }
  return { allowed: true, reason: null };
}
