# CreditLoop

**Turn refunds into repeat purchases.**

CreditLoop is a public Shopify app that helps merchants offer store credit as an
attractive alternative to refunding the original payment method — and then
measures what that credit actually turns into.

```
RETURN → CREDIT OFFER → STORE CREDIT → CUSTOMER REMINDER → REPEAT PURCHASE → REVENUE
```

It is not a wallet. CreditLoop holds no customer money: every balance lives in
Shopify's native Store Credit, and stays there whether or not the app is
installed.

---

## Table of contents

1. [Product overview](#1-product-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Shopify Partner setup](#4-shopify-partner-setup)
5. [Shopify CLI setup](#5-shopify-cli-setup)
6. [Neon setup](#6-neon-setup)
7. [Prisma setup](#7-prisma-setup)
8. [Environment variables](#8-environment-variables)
9. [Local development](#9-local-development)
10. [Shopify OAuth](#10-shopify-oauth)
11. [Webhooks](#11-webhooks)
12. [Customer Account UI extension](#12-customer-account-ui-extension)
13. [Store Credit API](#13-store-credit-api)
14. [Refund flow](#14-refund-flow)
15. [Resend](#15-resend)
16. [Vercel deployment](#16-vercel-deployment)
17. [Vercel Cron](#17-vercel-cron)
18. [Shopify App Pricing](#18-shopify-app-pricing)
19. [App Store submission](#19-app-store-submission)
20. [GDPR compliance](#20-gdpr-compliance)
21. [Troubleshooting](#21-troubleshooting)

---

## 1. Product overview

CreditLoop answers three questions for a merchant:

1. How much store credit do I have outstanding?
2. How much of that credit is turning into orders?
3. What can I do to turn more returns into repeat purchases?

### Feature set

| Area | What it does |
| --- | --- |
| **Return → Credit** | Surfaces returns eligible for a store-credit offer, with a recommended amount and the reasoning behind it. |
| **Credit rules** | A transparent rules engine deciding bonus credit by refund size, order count, lifetime value and more. Rules can be tested before saving. |
| **Refund workflow** | Refunds an order to native Shopify store credit, optionally with a merchant-funded bonus, always behind an explicit confirmation. |
| **Credit analytics** | Issued, redeemed, outstanding, redemption rate, revenue from orders using credit. |
| **Unused credit** | Ageing buckets (30/60/90 days) and the customers behind them. |
| **Attribution** | Links issued credit to the orders where it was later spent, FIFO. |
| **Repeat purchase analytics** | Observed comparison between credit users and non-credit customers. |
| **Campaigns** | Return Credit, Win-back and VIP campaigns, gated on marketing consent. |
| **Customer account** | A native store-credit balance and history block in the customer account. |
| **Billing** | Shopify App Pricing with server-enforced entitlements. |
| **Reconciliation** | Compares Shopify balances against CreditLoop's ledger and reports differences. |

### What CreditLoop deliberately does not do

- It does not hold customer money or create a parallel wallet.
- It does not automatically convert refunds to store credit. A human confirms
  every refund.
- It does not claim to have *caused* revenue. It reports "revenue from orders
  that used store credit" — an observed association.
- It does not enable credit expiration by default, and it does not claim
  expiration is lawful everywhere.
- It does not make itself hard to leave. Uninstalling stops processing and
  removes our tokens; customer balances in Shopify are untouched.

---

## 2. Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full picture. The
essential rule:

> **Shopify's native Store Credit balance is the only source of truth for
> customer money.** Neon stores analytics, configuration and audit records.

Never compute a balance from CreditLoop's own tables. `CreditEvent` is an audit
ledger, not an account.

**Stack:** Next.js (App Router, JavaScript/JSX), React, Bootstrap 5, Prisma,
Neon PostgreSQL, Shopify Admin GraphQL API, Shopify App Bridge, Customer Account
UI extensions, Resend, Vercel + Vercel Cron.

---

## 3. Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- A [Shopify Partner account](https://partners.shopify.com)
- A development store **with the new customer accounts experience enabled**
  (required by the Customer Account UI extension)
- A [Neon](https://neon.tech) PostgreSQL database
- A [Resend](https://resend.com) account (optional — the app runs without it and
  simply records emails as skipped)
- A [Vercel](https://vercel.com) account for deployment

```bash
node --version   # v20.0.0 or later
npm --version    # 10.0.0 or later
```

---

## 4. Shopify Partner setup

1. Go to **Partners → Apps → Create app → Create app manually**.
2. Name it `CreditLoop`.
3. Copy the **Client ID** and **Client secret** into your `.env`.
4. Under **App setup → Distribution**, choose **Public distribution** (required
   for App Store listing and for the mandatory compliance webhooks).
5. Under **App setup → Protected customer data access**, request access to
   customer data and complete the data-use questionnaire. CreditLoop needs:
   - **Customer name** — shown to the merchant in the dashboard.
   - **Customer email** — used only at send time for campaign emails; not stored.

   Declare the retention and purpose honestly: CreditLoop stores Shopify
   customer IDs plus aggregate metrics, and does not persist email addresses.

---

## 5. Shopify CLI setup

```bash
npm install -g @shopify/cli@latest

# From the project root, link this code to your Partner app:
shopify app config link

# Start a development session (tunnels your local server to Shopify):
shopify app dev
```

`shopify app config link` rewrites `client_id` and the URLs in
`shopify.app.toml`. Review the file afterwards — the committed version contains
placeholders.

To deploy app configuration and extensions:

```bash
shopify app deploy
```

---

## 6. Neon setup

1. Create a project at [neon.tech](https://neon.tech).
2. Create a database named `creditloop`.
3. Copy **both** connection strings from the Neon dashboard:
   - the **pooled** string → `DATABASE_URL` (used at runtime; serverless
     functions need the pooler)
   - the **direct** string → `DIRECT_DATABASE_URL` (used by Prisma Migrate,
     which cannot run through the pooler)

Both must include `?sslmode=require`.

---

## 7. Prisma setup

```bash
npm install

# Create the schema in your database:
npx prisma migrate dev --name init

# Regenerate the client after any schema change:
npx prisma generate

# Inspect data:
npx prisma studio
```

For production, migrations run automatically as part of the build:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

This guarantees the deployed schema always matches the deployed code — the
alternative is a build that succeeds while every query fails against tables
that do not exist yet. It means `DATABASE_URL` and `DIRECT_DATABASE_URL` must be
available at build time, and a failing migration fails the deploy rather than
shipping a broken app.

To apply migrations by hand instead:

```bash
npx prisma migrate deploy
```

### Seeding demo data (development only)

```bash
npm run seed:demo -- your-store.myshopify.com
```

This creates 250 customers, 500 orders, 40 returns and 120 credit transactions
under a `gid://creditloop-demo/…` prefix. The dashboard displays a demo banner,
and `POST /api/demo {"action":"clear"}` removes every demo row and nothing else.
Demo mode refuses to run when `NODE_ENV=production`.

---

## 8. Environment variables

Copy `.env.example` to `.env` and fill it in:

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Neon connection used at runtime |
| `DIRECT_DATABASE_URL` | yes | Direct Neon connection for migrations |
| `SHOPIFY_API_KEY` | yes | Partner app client ID |
| `SHOPIFY_API_SECRET` | yes | Partner app client secret — signs session tokens and verifies webhook HMACs |
| `SHOPIFY_APP_URL` | yes | Public HTTPS URL of the app |
| `SHOPIFY_SCOPES` | yes | Comma-separated scopes (see `docs/scopes.md`) |
| `SHOPIFY_API_VERSION` | no | Admin API version. Defaults to `2025-10`; **verify against the current stable release before deploying** |
| `RESEND_API_KEY` | no | Email delivery. Without it, emails are logged as skipped |
| `RESEND_FROM_EMAIL` | no | Verified sender address |
| `CRON_SECRET` | yes | Shared secret protecting `/api/cron/*`. `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | recommended | 32-byte key encrypting Shopify access tokens at rest. `openssl rand -hex 32` |
| `CREDITLOOP_DEMO_MODE` | no | Set to `true` in development to enable the demo generator |

Never commit a real `.env`.

### Shopify API version

`SHOPIFY_API_VERSION` is configurable precisely so it is never stuck on an
obsolete release. Before each production deploy:

1. Check the [current stable version](https://shopify.dev/docs/api/usage/versioning).
2. Update `SHOPIFY_API_VERSION` and the `api_version` fields in
   `shopify.app.toml` and `extensions/customer-credit/shopify.extension.toml`.
3. Re-verify every mutation and field used in `lib/shopify/queries.js` against
   the documentation for that version — particularly `storeCreditAccountCredit`,
   `storeCreditAccountDebit` and `RefundInput.refundMethods.storeCreditRefund`.
4. Run the test suite and exercise a refund on a development store.

---

## 9. Local development

```bash
npm install
npx prisma migrate dev
npm run dev          # Next.js on http://localhost:3000

# In a second terminal, tunnel to Shopify:
shopify app dev
```

Install the app on your development store from the URL the CLI prints. The
embedded admin loads inside the Shopify Admin iframe; opening `localhost:3000`
directly will not have an App Bridge session token and API calls will 401 — this
is expected.

### Running the tests

```bash
npm test
```

See [`docs/testing.md`](docs/testing.md) for the full test plan — automated
tests, demo data for exercising every screen, and the real Shopify flows
(including the duplicate-credit test) that only a development store can cover.

The suite runs on `node --test` with no live database or store: `tests/alias-hook.mjs`
resolves the `@/` alias and swaps in an in-memory Prisma and Shopify double, so
the real financial code paths execute end to end. See
[§19](#19-app-store-submission) for the two critical financial tests.

---

## 10. Installation and authentication

### Managed installation (default)

New Shopify apps use **managed installation**: Shopify performs the install
itself and never sends the merchant through the app's OAuth route. There is no
authorization code to exchange.

Instead, the first authenticated embedded request exchanges the App Bridge
session token for an Admin API access token
(`lib/shopify/token-exchange.js`), and `ensureShopInstalled`
(`lib/shopify/install.js`) completes setup: it stores the encrypted offline
token, syncs shop identity, registers webhooks, seeds the draft credit rules
and creates notification preferences.

This means merchants never see an install screen from CreditLoop — the app
simply works the first time they open it. An app implementing only the legacy
OAuth routes will report "this store is not installed" forever under managed
installation, because those routes are never called.

### Legacy OAuth (opt-in)

Still supported for apps configured with `use_legacy_install_flow`, and usable
by visiting `/api/auth/login?shop=…` directly.

| Route | Purpose |
| --- | --- |
| `GET /api/auth/login?shop=…` | Starts OAuth. Validates the shop domain, sets a signed state cookie |
| `GET /api/auth/callback` | Verifies HMAC and state, exchanges the code, stores an encrypted offline token, registers webhooks, seeds default rules, redirects to onboarding |

Security properties:

- The shop domain is validated against `^[a-z0-9-]+\.myshopify\.com$` before use.
- The OAuth `state` is compared with a timing-safe comparison against an
  HttpOnly cookie.
- Query HMAC is verified on the callback.
- Access tokens are AES-256-GCM encrypted before being written to Neon and are
  never returned by any API route.

Every embedded request afterwards authenticates with an **App Bridge session
token** (JWT, HS256). `lib/shopify/auth-guard.js` verifies the signature,
expiry and audience, and derives the shop from the `dest` claim. A `shopId` in a
request body is never trusted.

---

## 11. Webhooks

Registered automatically after OAuth and declared in `shopify.app.toml`:

| Topic | Handler | What it does |
| --- | --- | --- |
| `orders/create` | `/api/webhooks/orders-create` | Detects store-credit usage, builds order attribution |
| `orders/updated` | `/api/webhooks/orders-updated` | Re-evaluates attribution after order edits |
| `refunds/create` | `/api/webhooks/refunds-create` | Records a return opportunity — **never** issues credit |
| `customers/create` | `/api/webhooks/customers-create` | Seeds customer metrics |
| `customers/update` | `/api/webhooks/customers-update` | Keeps marketing consent current |
| `app/uninstalled` | `/api/webhooks/app-uninstalled` | Stops processing, pauses campaigns, deletes tokens |

The three GDPR endpoints are **not** webhook topic subscriptions. They are
declared under `[webhooks.privacy_compliance]` in `shopify.app.toml` as full
URLs — listing them as `topics` makes Shopify reject the version with "The
following topic is invalid":

| Field | Handler |
| --- | --- |
| `customer_data_request_url` | `/api/webhooks/customers-data-request` |
| `customer_deletion_url` | `/api/webhooks/customers-redact` |
| `shop_deletion_url` | `/api/webhooks/shop-redact` |

### Protected customer data approval

The `orders/*`, `refunds/create` and `customers/*` topics carry protected
customer data. Shopify refuses to create an app version that **declares** them
before the app is approved:

> This app is not approved to subscribe to webhook topics containing protected
> customer data.

So `shopify.app.toml` declares only `app/uninstalled`. CreditLoop registers the
rest **at runtime** — from the OAuth callback and the onboarding sync
(`lib/shopify/webhooks.js`) — which keeps `shopify app deploy` working before
approval comes through.

Until access is granted those registrations are rejected, and the app reports
that plainly instead of failing silently: the onboarding sync shows which topics
are waiting, and the registration result marks them
`NEEDS_PROTECTED_DATA_APPROVAL`. Everything else works; those topics simply stay
dormant.

**To grant access:** Partner dashboard → your app → **App setup → Protected
customer data access**. Request *Protected customer data*, plus the **Name** and
**Email** fields, and complete the data-use questionnaire. Then reinstall the
app (or re-run the onboarding sync) so registration retries — no redeploy
needed.

Once approved you may move the topics back into `shopify.app.toml` if you prefer
declarative webhooks. The runtime registration is idempotent and skips any topic
Shopify already has.

Every handler, via `lib/shopify/webhook-handler.js`:

- verifies the HMAC against the **raw body** before parsing anything,
- deduplicates on `X-Shopify-Webhook-Id` so redeliveries are idempotent,
- returns quickly and records the outcome in `WebhookEvent`,
- stops requesting retries after five failed attempts, so one poisoned payload
  cannot loop forever.

There is no webhook topic for store-credit balance changes made outside the app.
That gap is covered by scheduled sync (`/api/cron/sync-credit`) and
reconciliation (`/api/cron/reconcile`) rather than by inventing a topic.

---

## 12. Customer Account UI extension

> **Currently parked in `extensions-pending-approval/`.** Both extensions call
> the CreditLoop backend, which requires the `network_access` capability, and
> Shopify refuses to *release* an app version containing an extension whose
> network access is not yet approved. Because an unreleased version never
> applies app configuration — including the App URL — leaving them in place
> blocks the entire app, not just the extensions. See
> `extensions-pending-approval/README.md` for how to re-enable them once
> approval lands. The code itself is complete and unmodified.


Two extensions, because Shopify does not allow `customer-account.page.render`
to share an extension with any other target:

| Directory | Target | What the customer sees |
| --- | --- | --- |
| `extensions/customer-credit` | `customer-account.order-index.block.render` | A compact balance card on the order index |
| `extensions/customer-credit-page` | `customer-account.page.render` | A full credit-history page |

It is built on the current extension model: **Preact plus Shopify's `s-*` web
components**, from `@shopify/ui-extensions` at API version `2026-07`. The older
`@shopify/ui-extensions-react` wrapper is not used — that package stopped
publishing version tags after `2025-07`, while `@shopify/ui-extensions` tracks
current API versions.

Extension dependencies install from the repo root via npm workspaces
(`"workspaces": ["extensions/*"]` in the root `package.json`), so a plain
`npm install` is enough before `shopify app deploy`. Installing only the root
package without the workspace entry is what causes
`Could not resolve "@shopify/ui-extensions/..."` at bundle time.

```bash
npm install          # installs root + extension dependencies
shopify app deploy   # builds and deploys the extension
```

The extension requires the **new customer accounts** experience. It reads from
`GET /api/customer-account/credit`, authenticating with the customer's session
token — the customer id comes from the verified token, never from the request,
so one customer cannot read another's balance.

The extension is branded as the merchant's store credit, not as CreditLoop. The
customer is dealing with the store they bought from.

### Verifying the bundle without deploying

```bash
npx esbuild extensions/customer-credit/src/CreditBlock.jsx \
  --bundle --format=esm --jsx=automatic --jsx-import-source=preact \
  --outdir=/tmp/creditloop-bundle-check
```

## 13. Store Credit API

All balance operations live in `lib/credit/store-credit.js`.

| Operation | Shopify mutation/query |
| --- | --- |
| Read balance & transactions | `customer.storeCreditAccounts` / `storeCreditAccount` |
| Issue credit | `storeCreditAccountCredit` |
| Debit credit | `storeCreditAccountDebit` |

```js
await issueStoreCredit({
  shop, session,
  customerGid: 'gid://shopify/Customer/123',
  amount: 110,
  currencyCode: 'USD',
  reason: 'Return Credit Rule',
  expiresAt: null,
  campaignId: null,
  idempotencyKey: 'refund:<hash>',   // required
});
```

Rules enforced by the service:

- An idempotency key is **required**. There is no path to issue credit without one.
- Amounts must be positive; currencies must match the target account.
- The mutation is never auto-retried. If Shopify errors, the caller surfaces
  "verify before retrying" rather than risking duplicate credit.
- Debits are not exposed as a free-form merchant action — `storeCreditAccountDebit`
  is only reachable from workflows that require it, and every call is audited.

---

## 14. Refund flow

```
Merchant opens Returns
      ↓
CreditLoop calculates a recommendation (rules engine)
      ↓
Merchant reviews: refund $100 · bonus +$10 · total credit $110 · customer · order · currency
      ↓
Merchant confirms
      ↓
Shopify refundCreate  (refundMethods → storeCreditRefund)
      ↓
Optional merchant-funded bonus via storeCreditAccountCredit
      ↓
Native Shopify store credit: $110
```

Two distinct movements of money, kept separate at every layer:

1. **The refund** — the customer's own money, returned as store credit.
2. **The bonus** — the merchant's money, a promotional incentive. Disclosed
   explicitly in the confirmation dialog and stored as `bonusAmount`.

Money never moves silently. `POST /api/refunds/store-credit` rejects any request
without `confirmed: true`, and the UI keeps the submit button disabled until
Shopify has confirmed the refundable amount.

---

## 15. Resend

Templates live in `lib/email/`:

| File | Subject |
| --- | --- |
| `credit-issued.js` | Your store credit is ready |
| `credit-reminder.js` | You have store credit waiting for you |
| `credit-expiring.js` | Your store credit expires soon |
| `win-back.js` | Your store credit is waiting |
| `weekly-report.js` | CreditLoop weekly report (merchant) |

### Sender identity

Customer emails are sent on behalf of the merchant's store:

| Header | Value |
| --- | --- |
| `From` display name | The merchant's brand — **Settings → Notifications → Sender name**, defaulting to the store's name |
| `From` address | `RESEND_FROM_EMAIL`, on your verified sending domain |
| `Reply-To` | The store's own email, so replies reach the merchant |

CreditLoop does not put itself in front of anyone: the brand name is used for
customer campaigns *and* for merchant reports. The literal string "CreditLoop"
appears only as a last-resort fallback when a store has no name at all.

The address itself cannot be the merchant's own email. Providers only accept
mail from a domain you have verified, and putting a merchant's address in `From`
is spoofing — SPF/DKIM/DMARC would reject it or route it to spam. To send from a
merchant's real domain, verify that domain with Resend and point
`RESEND_FROM_EMAIL` at it for that deployment.

### Test emails

**Settings → Notifications → Send a test email** sends any template to the
merchant's own address with sample figures, so they can check the sender name,
reply-to and wording before enabling a campaign. It is always addressed to the
merchant — there is no path that mails a real customer from this button.

Every send is recorded in `NotificationLog` with `messageId`, `status`, `sentAt`,
`error` and a **hash** of the recipient. CreditLoop does not keep a permanent
copy of customer email addresses — they are fetched from Shopify at send time
and discarded.

A customer email is sent only when all of these hold:

1. the merchant enabled the campaign,
2. the campaign is `ACTIVE`,
3. the customer's Shopify marketing state is `SUBSCRIBED`,
4. an address is available.

**Holding store credit is not consent to be marketed to.**

---

## 16. Vercel deployment

```bash
npm install -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add DIRECT_DATABASE_URL production
vercel env add SHOPIFY_API_KEY production
vercel env add SHOPIFY_API_SECRET production
vercel env add SHOPIFY_APP_URL production
vercel env add SHOPIFY_SCOPES production
vercel env add CRON_SECRET production
vercel env add ENCRYPTION_KEY production
vercel env add RESEND_API_KEY production
vercel env add RESEND_FROM_EMAIL production
vercel --prod
```

Then run migrations against production and update your Partner app URLs:

```bash
DATABASE_URL=… DIRECT_DATABASE_URL=… npx prisma migrate deploy
```

- **App URL:** `https://your-app.vercel.app`
- **Redirect URL:** `https://your-app.vercel.app/api/auth/callback`

The app assumes a serverless runtime throughout: no long-running processes, no
in-memory queues, a pooled database connection and batched cron work.

---

## 17. Vercel Cron

**Vercel's Hobby plan allows each cron job to fire at most once per day (and at
most two jobs per project).** The shipped `vercel.json` therefore schedules a
single consolidated endpoint:

```json
{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "0 9 * * *" }
  ]
}
```

`/api/cron/daily` runs all scheduled work in one invocation, in dependency
order, under a 50-second budget:

| Order | Task | Notes |
| --- | --- | --- |
| 1 | `sync-credit` | Refresh cached Shopify balances and customer metrics — everything below reads what this writes |
| 2 | `daily-metrics` | Snapshot yesterday's metrics per currency |
| 3 | `process-campaigns` | Run active campaigns in batches |
| 4 | `reconcile` | Compare Shopify balances against the ledger |
| 5 | `weekly-report` | Self-skips unless it is Monday; deduped per ISO week |

If a task throws, the remaining tasks still run. If the time budget runs out,
the leftovers are reported as `deferred` rather than half-executed — every task
is idempotent, so the next day's run picks them up cleanly.

### Upgrading to Pro

On Pro you can schedule the individual endpoints as often as you like. Each task
still has its own route, so switching is a `vercel.json` change only — no code
changes:

```json
{
  "crons": [
    { "path": "/api/cron/sync-credit", "schedule": "0 */4 * * *" },
    { "path": "/api/cron/daily-metrics", "schedule": "15 1 * * *" },
    { "path": "/api/cron/process-campaigns", "schedule": "0 10 * * *" },
    { "path": "/api/cron/reconcile", "schedule": "30 2 * * *" },
    { "path": "/api/cron/weekly-report", "schedule": "0 9 * * 1" }
  ]
}
```

More frequent syncing mainly buys fresher cached balances on the dashboard. It
does not affect correctness: balances shown as "Shopify balance" are always read
live, and cached figures always display their sync time.

### Running a job manually

Every endpoint requires `Authorization: Bearer $CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/daily
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/sync-credit
```

Calling `/api/cron/weekly-report` directly forces a run regardless of weekday;
the send is still deduped per week, so it cannot email the same report twice.

### Function duration

The tasks batch their work — 25 shops per run, bounded Shopify pagination, 25
recipients per campaign — to stay within the Hobby plan's 60-second function
limit. A larger install base needs either Pro (longer `maxDuration` and separate
schedules) or a smaller per-run batch size; both are constants at the top of
`lib/cron/tasks.js`.

## 18. Shopify App Pricing

Billing runs entirely through Shopify (`appSubscriptionCreate`). There is no
external payment processor.

| Plan | Price | Credit offers / month | Highlights |
| --- | --- | --- | --- |
| Free | $0 | 25 | Dashboard, basic analytics |
| Growth | $19 | 250 | Automated campaigns, customer reminders, advanced analytics |
| Pro | $49 | 1,000 | Advanced segmentation, advanced reports, multiple campaign rules |
| Scale | $99 | Unlimited | Higher limits, multiple stores, agency features, priority support |

Paid plans include a 14-day free trial.

Entitlements are enforced **server-side** in `lib/billing/entitlements.js` and
checked before any money moves. The frontend hides gated features for clarity,
but a crafted API call cannot exceed a plan. Reaching a limit stops new credit
issuance — it never affects balances customers already hold.

---

## 19. App Store submission

### Pre-submission checklist

- [ ] `SHOPIFY_API_VERSION` set to the current stable release, and every query in
      `lib/shopify/queries.js` verified against its documentation
- [ ] Scopes reviewed against `docs/scopes.md`; nothing requested that is unused
- [ ] Protected customer data access approved in the Partner dashboard
- [ ] All three compliance webhooks responding 200 with a valid HMAC and 401
      without one
- [ ] `app/uninstalled` verified to remove tokens
- [ ] Billing tested end to end on a development store
- [ ] Customer Account UI extension deployed and verified on a store with new
      customer accounts
- [ ] `npm test` green
- [ ] No demo data in production (`CREDITLOOP_DEMO_MODE` unset)

### The two critical financial tests

Both are automated in `tests/`, and both must pass before production.

**Test 1 — no duplicate credit.** A $100 refund with a 10% rule issues $110 of
store credit. Submitting the identical request again must leave the Shopify
balance at $110, with `refundCreate` and `storeCreditAccountCredit` each having
run exactly once.

```bash
node --import ./tests/alias-hook.mjs --test tests/refund.test.js
```

**Test 2 — credit used is not revenue.** A customer with a $110 balance spends
$60 on an $80 order. Shopify's balance becomes $50; CreditLoop records credit
used = $60 and revenue from the order = $80. The $60 of credit must never be
reported as $80 of revenue.

```bash
node --import ./tests/alias-hook.mjs --test tests/attribution.test.js
```

### Language requirements

The UI is careful about causal claims. Revenue is always described as *"revenue
from orders that used store credit"*, and the repeat-purchase comparison is
labelled an **observed comparison**. Do not change this wording to imply
CreditLoop caused the revenue — there is no experimental design behind it.

---

## 20. GDPR compliance

| Webhook | Behaviour |
| --- | --- |
| `customers/data_request` | Assembles every record keyed to the customer — metrics, balance snapshots, credit events, order attributions, notification history — and logs the package for the merchant to deliver |
| `customers/redact` | Deletes personal data (metrics, snapshots, campaign recipients, recipient hashes). Anonymizes financial records — amounts and Shopify transaction ids are retained for the merchant's accounting, with the customer identifier replaced |
| `shop/redact` | Deletes the shop and everything cascading from it, including access tokens |

### Data minimization

CreditLoop stores Shopify **customer IDs**, not personal profiles. It keeps a
display name for the merchant dashboard and aggregate metrics for the rules
engine. It does **not** store customer email addresses, phone numbers or postal
addresses — email addresses are fetched from Shopify at send time and only a
SHA-256 hash is retained in the notification log.

### On uninstall

Processing stops, campaigns pause, scheduled jobs skip the shop, and access
tokens are deleted. **Customer store credit balances in Shopify are never
touched.** CreditLoop does not hold customer money and does not use balances as
leverage to prevent a merchant from leaving.

---

## 21. Troubleshooting

### Start here: the health endpoint

```bash
curl https://your-app.vercel.app/api/health
curl "https://your-app.vercel.app/api/health?secret=$CRON_SECRET"
```

Public form reports only whether the database answers. With the cron secret it
adds a configuration checklist — which required environment variables are
present (never their values), the API version, the app URL and the number of
installed shops. `"database": "schema_out_of_date"` means migrations have not
been applied to that environment.


**API calls return 401 in the browser**
The embedded app must run inside the Shopify Admin iframe to get an App Bridge
session token. Opening the Vercel URL directly will always 401.

**"This store has not completed installation"**
No `Shop` record exists for the store, or its access token is gone. The
embedded app detects this and sends the merchant through OAuth automatically
(breaking out of the admin iframe, which OAuth requires). To trigger it by
hand:

```
https://your-app.vercel.app/api/auth/login?shop=your-store.myshopify.com
```

Or install from the Partner dashboard → **Test your app**.

**Webhooks return 401**
`SHOPIFY_API_SECRET` does not match the Partner app. The HMAC is computed over
the raw request body, so any middleware that reparses the body will break it.

**Store credit mutations fail with a permissions error**
The `write_store_credit_account_transactions` scope is missing, or the staff
account lacks the store-credit permission in Shopify. Reinstall after changing
scopes.

**"Something went wrong on our side" / 503 from every dashboard call**
Almost always the database. Hit `/api/health` (above). The two usual causes are
`DATABASE_URL` not set for the **Production** environment in Vercel, or
migrations never applied to the production database:

```bash
DATABASE_URL="<pooled>" DIRECT_DATABASE_URL="<direct>" npx prisma migrate deploy
```

Infrastructure failures now report themselves specifically —
`DATABASE_UNREACHABLE`, `DATABASE_SCHEMA_OUT_OF_DATE` or
`DATABASE_NOT_CONFIGURED` — rather than a generic message.

**Prisma cannot reach the database from Vercel**
Use the **pooled** Neon string for `DATABASE_URL`. The direct string is only for
migrations. Environment variables must be set for the Production environment
specifically, and Vercel only applies them to builds made after the change.

**Migrations hang**
`DIRECT_DATABASE_URL` must be the non-pooled connection — Prisma Migrate cannot
run through the pooler.

**Cron endpoints return 401**
`CRON_SECRET` is unset or does not match. Vercel Cron sends it as a bearer token.

**A reconciliation warning appeared**
A difference means store credit moved outside CreditLoop — a manual admin
adjustment, a Flow action or another app. That is legitimate. CreditLoop reports
it and never "corrects" a Shopify balance on its own. Review the customer in
Shopify and acknowledge the record.

**Customers or orders are missing from the dashboard**
Two causes. First, order and customer webhooks require protected customer data
approval (§11) — until then Shopify rejects the subscriptions and no new data
arrives. Second, webhooks only cover activity *after* install, so existing
history needs a backfill: **Settings → General → Sync now**, which pulls
customers, orders and balances. The scheduled sync does the same every day.

**Emails are logged as `SKIPPED`**
Either `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are unset, or the customer lacks
marketing consent. Check `NotificationLog.error` for the reason.

---

## Licence

Proprietary. All rights reserved.
