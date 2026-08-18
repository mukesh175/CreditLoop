import prisma from '@/lib/prisma/client';
import { adminGraphql, assertNoUserErrors } from '@/lib/shopify/graphql';
import {
  CUSTOMER_STORE_CREDIT_QUERY,
  STORE_CREDIT_ACCOUNT_QUERY,
  STORE_CREDIT_ACCOUNT_CREDIT_MUTATION,
  STORE_CREDIT_ACCOUNT_DEBIT_MUTATION,
} from '@/lib/shopify/queries';
import { AppError, ValidationError } from '@/lib/util/errors';
import { assertSameCurrency, isPositiveAmount, round2 } from '@/lib/util/money';
import { withIdempotency } from '@/lib/util/idempotency';
import { recordAudit, AUDIT } from '@/lib/util/audit';
import { requestId as newRequestId } from '@/lib/util/crypto';

/**
 * Reads the authoritative balance from Shopify.
 *
 * A customer may hold one account per currency. We never merge them — callers
 * pick the account matching the currency they are working in.
 */
export async function getCustomerStoreCredit(session, customerGid, { transactions = 20 } = {}) {
  const { data } = await adminGraphql(session, CUSTOMER_STORE_CREDIT_QUERY, {
    customerId: customerGid,
    transactions,
  });
  const customer = data?.customer;
  if (!customer) return null;

  const accounts = (customer.storeCreditAccounts?.nodes || []).map((account) => ({
    id: account.id,
    balance: Number(account.balance?.amount || 0),
    currencyCode: account.balance?.currencyCode,
    transactions: (account.transactions?.nodes || []).map(normalizeTransaction),
  }));

  return {
    customerGid: customer.id,
    displayName: customer.displayName,
    orderCount: customer.numberOfOrders ? Number(customer.numberOfOrders) : 0,
    lifetimeValue: Number(customer.amountSpent?.amount || 0),
    lifetimeValueCurrency: customer.amountSpent?.currencyCode,
    accounts,
  };
}

function normalizeTransaction(node) {
  const amount = Number(node.amount?.amount || 0);
  // Shopify reports debits as negative amounts on the account.
  const isDebit = amount < 0 || node.__typename === 'StoreCreditAccountDebitTransaction';
  return {
    id: node.id,
    createdAt: node.createdAt,
    amount: Math.abs(amount),
    signedAmount: amount,
    currencyCode: node.amount?.currencyCode,
    type: isDebit ? 'DEBIT' : 'CREDIT',
    balanceAfter: node.balanceAfterTransaction
      ? Number(node.balanceAfterTransaction.amount)
      : null,
    expiresAt: node.expiresAt || null,
  };
}

/** Picks the account for a currency; returns null when the customer has none yet. */
export function selectAccountForCurrency(creditProfile, currencyCode) {
  if (!creditProfile) return null;
  const code = String(currencyCode).toUpperCase();
  return (
    creditProfile.accounts.find((a) => String(a.currencyCode).toUpperCase() === code) || null
  );
}

export async function getStoreCreditAccount(session, accountGid, { transactions = 50 } = {}) {
  const { data } = await adminGraphql(session, STORE_CREDIT_ACCOUNT_QUERY, {
    id: accountGid,
    transactions,
  });
  const account = data?.storeCreditAccount;
  if (!account) return null;
  return {
    id: account.id,
    balance: Number(account.balance?.amount || 0),
    currencyCode: account.balance?.currencyCode,
    ownerGid: account.owner?.id || null,
    ownerName: account.owner?.displayName || null,
    transactions: (account.transactions?.nodes || []).map(normalizeTransaction),
  };
}

/**
 * Issues native Shopify store credit.
 *
 * Money is created in Shopify and nowhere else; the CreditEvent row written here
 * is an analytics/audit record, never a balance.
 *
 * Every call must supply an `idempotencyKey`. If Shopify errors we do NOT retry
 * the mutation — the caller is told to verify before trying again, because a
 * blind retry is how duplicate credit gets created.
 */
export async function issueStoreCredit({
  shop,
  session,
  customerGid,
  amount,
  currencyCode,
  reason,
  source = 'MANUAL',
  expiresAt = null,
  campaignId = null,
  ruleId = null,
  orderGid = null,
  refundGid = null,
  returnEventId = null,
  bonusAmount = null,
  idempotencyKey,
  actorId = null,
  metadata = null,
}) {
  if (!customerGid) throw new ValidationError('A customer is required to issue store credit.');
  if (!isPositiveAmount(amount)) {
    throw new ValidationError('Store credit amount must be greater than zero.');
  }
  if (!currencyCode) throw new ValidationError('A currency code is required.');
  if (!idempotencyKey) {
    throw new ValidationError('An idempotency key is required for every credit issuance.');
  }

  const code = String(currencyCode).toUpperCase();
  const value = round2(amount);
  const reqId = newRequestId();

  const { replayed, result } = await withIdempotency(
    {
      shopId: shop.id,
      key: idempotencyKey,
      operation: 'ISSUE_CREDIT',
      requestPayload: { customerGid, amount: value, currencyCode: code },
    },
    async () => {
      // Resolve the account for this currency. `storeCreditAccountCredit` accepts
      // either an account id or a customer id; passing the customer id lets
      // Shopify create the currency account on first credit.
      const profile = await getCustomerStoreCredit(session, customerGid, { transactions: 1 });
      if (!profile) throw new ValidationError('That customer no longer exists in Shopify.');
      const existingAccount = selectAccountForCurrency(profile, code);
      const targetId = existingAccount?.id || customerGid;

      if (existingAccount) assertSameCurrency(existingAccount.currencyCode, code);

      const creditInput = {
        creditAmount: { amount: value.toFixed(2), currencyCode: code },
      };
      if (expiresAt) creditInput.expiresAt = new Date(expiresAt).toISOString();

      const { data } = await adminGraphql(
        session,
        STORE_CREDIT_ACCOUNT_CREDIT_MUTATION,
        { id: targetId, creditInput },
        { retryOnThrottle: false } // financial mutation: never auto-retry
      );

      const payload = data?.storeCreditAccountCredit;
      assertNoUserErrors(payload?.userErrors, 'Store credit was not issued.');

      const txn = payload?.storeCreditAccountTransaction;
      if (!txn?.id) {
        throw new AppError('Shopify did not confirm the store credit transaction.', {
          code: 'CREDIT_UNCONFIRMED',
          status: 502,
        });
      }

      const accountId = txn.account?.id || existingAccount?.id || null;
      const balanceAfter = txn.account?.balance
        ? Number(txn.account.balance.amount)
        : null;

      // Analytics/audit record — explicitly not a balance.
      await prisma.creditEvent.create({
        data: {
          shopId: shop.id,
          customerGid,
          shopifyStoreCreditAccountId: accountId,
          shopifyTransactionId: txn.id,
          eventType: 'CREDIT',
          amount: value,
          currencyCode: code,
          source,
          orderGid,
          refundGid,
          campaignId,
          ruleId,
          returnEventId,
          bonusAmount,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          metadata: metadata || undefined,
        },
      });

      if (accountId && balanceAfter != null) {
        await upsertBalanceSnapshot({
          shopId: shop.id,
          customerGid,
          accountId,
          balance: balanceAfter,
          currencyCode: code,
          lastCreditAt: new Date(),
        });
      }

      return {
        transactionId: txn.id,
        accountId,
        amount: value,
        currencyCode: code,
        balanceAfter,
      };
    }
  ).catch(async (error) => {
    await recordAudit({
      shopId: shop.id,
      action: AUDIT.CREDIT_ISSUED,
      actorId,
      customerGid,
      orderGid,
      amount: value,
      currencyCode: code,
      requestId: reqId,
      result: 'FAILURE',
      errorMessage: error?.message,
      reason,
      metadata: { source, campaignId, ruleId },
    });
    throw error;
  });

  if (!replayed) {
    await recordAudit({
      shopId: shop.id,
      action: AUDIT.CREDIT_ISSUED,
      actorId,
      customerGid,
      orderGid,
      amount: value,
      currencyCode: code,
      shopifyTransactionId: result.transactionId,
      requestId: reqId,
      reason,
      metadata: { source, campaignId, ruleId, bonusAmount },
    });
  }

  return { ...result, replayed };
}

/**
 * Debits store credit.
 *
 * Deliberately NOT exposed as a free-form merchant action. Only workflows that
 * genuinely require it (e.g. reversing a credit CreditLoop itself issued in
 * error) may call this, and every call is audited.
 */
export async function debitStoreCredit({
  shop,
  session,
  customerGid,
  accountGid,
  amount,
  currencyCode,
  reason,
  idempotencyKey,
  actorId = null,
  relatedCreditEventId = null,
}) {
  if (!accountGid) throw new ValidationError('A store credit account is required.');
  if (!isPositiveAmount(amount)) throw new ValidationError('Debit amount must be greater than zero.');
  if (!reason) throw new ValidationError('A reason is required for every store credit debit.');
  if (!idempotencyKey) throw new ValidationError('An idempotency key is required.');

  const code = String(currencyCode).toUpperCase();
  const value = round2(amount);

  const account = await getStoreCreditAccount(session, accountGid, { transactions: 1 });
  if (!account) throw new ValidationError('That store credit account no longer exists.');
  assertSameCurrency(account.currencyCode, code);
  if (value > account.balance) {
    throw new ValidationError(
      'The debit amount is larger than the available store credit balance in Shopify.'
    );
  }

  const { result } = await withIdempotency(
    {
      shopId: shop.id,
      key: idempotencyKey,
      operation: 'DEBIT_CREDIT',
      requestPayload: { accountGid, amount: value, currencyCode: code },
    },
    async () => {
      const { data } = await adminGraphql(
        session,
        STORE_CREDIT_ACCOUNT_DEBIT_MUTATION,
        {
          id: accountGid,
          debitInput: { debitAmount: { amount: value.toFixed(2), currencyCode: code } },
        },
        { retryOnThrottle: false }
      );
      const payload = data?.storeCreditAccountDebit;
      assertNoUserErrors(payload?.userErrors, 'Store credit was not debited.');
      const txn = payload?.storeCreditAccountTransaction;
      if (!txn?.id) {
        throw new AppError('Shopify did not confirm the debit transaction.', {
          code: 'DEBIT_UNCONFIRMED',
          status: 502,
        });
      }

      await prisma.creditEvent.create({
        data: {
          shopId: shop.id,
          customerGid,
          shopifyStoreCreditAccountId: accountGid,
          shopifyTransactionId: txn.id,
          eventType: 'DEBIT',
          amount: value,
          currencyCode: code,
          source: 'MANUAL',
          metadata: { reason, relatedCreditEventId },
        },
      });

      return { transactionId: txn.id, amount: value, currencyCode: code };
    }
  );

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.CREDIT_DEBITED,
    actorId,
    customerGid,
    amount: value,
    currencyCode: code,
    shopifyTransactionId: result.transactionId,
    reason,
  });

  return result;
}

/** Caches the authoritative balance for dashboard listings (always shown with syncedAt). */
export async function upsertBalanceSnapshot({
  shopId,
  customerGid,
  accountId,
  balance,
  currencyCode,
  lastCreditAt = null,
  lastDebitAt = null,
  expiresAt = null,
}) {
  const code = String(currencyCode).toUpperCase();
  return prisma.customerCreditSnapshot.upsert({
    where: { shopId_customerGid_currencyCode: { shopId, customerGid, currencyCode: code } },
    create: {
      shopId,
      customerGid,
      shopifyStoreCreditAccountId: accountId,
      balance: round2(balance),
      currencyCode: code,
      lastCreditAt,
      lastDebitAt,
      expiresAt,
      syncedAt: new Date(),
    },
    update: {
      shopifyStoreCreditAccountId: accountId,
      balance: round2(balance),
      syncedAt: new Date(),
      ...(lastCreditAt ? { lastCreditAt } : {}),
      ...(lastDebitAt ? { lastDebitAt } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    },
  });
}
