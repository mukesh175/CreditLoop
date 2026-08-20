# Security Incident Response Policy

**Applies to:** the CreditLoop Shopify application and its supporting
infrastructure (Vercel, Neon, Resend, Shopify Partner account).

**Owner:** [YOUR NAME / ROLE] — [your@email.com]
**Effective:** August 19, 2026 · **Review:** annually, and after any incident

---

## 1. What counts as an incident

Any event that compromises, or may have compromised, the confidentiality,
integrity or availability of merchant or customer data:

- Unauthorised access to the database, hosting account, Shopify Partner account
  or email provider
- Leaked credentials — `SHOPIFY_API_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`,
  database URLs, or an API key committed to a repository or posted publicly
- A defect exposing one store's data to another, or a customer's data to
  another customer
- **Any incorrect movement of money** — store credit issued twice, issued to the
  wrong customer, or a refund processed without merchant confirmation
- Malicious or unexplained use of the credit issuance, refund or cron endpoints
- Extended unavailability preventing merchants from using the app

**Severity**

| Level | Meaning | Example |
| --- | --- | --- |
| **P1** | Confirmed data exposure or incorrect money movement | Database credentials leaked; duplicate credit issued to customers |
| **P2** | Credible risk, not yet confirmed as exploited | A secret committed to a repository and since rotated |
| **P3** | Contained, no data or money affected | Failed intrusion attempt in logs; a vulnerable dependency with no exploit path |

---

## 2. How incidents are detected

- **Error monitoring** — Vercel runtime logs. Application errors are logged
  server-side with a request ID; financial failures are also written to the
  audit log with `result: FAILURE`.
- **Reconciliation** — a scheduled job compares Shopify store-credit balances
  against CreditLoop's records daily and raises a warning on any difference.
  This is the primary detection for incorrect money movement.
- **Health endpoint** — `/api/health` reports database reachability.
- **Provider alerts** — Vercel, Neon, Resend and Shopify Partner notifications.
- **Reports from merchants or researchers** — see §7.

---

## 3. Response

### Step 1 — Triage (within 1 hour of becoming aware)

Assign severity. Record in the incident log: what was observed, when, how it was
detected, who is handling it. **Do not** delete logs, database rows or
deployments — they are the evidence.

### Step 2 — Contain (immediately for P1)

Depending on the incident:

- **Leaked secret** — rotate it now. `SHOPIFY_API_SECRET` in the Partner
  dashboard; `CRON_SECRET` in Vercel; database credentials in Neon; Resend API
  key in Resend. Redeploy. *Note:* rotating `ENCRYPTION_KEY` makes stored access
  tokens undecryptable and forces every merchant to reinstall — do it only when
  that key itself is compromised.
- **Compromised account** — revoke sessions, reset credentials, confirm 2FA.
- **Defect exposing data** — disable the affected route or roll back the
  deployment.
- **Incorrect money movement** — stop the mechanism responsible (pause the
  campaign, disable the rule) before correcting anything. **Never** silently
  adjust a customer's Shopify balance; document what happened and agree the
  correction with the affected merchant.

### Step 3 — Assess (within 24 hours)

Determine: what data was involved, which stores and how many customers, over
what period, and whether it was accessed or only exposed. The audit log and
Vercel request logs are the primary sources.

### Step 4 — Notify (see §4)

### Step 5 — Recover

Deploy the fix. Verify with reconciliation and the health endpoint. Confirm the
underlying cause is closed, not just the symptom.

### Step 6 — Review (within 14 days)

Write up: timeline, root cause, why detection took as long as it did, and the
specific changes preventing recurrence. Add a regression test where the cause
was a code defect.

---

## 4. Notification

| Who | When | What |
| --- | --- | --- |
| **Affected merchants** | Without undue delay; **within 72 hours** of becoming aware for any personal-data breach | What happened, what data, when, what we have done, what they should do |
| **Shopify** | Promptly for any incident involving Shopify data or a Partner account compromise | Via Partner support |
| **Data protection authority** | Within 72 hours where legally required | As required by applicable law |
| **Affected customers** | Where the law requires direct notification | Coordinated with the merchant, who is the data controller |

Merchants are contacted at the email on their store record. Notification is not
delayed to wait for a complete picture — send what is known, then follow up.

---

## 5. Contacts

| Role | Contact |
| --- | --- |
| Incident owner | [YOUR NAME] — [your@email.com] |
| Backup contact | [BACKUP NAME] — [backup@email.com] |
| Security reports | [security@yourdomain.com] |
| Shopify Partner support | partners.shopify.com |
| Hosting / database / email | Vercel · Neon · Resend support consoles |

---

## 6. Preventive controls already in place

- Shopify access tokens encrypted (AES-256-GCM) before storage, beyond the
  database's own encryption at rest
- Every financial mutation guarded by an idempotency record, so a retry or
  double-submit cannot issue credit twice
- Financial mutations are never retried automatically on error — the merchant is
  told to verify first
- Every request authenticated against a cryptographically verified session
  token; a shop identifier from the client is never trusted
- Webhooks verified by HMAC over the raw body before parsing
- Cron endpoints protected by a shared secret
- Audit log covering rule changes, credit issuance, refunds, campaigns and
  failures
- Daily reconciliation against Shopify balances, which reports differences and
  never corrects them silently
- Errors returned to the browser never contain connection strings, tokens or
  stack traces

---

## 7. Reporting a vulnerability

Email **[security@yourdomain.com]** with steps to reproduce and the impact.
We acknowledge within 2 business days and aim to resolve within 30 days.
Please do not access data belonging to others, degrade the service, or disclose
publicly before a fix is available. We will not pursue legal action against
good-faith research that follows this.

---

## 8. Incident log

Record every incident, including those resolved without notification.

| Date | Severity | Summary | Detected by | Notified | Resolved | Review |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |
