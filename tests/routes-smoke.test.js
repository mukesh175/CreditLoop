import test from 'node:test';
import assert from 'node:assert/strict';

// Must be set before any module reads config.
process.env.SHOPIFY_API_KEY = 'test-api-key';
process.env.SHOPIFY_API_SECRET = 'test-api-secret';
process.env.SHOPIFY_APP_URL = 'https://creditloop.test';
process.env.CRON_SECRET = 'test-cron-secret';

const prisma = (await import('./helpers/prisma-double.mjs')).default;
const { setFakeShopify } = await import('./helpers/shopify-double.mjs');
const { createFakeShopify } = await import('./helpers/fake-shopify.mjs');
const { authedRequest, makeRequest, readResponse } = await import('./helpers/request.mjs');

const SHOP_DOMAIN = 'smoke-test.myshopify.com';

/**
 * Exercises every merchant-facing route end to end against in-memory doubles.
 *
 * The point is coverage of the wiring, not of business logic: a route that
 * throws on an unset field, a bad Prisma call or a missing import fails here
 * rather than in a merchant's admin.
 */
async function seedShop() {
  const shop = await prisma.shop.create({
    data: {
      id: 'shop_smoke',
      domain: SHOP_DOMAIN,
      name: 'Smoke Test Store',
      email: 'owner@smoke.test',
      currencyCode: 'USD',
      isActive: true,
      plan: 'FREE',
      defaultBonusPercent: 10,
      defaultMaxBonus: 25,
      recommendationsEnabled: true,
      onboardingDone: true,
      scopes: 'read_orders,write_orders,read_returns,read_customers,read_store_credit_accounts,write_store_credit_account_transactions',
    },
  });

  await prisma.shopifySession.create({
    data: {
      id: `online_${SHOP_DOMAIN}_1`,
      shopId: shop.id,
      shopDomain: SHOP_DOMAIN,
      isOnline: true,
      onlineUserId: '1',
      accessToken: 'plaintext-test-token',
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  return shop;
}

const shop = await seedShop();
setFakeShopify(createFakeShopify());

const GET_ROUTES = [
  ['/api/shop', '@/app/api/shop/route.js'],
  ['/api/rules', '@/app/api/rules/route.js'],
  ['/api/campaigns', '@/app/api/campaigns/route.js'],
  ['/api/customers?page=1', '@/app/api/customers/route.js'],
  ['/api/orders?page=1', '@/app/api/orders/route.js'],
  ['/api/returns?filter=all&page=1', '@/app/api/returns/route.js'],
  ['/api/returns/opportunities?take=5', '@/app/api/returns/opportunities/route.js'],
  ['/api/credit/unused?take=10', '@/app/api/credit/unused/route.js'],
  ['/api/analytics/overview?range=30d', '@/app/api/analytics/overview/route.js'],
  ['/api/analytics/timeseries?range=30d', '@/app/api/analytics/timeseries/route.js'],
  ['/api/analytics/repeat-purchase?range=90d', '@/app/api/analytics/repeat-purchase/route.js'],
  ['/api/analytics/reconciliation', '@/app/api/analytics/reconciliation/route.js'],
  ['/api/notifications/preferences', '@/app/api/notifications/preferences/route.js'],
  ['/api/audit?page=1', '@/app/api/audit/route.js'],
  ['/api/onboarding', '@/app/api/onboarding/route.js'],
];

for (const [path, modulePath] of GET_ROUTES) {
  test(`GET ${path} responds without a server error`, async () => {
    const { GET } = await import(modulePath);
    const response = await GET(authedRequest(path, { shopDomain: SHOP_DOMAIN }));
    const { status, json } = await readResponse(response);

    assert.ok(
      status < 500,
      `${path} returned ${status}: ${JSON.stringify(json?.error || json).slice(0, 300)}`
    );
    assert.ok(json, `${path} returned a non-JSON body`);
    if (status === 200) assert.equal(json.ok, true, `${path} returned ok:false`);
  });
}

test('GET /api/health reports database and configuration', async () => {
  const { GET } = await import('@/app/api/health/route.js');
  const response = await GET(authedRequest('/api/health', { shopDomain: SHOP_DOMAIN }));
  const { status, json } = await readResponse(response);
  assert.ok(status < 500);
  assert.ok(json.checks, 'health always reports checks');
});

test('an unauthenticated request is rejected, not crashed', async () => {
  const { GET } = await import('@/app/api/shop/route.js');
  const response = await GET(makeRequest('/api/shop'));
  const { status, json } = await readResponse(response);

  assert.equal(status, 401);
  assert.equal(json.ok, false);
  assert.match(json.error.message, /session token/i);
});

test('a tampered session token is rejected', async () => {
  const { GET } = await import('@/app/api/shop/route.js');
  const response = await GET(
    makeRequest('/api/shop', { headers: { authorization: 'Bearer not.a.token' } })
  );
  const { status } = await readResponse(response);
  assert.equal(status, 401);
});

// --- Write paths -----------------------------------------------------------

test('POST /api/rules creates a rule and rejects an uncapped percentage', async () => {
  const { POST } = await import('@/app/api/rules/route.js');

  const valid = await POST(
    authedRequest('/api/rules', {
      method: 'POST',
      shopDomain: SHOP_DOMAIN,
      body: {
        name: 'Smoke Rule',
        bonusType: 'PERCENTAGE',
        bonusValue: 10,
        maxBonusAmount: 25,
        conditions: [{ field: 'refundAmount', operator: 'gte', value: 50 }],
      },
    })
  );
  const created = await readResponse(valid);
  assert.equal(created.status, 201, JSON.stringify(created.json));

  // A percentage bonus with no cap is unbounded merchant liability.
  const uncapped = await POST(
    authedRequest('/api/rules', {
      method: 'POST',
      shopDomain: SHOP_DOMAIN,
      body: { name: 'Uncapped', bonusType: 'PERCENTAGE', bonusValue: 50, conditions: [] },
    })
  );
  const rejected = await readResponse(uncapped);
  assert.equal(rejected.status, 422);
  assert.match(rejected.json.error.message, /maximum bonus/i);
});

test('POST /api/rules/test evaluates without saving', async () => {
  const { POST } = await import('@/app/api/rules/test/route.js');
  const response = await POST(
    authedRequest('/api/rules/test', {
      method: 'POST',
      shopDomain: SHOP_DOMAIN,
      body: {
        refundAmount: 100,
        customerOrderCount: 6,
        customerLifetimeValue: 850,
        draftRule: {
          name: 'Draft',
          bonusType: 'PERCENTAGE',
          bonusValue: 10,
          maxBonusAmount: 25,
          conditions: [{ field: 'refundAmount', operator: 'gte', value: 50 }],
        },
      },
    })
  );
  const { status, json } = await readResponse(response);
  assert.equal(status, 200, JSON.stringify(json));
  assert.equal(json.result.eligible, true);
  assert.equal(json.result.totalCredit, 110);
});

test('POST /api/campaigns creates a draft, never an active campaign', async () => {
  const { POST } = await import('@/app/api/campaigns/route.js');
  const response = await POST(
    authedRequest('/api/campaigns', {
      method: 'POST',
      shopDomain: SHOP_DOMAIN,
      body: { name: 'Smoke Campaign', type: 'WIN_BACK', sendsEmail: true },
    })
  );
  const { status, json } = await readResponse(response);
  assert.equal(status, 201, JSON.stringify(json));
  assert.equal(json.campaign.status, 'DRAFT', 'campaigns must not start active');
});

test('PATCH /api/notifications/preferences saves the sender name', async () => {
  const { PATCH } = await import('@/app/api/notifications/preferences/route.js');
  const response = await PATCH(
    authedRequest('/api/notifications/preferences', {
      method: 'PATCH',
      shopDomain: SHOP_DOMAIN,
      body: { emailFromName: 'Smoke Store', weeklyReport: true },
    })
  );
  const { status, json } = await readResponse(response);
  assert.equal(status, 200, JSON.stringify(json));
  assert.equal(json.preferences.emailFromName, 'Smoke Store');
});

test('PATCH /api/shop updates credit defaults', async () => {
  const { PATCH } = await import('@/app/api/shop/route.js');
  const response = await PATCH(
    authedRequest('/api/shop', {
      method: 'PATCH',
      shopDomain: SHOP_DOMAIN,
      body: { defaultBonusPercent: 15, defaultMaxBonus: 40 },
    })
  );
  const { status } = await readResponse(response);
  assert.equal(status, 200);
});

// --- Financial safety on demo records --------------------------------------

test('a refund cannot be previewed or issued against a demo order', async () => {
  const orderId = 'gid://creditloop-demo/Order/10400';

  const { POST: preview } = await import('@/app/api/refunds/preview/route.js');
  const previewed = await readResponse(
    await preview(
      authedRequest('/api/refunds/preview', {
        method: 'POST',
        shopDomain: SHOP_DOMAIN,
        body: { orderId, refundAmount: 100 },
      })
    )
  );
  assert.equal(previewed.status, 422);
  assert.match(previewed.json.error.message, /demo order/i);

  const { POST: refund } = await import('@/app/api/refunds/store-credit/route.js');
  const refunded = await readResponse(
    await refund(
      authedRequest('/api/refunds/store-credit', {
        method: 'POST',
        shopDomain: SHOP_DOMAIN,
        body: { orderId, refundAmount: 100, currencyCode: 'USD', confirmed: true },
      })
    )
  );
  assert.equal(refunded.status, 422, 'a demo order must never reach refundCreate');
  assert.match(refunded.json.error.message, /demo order/i);
});

test('store credit cannot be issued to a demo customer', async () => {
  const { POST } = await import('@/app/api/credit/issue/route.js');
  const { status, json } = await readResponse(
    await POST(
      authedRequest('/api/credit/issue', {
        method: 'POST',
        shopDomain: SHOP_DOMAIN,
        body: {
          customerId: 'gid://creditloop-demo/Customer/1000',
          amount: 50,
          currencyCode: 'USD',
          reason: 'Test',
          confirmed: true,
        },
      })
    )
  );
  assert.equal(status, 422);
  assert.match(json.error.message, /demo customer/i);
});

test('a demo customer detail loads from local data instead of Shopify', async () => {
  const customerGid = 'gid://creditloop-demo/Customer/1000';
  await prisma.customerMetric.create({
    data: {
      shopId: shop.id,
      customerGid,
      displayName: 'Demo Person',
      orderCount: 4,
      lifetimeValue: 400,
      currencyCode: 'USD',
    },
  });

  const { GET } = await import('@/app/api/customers/[id]/route.js');
  const { status, json } = await readResponse(
    await GET(
      authedRequest(`/api/customers/${encodeURIComponent(customerGid)}`, {
        shopDomain: SHOP_DOMAIN,
      }),
      { params: Promise.resolve({ id: encodeURIComponent(customerGid) }) }
    )
  );

  assert.equal(status, 200, JSON.stringify(json));
  assert.equal(json.isDemo, true, 'demo records are flagged so the UI never mislabels them');
  assert.equal(json.shopify.displayName, 'Demo Person');
});

// --- Cron protection --------------------------------------------------------

test('cron endpoints reject a missing or wrong secret', async () => {
  const { GET } = await import('@/app/api/cron/daily/route.js');

  const noSecret = await readResponse(await GET(makeRequest('/api/cron/daily')));
  assert.equal(noSecret.status, 401);

  const wrongSecret = await readResponse(
    await GET(makeRequest('/api/cron/daily', { headers: { authorization: 'Bearer nope' } }))
  );
  assert.equal(wrongSecret.status, 401);
});

test('cron endpoints run with the correct secret', async () => {
  const { GET } = await import('@/app/api/cron/daily/route.js');
  const { status, json } = await readResponse(
    await GET(
      makeRequest('/api/cron/daily', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
    )
  );
  assert.equal(status, 200, JSON.stringify(json));
  assert.equal(json.job, 'daily');
});
