import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useApi } from '@shopify/ui-extensions/customer-account/preact';
import { useStoreCredit, appOriginFrom, formatAmount, formatDate } from './useStoreCredit';

export default async () => {
  render(<CreditBlock />, document.body);
};

/**
 * Compact store-credit card on the order index.
 *
 * Branded as the merchant's store credit, never as CreditLoop — the customer is
 * interacting with the store they bought from, not a third-party app.
 */
function CreditBlock() {
  const { sessionToken, i18n, extension } = useApi();
  const { loading, error, data } = useStoreCredit({
    sessionToken,
    appUrl: appOriginFrom(extension),
  });

  if (loading) {
    return (
      <s-section heading="Your store credit">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-spinner accessibilityLabel="Loading your store credit" />
          <s-text color="subdued">Loading…</s-text>
        </s-stack>
      </s-section>
    );
  }

  // A customer with no credit sees nothing rather than an empty card.
  if (error || !data?.hasCredit) return null;

  const account = data.accounts.find((entry) => entry.balance > 0);
  if (!account) return null;

  const recent = (account.transactions || []).slice(0, 3);

  return (
    <s-section heading="Your store credit">
      <s-stack gap="base">
        <s-heading size="large">
          {formatAmount(account.balance, account.currencyCode, i18n)}
        </s-heading>
        <s-text color="subdued">Available to use at checkout.</s-text>

        {recent.length > 0 && (
          <>
            <s-divider />
            <s-text color="subdued">Recent activity</s-text>
            {recent.map((transaction) => (
              <s-stack
                key={transaction.id}
                direction="inline"
                gap="small-200"
                alignItems="center"
              >
                <s-text fontWeight="bold">
                  {transaction.type === 'CREDIT' ? '+' : '−'}
                  {formatAmount(transaction.amount, transaction.currencyCode, i18n)}
                </s-text>
                <s-text color="subdued">{formatDate(transaction.createdAt, i18n)}</s-text>
              </s-stack>
            ))}
          </>
        )}

        <s-button href={data.storeUrl} variant="primary">
          Shop now
        </s-button>
      </s-stack>
    </s-section>
  );
}
