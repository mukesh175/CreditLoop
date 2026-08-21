# Testing CreditLoop

Three layers, in increasing cost: automated tests, demo data, and real Shopify
flows. Use the cheapest one that actually answers your question.

---

## 1. Automated tests

```bash
npm test
```

99 tests, no database or Shopify store needed — a loader hook swaps in in-memory
doubles, so the real financial code paths execute end to end.

| File | Covers |
| --- | --- |
| `tests/rules-engine.test.js` | Percentage and fixed bonuses, maximum bonus caps, minimum refund floors, VIP eligibility, disabled and expired rules, overlapping rules not stacking, conditions on unknown data failing closed |
| `tests/money.test.js` | Cross-currency rejection, cent-exact arithmetic, per-currency grouping |
| `tests/idempotency.test.js` | Execute-once, replay, concurrent duplicate refusal, retry after failure |
| `tests/credit-issuance.test.js` | Issuance, **no duplicate credit on repeat**, currency mismatch, invalid amounts, Shopify failure, balances read from Shopify |
| `tests/refund.test.js` | Full and partial refunds, **$100 + 10% = $110 exactly once**, over-refund rejection, currency mismatch |
| `tests/attribution.test.js` | Store-credit detection, **credit used ≠ order revenue**, failed transactions ignored |
| `tests/campaigns.test.js` | Consent gate — no consent, no email address, draft/paused campaigns, plan limits |
| `tests/reconciliation.test.js` | Matching balances, mismatch logged without touching Shopify, redemptions subtracted |
| `tests/email-sender.test.js` | Store brand as sender, header-injection attempts, quoting, fallbacks |
| `tests/routes-smoke.test.js` | Every merchant-facing route answers without a server error; rule and campaign creation; validation refusals; demo records blocked from financial operations; cron secret enforcement |
| `tests/webhooks.test.js` | Unsigned payloads rejected before parsing, redeliveries deduplicated, order attribution, refunds never issuing credit, uninstall clearing tokens and pausing campaigns |
| `tests/demo-guard.test.js` | Demo identifiers never mistaken for Shopify ones |

Run one file:

```bash
node --import ./tests/alias-hook.mjs --test tests/refund.test.js
```

---

## 2. Demo data — exercising every screen

Real store credit activity takes weeks to accumulate. Demo data gives you a
populated dashboard immediately.

**Enable it** by setting `CREDITLOOP_DEMO_MODE=true` in the deployment's
environment, then redeploy. **Settings → General → Demo data** appears.

- **Generate** creates 250 customers, 500 orders, 40 returns, 120 credit
  transactions.
- **Clear** removes every demo row and nothing else.

Demo rows carry a `gid://creditloop-demo/…` identifier, so they can never be
confused with Shopify data, and **no store credit is issued in Shopify** — the
generator writes only to CreditLoop's own tables. A banner shows across the
dashboard the whole time.

**Never set this on a deployment serving live merchants.**

### What to check on each page

| Page | What demo data proves |
| --- | --- |
| Overview | KPIs populate, chart renders, period-over-period changes, alerts appear |
| Returns → Return → Credit | Opportunities list, recommendations, customer profiles |
| Orders | Credit-used column, repeat-purchase flags |
| Credit / Unused credit | Outstanding total, 30/60/90 ageing buckets, status pills |
| Customers | Search, segments, per-customer detail |
| Analytics | Impact figures, repeat-purchase comparison, observed-comparison wording |
| Settings → Audit log | Entries from anything you did |

### Empty states

Clear the demo data and revisit each page — every one should show a written
empty state, never a blank panel or a spinner that never resolves.

---

## 3. Real Shopify flows

Demo data cannot test anything that touches Shopify. These require a
development store.

### Prerequisites

- Development store with **new customer accounts** enabled
- App installed (open it from the store admin; installation completes itself)
- **Protected customer data access approved** — without it, customer and order
  data will not sync and the webhooks stay dormant

### Rules engine

**Settings → Credit Rules → New rule.** Build a rule, then use **Test rule**
with sample inputs before saving. Check:

- 10% of a $100 refund → $10 bonus, $110 total
- Raise the refund to $1,000 → bonus caps at your maximum
- Set a minimum refund above your test amount → not eligible, with the reason
- Two matching rules → only the higher-priority one applies, bonuses do not add up

### The critical financial test

1. Create an order on the dev store and mark it paid.
2. **Returns → Return → Credit**, pick the order, review the confirmation:
   refund value, bonus, total credit, customer, order, currency.
3. Confirm.
4. In Shopify: **Customers → the customer → Store credit**. The balance must
   equal refund + bonus.
5. **Submit the identical refund again.** The balance must not change, and
   CreditLoop should report the request as already processed.

That second submission is the test that matters most. A duplicate here is real
money issued twice.

### Redemption and attribution

1. Place an order as that customer, paying partly with store credit.
2. Shopify's balance drops by the credit used.
3. CreditLoop **Orders** shows the order with the credit amount.
4. **Analytics** counts the full order total as revenue from an order using
   credit — *not* the credit portion. These are different numbers and must
   stay different.

### Emails

**Settings → Notifications → Send a test email.** Sends to you with sample
figures. Confirm the sender shows your store's brand and `Reply-To` is your
store address.

For a real campaign send: **Campaigns → New campaign**, activate it, **Run
now**. Only customers with marketing consent in Shopify receive anything —
verify by removing consent from a test customer and confirming they are skipped
with reason `NO_MARKETING_CONSENT` in `NotificationLog`.

### Customer account extension

Requires network access approval (see `extensions-pending-approval/README.md`).
Once approved and deployed: log into the store as a customer holding credit and
check the balance card on the order index and the full history page.

### Reconciliation

1. Issue store credit **manually in Shopify admin**, bypassing CreditLoop.
2. Run `/api/cron/reconcile` with the cron secret.
3. **Credit** page shows a reconciliation warning with the difference.
4. Confirm the Shopify balance was **not** modified — CreditLoop reports
   differences, it never corrects them.

### Uninstall

Uninstall from the store admin, then confirm: campaigns paused, tokens deleted,
and — importantly — **customer store credit balances in Shopify unchanged**.

---

## Diagnosing an empty dashboard

```bash
curl "https://your-app.vercel.app/api/health?secret=$CRON_SECRET"
```

Then **Settings → General → Sync now**, which reports each part separately.
"Awaiting approval" against customers or orders means protected customer data
access has not been granted — that is the single most common cause of an empty
dashboard, and no amount of syncing will fix it until the approval lands.
