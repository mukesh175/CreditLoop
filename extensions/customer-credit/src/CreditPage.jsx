import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useApi } from '@shopify/ui-extensions/customer-account/preact';
import { useStoreCredit, appOriginFrom, formatAmount, formatDate } from './useStoreCredit';

export default async () => {
  render(<CreditPage />, document.body);
};

/**
 * Full credit history page.
 *
 * Shopify's own transaction data is the source of truth for every figure here —
 * the backend reads it live rather than reporting a cached balance.
 */
function CreditPage() {
  const { sessionToken, i18n, extension } = useApi();
  const { loading, error, data } = useStoreCredit({
    sessionToken,
    appUrl: appOriginFrom(extension),
  });

  if (loading) {
    return (
      <s-page heading="Store credit">
        <s-section>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-spinner accessibilityLabel="Loading your store credit" />
            <s-text color="subdued">Loading your store credit…</s-text>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  if (error) {
    return (
      <s-page heading="Store credit">
        <s-section>
          <s-banner tone="info" heading="Store credit is temporarily unavailable">
            <s-paragraph>Please check back shortly.</s-paragraph>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  const account = data.accounts?.find((entry) => entry.balance > 0) || data.accounts?.[0];

  if (!account || account.balance <= 0) {
    return (
      <s-page heading="Store credit">
        <s-section>
          <s-stack gap="base">
            <s-paragraph>You do not have any store credit right now.</s-paragraph>
            <s-button href={data.storeUrl} variant="primary">
              Shop now
            </s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Store credit">
      <s-section>
        <s-stack gap="base">
          <s-text color="subdued">Your balance</s-text>
          <s-heading size="large">
            {formatAmount(account.balance, account.currencyCode, i18n)}
          </s-heading>
          <s-text color="subdued">Available to use at checkout.</s-text>
          <s-button href={data.storeUrl} variant="primary">
            Shop now
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Credit history">
        <s-stack gap="base">
          {(account.transactions || []).map((transaction) => (
            <s-stack key={transaction.id} gap="small-500">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text fontWeight="bold">
                  {transaction.type === 'CREDIT' ? '+' : '−'}
                  {formatAmount(transaction.amount, transaction.currencyCode, i18n)}
                </s-text>
                <s-text color="subdued">{formatDate(transaction.createdAt, i18n)}</s-text>
              </s-stack>

              {transaction.balanceAfter != null && (
                <s-text color="subdued">
                  Balance after:{' '}
                  {formatAmount(transaction.balanceAfter, transaction.currencyCode, i18n)}
                </s-text>
              )}

              {transaction.expiresAt && (
                <s-text color="subdued">
                  Expires {formatDate(transaction.expiresAt, i18n)}
                </s-text>
              )}

              <s-divider />
            </s-stack>
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}
