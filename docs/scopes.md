# Shopify access scopes

CreditLoop requests the minimum set of scopes its implemented features need.
Verify each against the current Shopify API documentation before submitting to
the App Store — scope names and requirements change between versions.

| Scope | Why CreditLoop needs it | Used by |
| --- | --- | --- |
| `read_orders` | Read order totals, line items and refund history to build return opportunities, recommendations and order attribution. | `/api/refunds/preview`, orders webhooks, attribution |
| `write_orders` | Create refunds when a merchant chooses to refund an order to store credit or to the original payment method. | `refundCreate` in `lib/refunds/store-credit-refund.js` |
| `read_returns` | Read return requests so a credit offer can be recommended against the actual returned value. | Returns page |
| `read_customers` | Read order counts, lifetime spend and email marketing consent — the inputs the rules engine and campaign consent gate depend on. | Rules engine, segments, campaigns |
| `read_store_credit_accounts` | Read the authoritative store credit balance and transaction history. Shopify is the source of truth for balances. | Credit dashboard, customer account extension, reconciliation |
| `write_store_credit_account_transactions` | Issue the store credit and promotional bonuses a merchant approves. | `storeCreditAccountCredit`, `storeCreditAccountDebit` |

## Scopes deliberately not requested

- **`write_customers`** — CreditLoop never modifies customer records.
- **`read_all_orders`** — the default 60-day order window is sufficient; the app
  does not need historical orders beyond what Shopify grants by default.
- **`write_discounts`, `write_price_rules`** — CreditLoop uses store credit, not
  discount codes.
- Any product, inventory or fulfilment scope — outside the product's scope.

## Store credit permissions

Store credit mutations require the store-credit transaction permission. A staff
member without it will see Shopify reject the mutation; CreditLoop surfaces
Shopify's own message rather than a generic failure.
