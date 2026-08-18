import {
  reactExtension,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Card,
  Divider,
  Page,
  Banner,
  SkeletonText,
  useApi,
} from '@shopify/ui-extensions-react/customer-account';
import { useStoreCredit, formatAmount } from './useStoreCredit';

export default reactExtension('customer-account.page.render', () => <CreditPage />);

/** Full credit history page, using Shopify's transaction data as the source of truth. */
function CreditPage() {
  const { sessionToken, i18n, extension } = useApi();
  const appUrl = extension?.scriptUrl ? new URL(extension.scriptUrl).origin : '';
  const { loading, error, data } = useStoreCredit(sessionToken, appUrl);

  if (loading) {
    return (
      <Page title="Store credit">
        <Card padding>
          <BlockStack spacing="base">
            <SkeletonText inlineSize="large" />
            <SkeletonText inlineSize="base" />
            <SkeletonText inlineSize="base" />
          </BlockStack>
        </Card>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Store credit">
        <Banner status="info">
          <Text>Your store credit is temporarily unavailable. Please check back shortly.</Text>
        </Banner>
      </Page>
    );
  }

  const account = data.accounts?.[0];

  if (!account || account.balance <= 0) {
    return (
      <Page title="Store credit">
        <Card padding>
          <BlockStack spacing="base">
            <Text>You do not have any store credit right now.</Text>
            <Button to={data.storeUrl} kind="primary">
              Shop now
            </Button>
          </BlockStack>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Store credit">
      <BlockStack spacing="loose">
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
            <Button to={data.storeUrl} kind="primary">
              Shop now
            </Button>
          </BlockStack>
        </Card>

        <Card padding>
          <BlockStack spacing="base">
            <Text emphasis="bold">Credit history</Text>
            <Divider />
            {account.transactions.map((transaction) => (
              <BlockStack key={transaction.id} spacing="extraTight">
                <InlineStack spacing="base" blockAlignment="center">
                  <Text emphasis="bold">
                    {transaction.type === 'CREDIT' ? '+' : '−'}
                    {formatAmount(transaction.amount, transaction.currencyCode, i18n)}
                  </Text>
                  <Text size="small" appearance="subdued">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </Text>
                </InlineStack>
                {transaction.balanceAfter != null && (
                  <Text size="small" appearance="subdued">
                    Balance after: {formatAmount(transaction.balanceAfter, transaction.currencyCode, i18n)}
                  </Text>
                )}
                {transaction.expiresAt && (
                  <Text size="small" appearance="subdued">
                    Expires {new Date(transaction.expiresAt).toLocaleDateString()}
                  </Text>
                )}
              </BlockStack>
            ))}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
