/**
 * In-memory Shopify Store Credit stand-in.
 *
 * It behaves like the real API in the ways that matter for these tests: it holds
 * the authoritative balance, it returns a transaction id, and it records how
 * many times each mutation was called — which is how we prove a retry never
 * creates duplicate credit.
 */
let instanceCounter = 0;

export function createFakeShopify({ currencyCode = 'USD' } = {}) {
  // Unique per instance so transaction ids stay globally distinct, the way real
  // Shopify ids are.
  const instance = ++instanceCounter;
  const accounts = new Map(); // customerGid -> { id, balance, currencyCode, transactions }
  const orders = new Map();
  const calls = { credit: 0, debit: 0, refund: 0 };
  let txnCounter = 0;
  let failNextCredit = null;

  function ensureAccount(customerGid, code) {
    const key = `${customerGid}:${code}`;
    if (!accounts.has(key)) {
      accounts.set(key, {
        id: `gid://shopify/StoreCreditAccount/${instance}-${accounts.size + 1}`,
        customerGid,
        balance: 0,
        currencyCode: code,
        transactions: [],
      });
    }
    return accounts.get(key);
  }

  function accountsFor(customerGid) {
    return [...accounts.values()].filter((a) => a.customerGid === customerGid);
  }

  return {
    calls,
    accounts,
    failNextCreditWith(error) {
      failNextCredit = error;
    },
    seedOrder({
      id,
      name,
      customerGid,
      total,
      currencyCode: code = currencyCode,
      maximumRefundable,
    }) {
      const order = {
        id,
        name,
        createdAt: new Date().toISOString(),
        displayFinancialStatus: 'PAID',
        currencyCode: code,
        totalPriceSet: { shopMoney: { amount: String(total), currencyCode: code } },
        totalRefundedSet: { shopMoney: { amount: '0.00', currencyCode: code } },
        refundable: true,
        customer: {
          id: customerGid,
          displayName: 'John Smith',
          numberOfOrders: '7',
          amountSpent: { amount: '842.00', currencyCode: code },
        },
        lineItems: { nodes: [] },
        transactions: [
          {
            id: 'gid://shopify/OrderTransaction/1',
            kind: 'SALE',
            status: 'SUCCESS',
            gateway: 'shopify_payments',
            amountSet: { shopMoney: { amount: String(total), currencyCode: code } },
          },
        ],
        __maximumRefundable: maximumRefundable ?? total,
      };
      orders.set(id, order);
      return order;
    },
    balanceFor(customerGid, code = currencyCode) {
      return ensureAccount(customerGid, code).balance;
    },
    seedBalance(customerGid, amount, code = currencyCode) {
      const account = ensureAccount(customerGid, code);
      account.balance = amount;
      return account;
    },

    /** Stands in for lib/shopify/graphql.adminGraphql. */
    async adminGraphql(_session, query, variables) {
      if (query.includes('CreditLoopCustomerStoreCredit')) {
        const customerGid = variables.customerId;
        return {
          data: {
            customer: {
              id: customerGid,
              displayName: 'John Smith',
              numberOfOrders: '7',
              amountSpent: { amount: '842.00', currencyCode },
              storeCreditAccounts: {
                nodes: accountsFor(customerGid).map((account) => ({
                  id: account.id,
                  balance: { amount: String(account.balance), currencyCode: account.currencyCode },
                  transactions: { nodes: account.transactions.slice(-5).reverse() },
                })),
              },
            },
          },
        };
      }

      if (query.includes('CreditLoopIssueCredit')) {
        calls.credit += 1;
        if (failNextCredit) {
          const error = failNextCredit;
          failNextCredit = null;
          throw error;
        }
        const amount = Number(variables.creditInput.creditAmount.amount);
        const code = variables.creditInput.creditAmount.currencyCode;
        const customerGid = variables.id.includes('StoreCreditAccount')
          ? [...accounts.values()].find((a) => a.id === variables.id).customerGid
          : variables.id;
        const account = ensureAccount(customerGid, code);
        account.balance = Math.round((account.balance + amount) * 100) / 100;
        const txn = {
          id: `gid://shopify/StoreCreditAccountCreditTransaction/${instance}-${++txnCounter}`,
          createdAt: new Date().toISOString(),
          amount: { amount: String(amount), currencyCode: code },
          balanceAfterTransaction: { amount: String(account.balance), currencyCode: code },
          account: {
            id: account.id,
            balance: { amount: String(account.balance), currencyCode: code },
          },
        };
        account.transactions.push(txn);
        return { data: { storeCreditAccountCredit: { storeCreditAccountTransaction: txn, userErrors: [] } } };
      }

      if (query.includes('CreditLoopDebitCredit')) {
        calls.debit += 1;
        const amount = Number(variables.debitInput.debitAmount.amount);
        const account = [...accounts.values()].find((a) => a.id === variables.id);
        account.balance = Math.round((account.balance - amount) * 100) / 100;
        const txn = {
          id: `gid://shopify/StoreCreditAccountDebitTransaction/${instance}-${++txnCounter}`,
          createdAt: new Date().toISOString(),
          amount: { amount: String(-amount), currencyCode: account.currencyCode },
          balanceAfterTransaction: {
            amount: String(account.balance),
            currencyCode: account.currencyCode,
          },
          account: {
            id: account.id,
            balance: { amount: String(account.balance), currencyCode: account.currencyCode },
          },
        };
        account.transactions.push(txn);
        return { data: { storeCreditAccountDebit: { storeCreditAccountTransaction: txn, userErrors: [] } } };
      }

      if (query.includes('CreditLoopStoreCreditAccount')) {
        const account = [...accounts.values()].find((a) => a.id === variables.id);
        if (!account) return { data: { storeCreditAccount: null } };
        return {
          data: {
            storeCreditAccount: {
              id: account.id,
              balance: { amount: String(account.balance), currencyCode: account.currencyCode },
              owner: { id: account.customerGid, displayName: 'John Smith' },
              transactions: { nodes: account.transactions.slice().reverse() },
            },
          },
        };
      }

      if (query.includes('CreditLoopOrderForRefund')) {
        const order = orders.get(variables.id);
        return { data: { order: order || null } };
      }

      if (query.includes('CreditLoopSuggestedRefund')) {
        const order = orders.get(variables.orderId);
        if (!order) return { data: { order: null } };
        const refundable = order.__maximumRefundable ?? Number(order.totalPriceSet.shopMoney.amount);
        return {
          data: {
            order: {
              id: order.id,
              name: order.name,
              currencyCode: order.currencyCode,
              suggestedRefund: {
                amountSet: { shopMoney: { amount: String(refundable), currencyCode: order.currencyCode } },
                maximumRefundableSet: {
                  shopMoney: { amount: String(refundable), currencyCode: order.currencyCode },
                },
                subtotalSet: { shopMoney: { amount: String(refundable), currencyCode: order.currencyCode } },
                totalTaxSet: { shopMoney: { amount: '0.00', currencyCode: order.currencyCode } },
                suggestedTransactions: [],
              },
            },
          },
        };
      }

      if (query.includes('CreditLoopRefundCreate')) {
        calls.refund += 1;
        const input = variables.input;
        const order = orders.get(input.orderId);
        // A store-credit refund moves the refunded amount into the customer's
        // native Shopify store credit account, exactly as Shopify does.
        const storeCredit = input.refundMethods?.[0]?.storeCreditRefund;
        if (storeCredit) {
          const amount = Number(storeCredit.amount.amount);
          const account = ensureAccount(order.customer.id, storeCredit.amount.currencyCode);
          account.balance = Math.round((account.balance + amount) * 100) / 100;
        }
        return {
          data: {
            refundCreate: {
              refund: {
                id: `gid://shopify/Refund/${instance}-${++txnCounter}`,
                createdAt: new Date().toISOString(),
                totalRefundedSet: {
                  shopMoney: {
                    amount: storeCredit?.amount.amount || '0.00',
                    currencyCode: order.currencyCode,
                  },
                },
                order: { id: order.id, name: order.name },
              },
              userErrors: [],
            },
          },
        };
      }

      throw new Error(`Unhandled query in fake Shopify: ${query.slice(0, 60)}`);
    },
  };
}
