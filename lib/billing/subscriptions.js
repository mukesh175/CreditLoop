import prisma from '@/lib/prisma/client';
import { adminGraphql, assertNoUserErrors } from '@/lib/shopify/graphql';
import {
  APP_SUBSCRIPTION_CANCEL_MUTATION,
  APP_SUBSCRIPTION_CREATE_MUTATION,
  CURRENT_SUBSCRIPTION_QUERY,
} from '@/lib/shopify/queries';
import { APP_URL, IS_PRODUCTION } from '@/lib/config';
import { getPlan, PLANS } from './plans';
import { ValidationError } from '@/lib/util/errors';

/** Starts a Shopify-managed recurring subscription and returns the confirmation URL. */
export async function createSubscription({ shop, session, planId }) {
  const plan = PLANS[planId];
  if (!plan || plan.id === 'FREE') {
    throw new ValidationError('Choose a paid plan to start a subscription.');
  }

  const { data } = await adminGraphql(session, APP_SUBSCRIPTION_CREATE_MUTATION, {
    name: `CreditLoop ${plan.name}`,
    returnUrl: `${APP_URL}/settings/billing?upgraded=${plan.id}`,
    trialDays: plan.trialDays,
    test: !IS_PRODUCTION,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount: plan.price.toFixed(2), currencyCode: 'USD' },
            interval: 'EVERY_30_DAYS',
          },
        },
      },
    ],
  });

  const payload = data?.appSubscriptionCreate;
  assertNoUserErrors(payload?.userErrors, 'The subscription could not be started.');

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      billingSubGid: payload.appSubscription?.id || null,
      billingStatus: payload.appSubscription?.status || 'PENDING',
    },
  });

  return { confirmationUrl: payload.confirmationUrl, subscriptionId: payload.appSubscription?.id };
}

/** Reads the live subscription from Shopify and syncs the shop's plan. */
export async function syncSubscription({ shop, session }) {
  const { data } = await adminGraphql(session, CURRENT_SUBSCRIPTION_QUERY, {});
  const active = data?.currentAppInstallation?.activeSubscriptions || [];
  const current = active.find((s) => s.status === 'ACTIVE') || active[0] || null;

  if (!current) {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { plan: 'FREE', billingStatus: 'NONE', billingSubGid: null },
    });
    return { plan: 'FREE', status: 'NONE' };
  }

  const matched =
    Object.values(PLANS).find((p) => current.name === `CreditLoop ${p.name}`) || getPlan('FREE');

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      plan: current.status === 'ACTIVE' ? matched.id : 'FREE',
      billingStatus: current.status,
      billingSubGid: current.id,
    },
  });

  return { plan: matched.id, status: current.status, currentPeriodEnd: current.currentPeriodEnd };
}

export async function cancelSubscription({ shop, session }) {
  if (!shop.billingSubGid) return { cancelled: false };
  const { data } = await adminGraphql(session, APP_SUBSCRIPTION_CANCEL_MUTATION, {
    id: shop.billingSubGid,
  });
  assertNoUserErrors(data?.appSubscriptionCancel?.userErrors, 'The subscription was not cancelled.');
  await prisma.shop.update({
    where: { id: shop.id },
    data: { plan: 'FREE', billingStatus: 'CANCELLED', billingSubGid: null },
  });
  return { cancelled: true };
}
