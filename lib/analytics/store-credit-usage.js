import { round2 } from '@/lib/util/money';

/**
 * Reads store-credit usage from an order payload.
 *
 * Pure and I/O-free so it can be unit-tested directly — this function decides
 * how much of an order was paid with credit, which drives every attribution
 * figure in the app.
 */
export function extractStoreCreditUsed(orderPayload, currencyCode) {
  const isStoreCreditGateway = (gateway) => {
    const name = String(gateway || '').toLowerCase();
    return name.includes('store credit') || name === 'store_credit';
  };

  const transactions = orderPayload.transactions || [];
  const creditTransactions = transactions.filter((t) => isStoreCreditGateway(t.gateway));

  if (creditTransactions.length) {
    return round2(
      creditTransactions
        .filter((t) => t.status === 'success' && (t.kind === 'sale' || t.kind === 'capture'))
        .reduce((sum, t) => {
          // Never mix currencies into one total.
          const code = String(t.currency || currencyCode).toUpperCase();
          return code === String(currencyCode).toUpperCase() ? sum + Number(t.amount || 0) : sum;
        }, 0)
    );
  }

  const usesStoreCredit = (orderPayload.payment_gateway_names || []).some(isStoreCreditGateway);
  if (!usesStoreCredit) return 0;

  // Fall back to the order's own store-credit total when Shopify provides it.
  return round2(Number(orderPayload.current_total_store_credit || 0));
}
