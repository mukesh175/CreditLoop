/** Shopify App Pricing plan definitions. Billing runs through Shopify, never an external processor. */
export const PLANS = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    price: 0,
    trialDays: 0,
    maxCreditOffers: 25,
    features: ['25 credit offers / month', 'Store credit dashboard', 'Basic analytics'],
    automatedCampaigns: false,
    customerEmails: false,
    advancedSegmentation: false,
    multiStore: false,
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth',
    price: 19,
    trialDays: 14,
    maxCreditOffers: 250,
    features: [
      '250 credit offers / month',
      'Automated campaigns',
      'Customer credit reminders',
      'Advanced analytics',
    ],
    automatedCampaigns: true,
    customerEmails: true,
    advancedSegmentation: false,
    multiStore: false,
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    price: 49,
    trialDays: 14,
    maxCreditOffers: 1000,
    features: [
      '1,000 credit offers / month',
      'Advanced segmentation',
      'Advanced reports',
      'Multiple campaign rules',
    ],
    automatedCampaigns: true,
    customerEmails: true,
    advancedSegmentation: true,
    multiStore: false,
  },
  SCALE: {
    id: 'SCALE',
    name: 'Scale',
    price: 99,
    trialDays: 14,
    maxCreditOffers: Infinity,
    features: ['Unlimited credit offers', 'Multiple stores', 'Agency features', 'Priority support'],
    automatedCampaigns: true,
    customerEmails: true,
    advancedSegmentation: true,
    multiStore: true,
  },
};

export const PLAN_ORDER = ['FREE', 'GROWTH', 'PRO', 'SCALE'];

export function getPlan(planId) {
  return PLANS[planId] || PLANS.FREE;
}
