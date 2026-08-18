/**
 * Admin GraphQL documents.
 *
 * Every document here targets the Admin API version configured in lib/config.js.
 * Verify field availability against the current stable version before deploying
 * (see README → "Shopify API version").
 */

export const SHOP_INFO_QUERY = `#graphql
  query CreditLoopShopInfo {
    shop {
      id
      name
      email
      myshopifyDomain
      currencyCode
      ianaTimezone
    }
  }
`;

// --- Store credit -----------------------------------------------------------

export const CUSTOMER_STORE_CREDIT_QUERY = `#graphql
  query CreditLoopCustomerStoreCredit($customerId: ID!, $transactions: Int!) {
    customer(id: $customerId) {
      id
      displayName
      numberOfOrders
      amountSpent { amount currencyCode }
      storeCreditAccounts(first: 10) {
        nodes {
          id
          balance { amount currencyCode }
          transactions(first: $transactions, reverse: true) {
            nodes {
              id
              createdAt
              amount { amount currencyCode }
              balanceAfterTransaction { amount currencyCode }
              account { id }
              ... on StoreCreditAccountCreditTransaction { expiresAt }
              ... on StoreCreditAccountDebitTransaction { __typename }
            }
          }
        }
      }
    }
  }
`;

export const STORE_CREDIT_ACCOUNT_QUERY = `#graphql
  query CreditLoopStoreCreditAccount($id: ID!, $transactions: Int!) {
    storeCreditAccount(id: $id) {
      id
      balance { amount currencyCode }
      owner { ... on Customer { id displayName } }
      transactions(first: $transactions, reverse: true) {
        nodes {
          id
          createdAt
          amount { amount currencyCode }
          balanceAfterTransaction { amount currencyCode }
          ... on StoreCreditAccountCreditTransaction { expiresAt }
        }
      }
    }
  }
`;

export const STORE_CREDIT_ACCOUNT_CREDIT_MUTATION = `#graphql
  mutation CreditLoopIssueCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
    storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
      storeCreditAccountTransaction {
        id
        createdAt
        amount { amount currencyCode }
        balanceAfterTransaction { amount currencyCode }
        account { id balance { amount currencyCode } }
      }
      userErrors { field message }
    }
  }
`;

export const STORE_CREDIT_ACCOUNT_DEBIT_MUTATION = `#graphql
  mutation CreditLoopDebitCredit($id: ID!, $debitInput: StoreCreditAccountDebitInput!) {
    storeCreditAccountDebit(id: $id, debitInput: $debitInput) {
      storeCreditAccountTransaction {
        id
        createdAt
        amount { amount currencyCode }
        balanceAfterTransaction { amount currencyCode }
        account { id balance { amount currencyCode } }
      }
      userErrors { field message }
    }
  }
`;

// --- Orders / refunds -------------------------------------------------------

export const ORDER_FOR_REFUND_QUERY = `#graphql
  query CreditLoopOrderForRefund($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      displayFinancialStatus
      currencyCode
      totalPriceSet { shopMoney { amount currencyCode } }
      totalRefundedSet { shopMoney { amount currencyCode } }
      refundable
      customer {
        id
        displayName
        numberOfOrders
        amountSpent { amount currencyCode }
      }
      lineItems(first: 50) {
        nodes {
          id
          title
          quantity
          refundableQuantity
          originalUnitPriceSet { shopMoney { amount currencyCode } }
          discountedTotalSet { shopMoney { amount currencyCode } }
        }
      }
      transactions(first: 20) {
        id
        kind
        status
        gateway
        amountSet { shopMoney { amount currencyCode } }
      }
    }
  }
`;

export const ORDERS_LIST_QUERY = `#graphql
  query CreditLoopOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        currencyCode
        totalPriceSet { shopMoney { amount currencyCode } }
        totalRefundedSet { shopMoney { amount currencyCode } }
        customer { id displayName numberOfOrders }
        transactions(first: 10) {
          id
          kind
          status
          gateway
          amountSet { shopMoney { amount currencyCode } }
        }
      }
    }
  }
`;

/**
 * Refund with store credit as the refund method.
 * `RefundInput.refundMethods.storeCreditRefund` is how Shopify issues native
 * store credit as part of a refund.
 */
export const REFUND_CREATE_MUTATION = `#graphql
  mutation CreditLoopRefundCreate($input: RefundInput!) {
    refundCreate(input: $input) {
      refund {
        id
        createdAt
        totalRefundedSet { shopMoney { amount currencyCode } }
        order { id name }
      }
      userErrors { field message }
    }
  }
`;

export const SUGGESTED_REFUND_QUERY = `#graphql
  query CreditLoopSuggestedRefund($orderId: ID!, $refundLineItems: [RefundLineItemInput!]) {
    order(id: $orderId) {
      id
      name
      currencyCode
      suggestedRefund(refundLineItems: $refundLineItems) {
        amountSet { shopMoney { amount currencyCode } }
        maximumRefundableSet { shopMoney { amount currencyCode } }
        subtotalSet { shopMoney { amount currencyCode } }
        totalTaxSet { shopMoney { amount currencyCode } }
        suggestedTransactions {
          amountSet { shopMoney { amount currencyCode } }
          gateway
          parentTransaction { id }
        }
      }
    }
  }
`;

export const RETURNS_QUERY = `#graphql
  query CreditLoopReturns($first: Int!, $after: String, $query: String) {
    returns(first: $first, after: $after, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        status
        totalQuantity
        order {
          id
          name
          currencyCode
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { id displayName numberOfOrders amountSpent { amount currencyCode } }
        }
        returnLineItems(first: 20) {
          nodes {
            id
            quantity
            ... on ReturnLineItem {
              fulfillmentLineItem {
                lineItem { id title discountedTotalSet { shopMoney { amount currencyCode } } quantity }
              }
            }
          }
        }
      }
    }
  }
`;

// --- Customers --------------------------------------------------------------

export const CUSTOMERS_QUERY = `#graphql
  query CreditLoopCustomers($first: Int!, $after: String, $query: String) {
    customers(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        displayName
        numberOfOrders
        createdAt
        updatedAt
        amountSpent { amount currencyCode }
        emailMarketingConsent { marketingState }
        lastOrder { id name createdAt }
      }
    }
  }
`;

export const CUSTOMER_DETAIL_QUERY = `#graphql
  query CreditLoopCustomerDetail($id: ID!) {
    customer(id: $id) {
      id
      displayName
      email
      numberOfOrders
      createdAt
      amountSpent { amount currencyCode }
      emailMarketingConsent { marketingState }
      lastOrder { id name createdAt }
      storeCreditAccounts(first: 10) {
        nodes { id balance { amount currencyCode } }
      }
      orders(first: 10, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id
          name
          createdAt
          totalPriceSet { shopMoney { amount currencyCode } }
        }
      }
    }
  }
`;

// --- Billing ----------------------------------------------------------------

export const CURRENT_SUBSCRIPTION_QUERY = `#graphql
  query CreditLoopCurrentSubscription {
    currentAppInstallation {
      id
      activeSubscriptions {
        id
        name
        status
        trialDays
        currentPeriodEnd
        lineItems { plan { pricingDetails { ... on AppRecurringPricing { price { amount currencyCode } interval } } } }
      }
    }
  }
`;

export const APP_SUBSCRIPTION_CREATE_MUTATION = `#graphql
  mutation CreditLoopSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $trialDays: Int
    $test: Boolean
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
      lineItems: $lineItems
    ) {
      appSubscription { id status }
      confirmationUrl
      userErrors { field message }
    }
  }
`;

export const APP_SUBSCRIPTION_CANCEL_MUTATION = `#graphql
  mutation CreditLoopSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription { id status }
      userErrors { field message }
    }
  }
`;

// --- Webhooks ---------------------------------------------------------------

export const WEBHOOK_SUBSCRIPTION_CREATE_MUTATION = `#graphql
  mutation CreditLoopWebhookCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription { id topic }
      userErrors { field message }
    }
  }
`;

export const WEBHOOK_SUBSCRIPTIONS_QUERY = `#graphql
  query CreditLoopWebhooks {
    webhookSubscriptions(first: 50) {
      nodes { id topic endpoint { ... on WebhookHttpEndpoint { callbackUrl } } }
    }
  }
`;
