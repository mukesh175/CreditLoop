# Architecture

## The financial rule

Shopify's native `StoreCreditAccount` balance is the **only** source of truth for
customer money. CreditLoop's Neon database holds analytics, configuration and
audit data.

```
                 SHOPIFY
                    │
          Native Store Credit
                    │
          ┌─────────┴─────────┐
          │                   │
       Balance            Transactions
          │                   │
          └─────────┬─────────┘
                    │
               CreditLoop
                    │
        Rules / Campaigns / Analytics
                    │
                  Neon
```

What this means in practice:

- **Never** compute a balance as `credits − debits` from `CreditEvent`.
  `CreditEvent` is an audit ledger, not an account.
- Balance reads go to Shopify (`lib/credit/store-credit.js`).
- `CustomerCreditSnapshot` is a *cache* of the Shopify balance, used only so the
  dashboard doesn't issue one Admin API call per row. Every UI surface that
  shows a cached balance also shows its `syncedAt`.
- Reconciliation reports differences; it never writes to Shopify to resolve one.

## Request flow

```
Merchant (Shopify Admin iframe)
  → App Bridge session token
  → Next.js route handler
  → requireShop()  ← verifies the token, derives the shop
  → service layer (lib/…)
  → Shopify Admin GraphQL  +  Neon via Prisma
```

The shop is always derived from the verified session token's `dest` claim. No
route trusts a `shopId` from the client.

## Financial safety layers

1. **Explicit merchant action.** Refunds and credit issuance only ever run from a
   confirmed merchant request. No webhook or cron job converts a refund to credit.
2. **Idempotency.** Every financial mutation goes through `withIdempotency`,
   keyed on the operation's identity. A repeat returns the stored result; a
   concurrent duplicate is refused.
3. **No blind retries.** `adminGraphql` retries throttling and transport errors,
   but financial mutations pass `retryOnThrottle: false`. If Shopify errors, the
   merchant is told to verify before retrying rather than the app retrying itself.
4. **Currency isolation.** `lib/util/money.js` throws on any cross-currency
   operation. Analytics group by currency; totals are never merged.
5. **Audit trail.** Every issuance, refund, rule change and failure is written to
   `AuditLog` with the Shopify transaction id.
6. **Reconciliation.** A scheduled job compares Shopify balances to the ledger
   and raises warnings for a human.

## Directory map

```
app/            Next.js App Router — pages and route handlers
  api/          Server-only API routes (auth, webhooks, cron, resources)
components/     React components (Bootstrap 5, no CSS framework beyond it)
lib/
  shopify/      GraphQL client, OAuth, sessions, HMAC, webhook plumbing
  credit/       Store credit read/issue/debit, sync, reconciliation
  refunds/      Refund services (store credit and original payment)
  rules/        Rules engine (pure) and recommendation builder
  campaigns/    Consent gate and campaign runner
  analytics/    Metrics, attribution, segments, alerts
  email/        Resend client and templates
  billing/      Plans, entitlements, Shopify subscriptions
  util/         Money, errors, crypto, idempotency, audit
extensions/     Customer Account UI extension
prisma/         Schema
tests/          node:test suites, including the critical financial tests
```

## Why the rules engine is not "AI"

It is a deterministic rules engine, and it is called that everywhere in the UI.
Merchants are configuring standing commitments to give away money; every offer
CreditLoop makes can be traced to a named rule and the specific conditions that
matched. `POST /api/rules/test` runs the same engine against hypothetical inputs
so a rule can be proven before it is enabled.
