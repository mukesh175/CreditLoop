import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCampaignEligibility, hasMarketingConsent } from '../lib/campaigns/consent.js';

const entitlements = { customerEmails: true, automatedCampaigns: true };
const activeCampaign = {
  id: 'c1',
  status: 'ACTIVE',
  sendsEmail: true,
  requiresMarketingConsent: true,
};

const subscribed = {
  customerGid: 'gid://shopify/Customer/1',
  email: 'customer@example.com',
  marketingState: 'SUBSCRIBED',
};

test('an eligible, consenting customer receives the campaign', () => {
  const result = checkCampaignEligibility({
    campaign: activeCampaign,
    contact: subscribed,
    entitlements,
  });
  assert.equal(result.allowed, true);
});

test('a customer without marketing consent is skipped', () => {
  const result = checkCampaignEligibility({
    campaign: activeCampaign,
    contact: { ...subscribed, marketingState: 'NOT_SUBSCRIBED' },
    entitlements,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'NO_MARKETING_CONSENT');
});

test('holding store credit is not consent', () => {
  // A customer with a balance but no subscription must never be emailed.
  assert.equal(hasMarketingConsent({ email: 'a@b.com', marketingState: 'NOT_SUBSCRIBED' }), false);
  assert.equal(hasMarketingConsent({ email: 'a@b.com', marketingState: 'SUBSCRIBED' }), true);
});

test('a customer with no email address is skipped', () => {
  const result = checkCampaignEligibility({
    campaign: activeCampaign,
    contact: { ...subscribed, email: null },
    entitlements,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'NO_EMAIL_ADDRESS');
});

test('a draft or paused campaign never sends', () => {
  for (const status of ['DRAFT', 'PAUSED', 'COMPLETED']) {
    const result = checkCampaignEligibility({
      campaign: { ...activeCampaign, status },
      contact: subscribed,
      entitlements,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'CAMPAIGN_NOT_ACTIVE');
  }
});

test('customer emails are gated by the plan', () => {
  const result = checkCampaignEligibility({
    campaign: activeCampaign,
    contact: subscribed,
    entitlements: { ...entitlements, customerEmails: false },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'PLAN_DOES_NOT_INCLUDE_CUSTOMER_EMAILS');
});

test('a missing customer is skipped rather than assumed eligible', () => {
  const result = checkCampaignEligibility({ campaign: activeCampaign, contact: null, entitlements });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'CUSTOMER_NOT_FOUND');
});
