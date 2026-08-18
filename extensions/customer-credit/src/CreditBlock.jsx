import {
  reactExtension,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Card,
  Divider,
  useApi,
  Banner,
  SkeletonText,
} from '@shopify/ui-extensions-react/customer-account';
import { useStoreCredit, formatAmount } from './useStoreCredit';

export default reactExtension('customer-account.order-index.block.render', () => <CreditBlock />);

/**
 * Compact store-credit block.
 *
 * Deliberately branded as the merchant's store credit, not as CreditLoop — the
 * customer is interacting with the store they bought from, not a third-party app.
 */
function CreditBlock() {
  const { sessionToken, i18n, extension } = useApi();
  const appUrl = extension?.scriptUrl ? new URL(extension.scriptUrl).origin : '';
  const { loading, error, data } = useStoreCredit(sessionToken, appUrl);

  if (loading) {
    return (
      <Card padding>
        <BlockStack spacing="base">
          <SkeletonText inlineSize="small" />
          <SkeletonText inlineSize="large" />
        </BlockStack>
      </Card>
    );
  }

  if (error) {
    return (
      <Banner status="info">
        <Text>Your store credit is temporarily unavailable. Please check back shortly.</Text>
      </Banner>
    );
  }

  const account = data.accounts?.[0];
  if (!account || account.balance <= 0) return null;

  return (
    <Card padding>
      <BlockStack spacing="base">
        <Text size="small" appearance="subdued">
          YOUR STORE CREDIT
        </Text>
        <Text size="extraLarge" emphasis="bold">
          {formatAmount(account.balance, account.currencyCode, i18n)}
        </Text>
        <Text size="small" appearance="subdued">
          Available to use at checkout.
        </Text>

        {account.transactions?.length > 0 && (
          <>
            <Divider />
            <Text size="small" appearance="subdued">
              Recent activity
            </Text>
            {account.transactions.slice(0, 3).map((transaction) => (
              <InlineStack key={transaction.id} spacing="base" blockAlignment="center">
                <Text emphasis="bold">
                  {transaction.type === 'CREDIT' ? '+' : '−'}
                  {formatAmount(transaction.amount, transaction.currencyCode, i18n)}
                </Text>
                <Text size="small" appearance="subdued">
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </Text>
              </InlineStack>
            ))}
          </>
        )}

        <Button to={data.storeUrl} kind="primary">
          Shop now
        </Button>
      </BlockStack>
    </Card>
  );
}
