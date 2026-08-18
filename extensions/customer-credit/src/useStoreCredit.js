import { useEffect, useState } from 'react';

/**
 * Reads the signed-in customer's store credit from the CreditLoop backend.
 *
 * The session token identifies the customer — we never send a customer id, since
 * anything the extension sends could be tampered with.
 */
export function useStoreCredit(sessionToken, appUrl) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await sessionToken.get();
        const response = await fetch(`${appUrl}/api/customer-account/credit`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.ok) {
          setState({ loading: false, error: json.error || 'Unavailable', data: null });
          return;
        }
        setState({ loading: false, error: null, data: json });
      } catch (error) {
        if (!cancelled) {
          setState({ loading: false, error: 'Store credit is temporarily unavailable.', data: null });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, appUrl]);

  return state;
}

export function formatAmount(amount, currencyCode, i18n) {
  try {
    return i18n.formatCurrency(Number(amount), { currency: currencyCode });
  } catch {
    return `${Number(amount).toFixed(2)} ${currencyCode}`;
  }
}
