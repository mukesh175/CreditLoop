import prisma from '@/lib/prisma/client';
import { getCustomerStoreCredit } from './store-credit';
import { round2 } from '@/lib/util/money';
import { recordAudit, AUDIT } from '@/lib/util/audit';
import { isDemoGid } from '@/lib/demo/identifiers';

/**
 * Reconciliation.
 *
 * Compares what CreditLoop's analytics ledger would imply against the balance
 * Shopify actually holds, and reports differences.
 *
 * It NEVER writes to Shopify to "fix" a mismatch. A difference is a signal that
 * something happened outside CreditLoop (a manual admin credit, a Flow action,
 * another app) — that is legitimate, and silently reconciling it would mean an
 * app moving a customer's money without anyone asking. We log and warn instead.
 */
export async function reconcileShop({ shop, session, limit = 100, toleranceMinor = 1 }) {
  const customers = await prisma.creditEvent.findMany({
    where: { shopId: shop.id },
    distinct: ['customerGid'],
    select: { customerGid: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  const results = { checked: 0, matched: 0, mismatched: 0, errors: 0 };

  for (const { customerGid } of customers) {
    // Demo records have no Shopify balance, so there is nothing to reconcile
    // against — including them would manufacture false mismatches.
    if (isDemoGid(customerGid)) continue;

    try {
      const profile = await getCustomerStoreCredit(session, customerGid, { transactions: 1 });
      if (!profile) continue;

      // Group our own ledger by currency — never across currencies.
      const events = await prisma.creditEvent.findMany({
        where: { shopId: shop.id, customerGid },
        select: { amount: true, currencyCode: true, eventType: true },
      });
      const expectedByCurrency = {};
      for (const e of events) {
        const code = e.currencyCode.toUpperCase();
        const delta = e.eventType === 'CREDIT' ? Number(e.amount) : -Number(e.amount);
        expectedByCurrency[code] = round2((expectedByCurrency[code] || 0) + delta);
      }

      const currencies = new Set([
        ...Object.keys(expectedByCurrency),
        ...profile.accounts.map((a) => String(a.currencyCode).toUpperCase()),
      ]);

      for (const currencyCode of currencies) {
        const account = profile.accounts.find(
          (a) => String(a.currencyCode).toUpperCase() === currencyCode
        );
        const shopifyBalance = round2(account?.balance || 0);

        // Redemptions we have attributed are already reflected in Shopify's
        // balance, so subtract them from the expected figure.
        const redeemed = await prisma.creditAttribution.aggregate({
          where: { shopId: shop.id, currencyCode, creditEvent: { customerGid } },
          _sum: { amountAttributed: true },
        });
        const expected = round2(
          (expectedByCurrency[currencyCode] || 0) - Number(redeemed._sum.amountAttributed || 0)
        );

        const difference = round2(shopifyBalance - expected);
        results.checked += 1;

        if (Math.abs(difference) * 100 <= toleranceMinor) {
          results.matched += 1;
          await prisma.reconciliationRecord.updateMany({
            where: { shopId: shop.id, customerGid, currencyCode, status: 'OPEN' },
            data: { status: 'RESOLVED', note: 'Balance matched on a later run.' },
          });
          continue;
        }

        results.mismatched += 1;
        await prisma.reconciliationRecord.create({
          data: {
            shopId: shop.id,
            customerGid,
            shopifyStoreCreditAccountId: account?.id || null,
            shopifyBalance,
            expectedFromEvents: expected,
            difference,
            currencyCode,
            status: 'OPEN',
            note:
              'Review required. CreditLoop did not modify the Shopify balance — a difference usually means credit was issued or spent outside CreditLoop.',
          },
        });
        await recordAudit({
          shopId: shop.id,
          action: AUDIT.RECONCILIATION_MISMATCH,
          actorType: 'SYSTEM',
          customerGid,
          amount: difference,
          currencyCode,
          result: 'FAILURE',
          reason: 'Reconciliation difference detected',
          metadata: { shopifyBalance, expected },
        });
      }
    } catch (error) {
      results.errors += 1;
    }
  }

  return results;
}
