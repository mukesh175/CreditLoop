# Extensions awaiting Shopify approval

These are the Customer Account UI extensions. They are **complete and working**
— they are parked here only so the app can release versions in the meantime.

## Why they are not in `extensions/`

Both extensions call the CreditLoop backend to read the customer's store credit
balance, which requires the `network_access` capability. Shopify will not
release an app version containing them until that capability is approved:

> Network access must be requested and approved in order for the
> customer-credit extension to be published.

The Shopify CLI only picks up extensions under the directory named by
`extension_directories` in `shopify.app.toml` (default `extensions/*`), so
moving them here keeps them out of the release without deleting anything.

An unreleased version does not apply app configuration — including the App URL —
so leaving them in place blocks the whole app, not just the extensions.

## Why they cannot simply avoid network access

The customer account surface exposes `storeCreditAccounts` only on the
order-status API, not on the `order-index.block` or `page` targets these
extensions use. Reading the balance therefore has to go through the app's own
backend, which is what `network_access` covers.

## Re-enabling them

1. Request **network access** for each extension in the Partner dashboard, and
   **protected customer data access** for the app (App setup → Protected
   customer data access).
2. Once approved, move them back and restore the workspace glob:

   ```bash
   mkdir -p extensions
   git mv extensions-pending-approval/customer-credit extensions/customer-credit
   git mv extensions-pending-approval/customer-credit-page extensions/customer-credit-page
   ```

   In the root `package.json`, set `"workspaces": ["extensions/*"]`.

3. `npm install && shopify app deploy`

Nothing else changes — the extension code, targets and manifests are unmodified.
