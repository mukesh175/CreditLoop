import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.SHOPIFY_API_KEY = 'test-api-key';
process.env.SHOPIFY_API_SECRET = 'test-api-secret';

const prisma = (await import('./helpers/prisma-double.mjs')).default;
const { makeRequest, readResponse } = await import('./helpers/request.mjs');

const SHOP_DOMAIN = 'webhook-test.myshopify.com';

const shop = await prisma.shop.create({
  data: {
    id: 'shop_webhook',
    domain: SHOP_DOMAIN,
    name: 'Webhook Store',
    currencyCode: 'USD',
    isActive: true,
  },
});

/** Builds a webhook request signed the way Shopify signs one. */
function webhookRequest(path, payload, { validHmac = true, webhookId = crypto.randomUUID() } = {}) {
  const raw = JSON.stringify(payload);
  const hmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(raw, 'utf8')
    .digest('base64');

  return {
    ...makeRequest(path, {
      method: 'POST',
      headers: {
        'x-shopify-hmac-sha256': validHmac ? hmac : 'invalid-signature',
        'x-shopify-shop-domain': SHOP_DOMAIN,
        'x-shopify-webhook-id': webhookId,
      },
    }),
    // The handler reads the raw body to verify the signature over exact bytes.
    text: async () => raw,
  };
}

test('an unsigned webhook is rejected before the payload is parsed', async () => {
  const { POST } = await import('@/app/api/webhooks/orders-create/route.js');
  const response = await POST(
    webhookRequest('/api/webhooks/orders-create', { id: 1 }, { validHmac: false })
  );
  assert.equal(response.status, 401);

  const stored = await prisma.webhookEvent.findMany({ where: { shopDomain: SHOP_DOMAIN } });
  assert.equal(stored.length, 0, 'an unverified payload is never recorded');
});

test('orders/create records attribution for an order paid with store credit', async () => {
  const { POST } = await import('@/app/api/webhooks/orders-create/route.js');
  const orderGid = 'gid://shopify/Order/5001';

  const response = await POST(
    webhookRequest('/api/webhooks/orders-create', {
      id: 5001,
      admin_graphql_api_id: orderGid,
      name: '#5001',
      created_at: new Date().toISOString(),
      currency: 'USD',
      total_price: '80.00',
      customer: { admin_graphql_api_id: 'gid://shopify/Customer/9001' },
      payment_gateway_names: ['store credit', 'shopify_payments'],
      transactions: [
        { gateway: 'store credit', kind: 'sale', status: 'success', amount: '60.00', currency: 'USD' },
        { gateway: 'shopify_payments', kind: 'sale', status: 'success', amount: '20.00', currency: 'USD' },
      ],
    })
  );
  assert.equal(response.status, 200);

  const attribution = await prisma.orderAttribution.findFirst({
    where: { shopId: shop.id, orderGid },
  });
  assert.ok(attribution, 'the order was recorded');
  assert.equal(attribution.creditAmountUsed, 60, 'credit used is the store-credit portion');
  assert.equal(attribution.orderTotal, 80, 'revenue is the full order total, not the credit used');
});

test('a redelivered webhook is acknowledged without reprocessing', async () => {
  const { POST } = await import('@/app/api/webhooks/orders-create/route.js');
  const webhookId = 'delivery-abc';
  const payload = {
    id: 5002,
    admin_graphql_api_id: 'gid://shopify/Order/5002',
    name: '#5002',
    created_at: new Date().toISOString(),
    currency: 'USD',
    total_price: '40.00',
    customer: { admin_graphql_api_id: 'gid://shopify/Customer/9002' },
    payment_gateway_names: ['shopify_payments'],
    transactions: [],
  };

  await POST(webhookRequest('/api/webhooks/orders-create', payload, { webhookId }));
  const second = await POST(webhookRequest('/api/webhooks/orders-create', payload, { webhookId }));
  const body = await second.json();

  assert.equal(second.status, 200);
  assert.equal(body.duplicate, true, 'the redelivery is recognised, not reprocessed');
});

test('refunds/create records a return opportunity and issues no credit', async () => {
  const { POST } = await import('@/app/api/webhooks/refunds-create/route.js');
  const response = await POST(
    webhookRequest('/api/webhooks/refunds-create', {
      id: 7001,
      admin_graphql_api_id: 'gid://shopify/Refund/7001',
      order_id: 5001,
      transactions: [
        { kind: 'refund', status: 'success', amount: '100.00', currency: 'USD', gateway: 'shopify_payments' },
      ],
    })
  );
  assert.equal(response.status, 200);

  const returnEvent = await prisma.returnEvent.findFirst({ where: { shopId: shop.id } });
  assert.ok(returnEvent, 'the refund became a return opportunity');
  assert.equal(returnEvent.refundAmount, 100);

  // A webhook is not merchant authorisation — no credit may be issued from one.
  const creditEvents = await prisma.creditEvent.findMany({ where: { shopId: shop.id } });
  assert.equal(creditEvents.length, 0, 'a webhook must never issue store credit');
});

test('app/uninstalled stops processing and removes tokens', async () => {
  await prisma.shopifySession.create({
    data: {
      id: `offline_${SHOP_DOMAIN}`,
      shopId: shop.id,
      shopDomain: SHOP_DOMAIN,
      isOnline: false,
      accessToken: 'token',
    },
  });
  await prisma.creditCampaign.create({
    data: { id: 'camp_1', shopId: shop.id, name: 'Live', type: 'WIN_BACK', status: 'ACTIVE' },
  });

  const { POST } = await import('@/app/api/webhooks/app-uninstalled/route.js');
  const response = await POST(webhookRequest('/api/webhooks/app-uninstalled', { id: 1 }));
  assert.equal(response.status, 200);

  const sessions = await prisma.shopifySession.findMany({ where: { shopDomain: SHOP_DOMAIN } });
  assert.equal(sessions.length, 0, 'access tokens are deleted on uninstall');

  const updated = await prisma.shop.findUnique({ where: { domain: SHOP_DOMAIN } });
  assert.equal(updated.isActive, false);

  const campaign = await prisma.creditCampaign.findUnique({ where: { id: 'camp_1' } });
  assert.equal(campaign.status, 'PAUSED', 'campaigns stop sending after uninstall');
});
