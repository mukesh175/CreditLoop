# Data protection — what CreditLoop processes

Written to answer Shopify's protected customer data questionnaire truthfully,
and as the basis for a merchant-facing privacy policy. Every statement here is
verifiable against the code, with file references.

---

## Protected customer data used

| Field | Used? | Why | Stored? |
| --- | --- | --- | --- |
| **Name** | Yes | Shown to the merchant so they can identify a customer in Returns, Credit and Customers | Yes — `CustomerMetric.displayName`, deleted on redact |
| **Email** | Yes | Sending credit notifications and campaign emails the merchant enabled | **No** — fetched from Shopify at send time and discarded; only a SHA-256 hash is kept (`NotificationLog.recipientHash`) |
| **Phone** | No | Not used by any feature | Never requested, never stored |
| **Address** | No | Not used by any feature | Never requested, never stored |

Everything else is keyed to the **Shopify customer ID** (`gid://shopify/Customer/…`),
not to a person's details.

### Non-PII stored per customer

`CustomerMetric` — order count, lifetime spend, average order value, first/last
order dates, return count, credit issued/redeemed totals, marketing-consent
state. These are the inputs the rules engine and segments need to decide whether
a return should be worth more as store credit.

`CustomerCreditSnapshot` — a cached copy of the Shopify store-credit balance, so
the dashboard does not issue one Admin API call per row. Shopify remains the
source of truth; the UI always shows when the snapshot was taken.

`CreditEvent`, `OrderAttribution`, `CreditAttribution` — amounts, currencies,
Shopify transaction IDs and order IDs. Financial records, not personal profiles.

---

## Purpose

**Minimum data.** The app requests two protected fields and stores one of them.
Emails are used transiently. Phone and address are never requested. Analytics
are keyed to Shopify IDs.
→ `lib/analytics/customer-metrics.js`, `lib/email/client.js`

**Disclosed to merchants.** Settings → General lists every scope with the reason
it is needed; `docs/scopes.md` documents the same.

**Limited to that purpose.** Customer data is used only to compute credit
recommendations, produce the merchant's own analytics, and send emails that
merchant has enabled. It is never sold, shared with third parties, or used to
train anything. The only external processor is the email provider (Resend), and
only at send time.

---

## Consent

**Customer marketing consent is enforced before every campaign email.** A
customer holding store credit is explicitly *not* treated as consent. A send
requires: the merchant enabled the campaign, the campaign is active, and the
customer's Shopify `emailMarketingConsent.marketingState` is `SUBSCRIBED`.
Failures are recorded with the reason (`NO_MARKETING_CONSENT`).
→ `lib/campaigns/consent.js`, `tests/campaigns.test.js`

**No data is sold**, so opt-out of sale does not apply.

**No automated decision-making with legal or significant effects.** The rules
engine produces a *recommendation* shown to the merchant, who reviews and
confirms it. Nothing is issued to a customer without an explicit human action,
and a recommendation can only ever offer a customer more credit, never withhold
something they are entitled to. Refunds to the original payment method remain
available at all times.
→ `lib/rules/engine.js`, `app/api/refunds/store-credit/route.js`

---

## Storage

**Retention.** Data lives as long as the app is installed and is removed on
request:

| Trigger | Effect |
| --- | --- |
| `customers/redact` | Personal data deleted (metrics, snapshots, campaign recipients, recipient hashes). Financial records anonymized — amounts and Shopify transaction IDs retained for the merchant's accounting, customer identifier replaced |
| `shop/redact` | The shop and everything cascading from it deleted, including access tokens |
| App uninstall | Processing stops, campaigns pause, access tokens deleted |

→ `app/api/webhooks/customers-redact/route.js`, `shop-redact/route.js`

**Encryption in transit.** All traffic is HTTPS — Shopify Admin API, the
database connection (`sslmode=require`), and the email provider.

**Encryption at rest.** The database (Neon) encrypts data at rest, including
backups. Shopify access tokens receive a second layer: AES-256-GCM before they
are written, so a database leak alone does not yield working credentials.
→ `lib/util/crypto.js`

**Test and production separation.** Separate deployments with separate
databases. Demo data is opt-in per deployment, tagged with a
`gid://creditloop-demo/…` identifier, removable in one action, and visibly
banner-marked.
→ `lib/demo/generate.js`

---

## Access

**Least privilege.** The app requests six scopes, each tied to an implemented
feature (`docs/scopes.md`). No write access to customers. No product,
inventory or fulfilment scopes.

**Shop isolation.** Every request derives its shop from a cryptographically
verified session token; a shop identifier from the client is never trusted, and
every record lookup is ownership-checked.
→ `lib/shopify/auth-guard.js`

**Audit logging.** Rule changes, credit issuance, refunds, campaign activity,
notifications and failures are recorded with actor, amount, currency, Shopify
transaction ID and timestamp, visible at Settings → Audit Log.
→ `lib/util/audit.js`

**Secrets.** Access tokens are never returned by any API route and never reach
the browser. Errors surfaced to the browser never contain connection strings,
tokens or stack traces.
→ `lib/util/errors.js`

---

## What still needs a human decision

These questionnaire answers depend on your operational practices, not on the
code. Answer them honestly for your own setup:

- **Privacy and data protection agreements with merchants** — you need a
  published privacy policy, and a DPA if you have EU merchants.
- **Data loss prevention** — depends on your database backup configuration.
  Neon's paid tiers provide point-in-time restore; the free tier is limited.
- **Staff access limits and password requirements** — depends on who has access
  to the Vercel, Neon and Shopify Partner accounts. Enable 2FA on all three.
- **Security incident response policy** — write one, even a single page: how a
  breach is detected, who is notified, within what timeframe.
- **Third-party audits** — leave blank unless you actually hold one. Do not
  claim SOC 2.
