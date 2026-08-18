import { useEffect, useState } from 'preact/hooks';

/**
 * Reads the signed-in customer's store credit from the CreditLoop backend.
 *
 * The session token identifies the customer — we never send a customer id,
 * since anything the extension sends could be tampered with. A fresh token is
 * requested per call, as Shopify's tokens are short-lived.
 */
export function useStoreCredit({ sessionToken, appUrl }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!appUrl) {
        setState({ loading: false, error: 'Store credit is unavailable.', data: null });
        return;
      }
      try {
        const token = await sessionToken.get();
        const response = await fetch(`${appUrl}/api/customer-account/credit`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.ok) {
          setState({
            loading: false,
            error: json?.error || 'Store credit is temporarily unavailable.',
            data: null,
          });
          return;
        }
        setState({ loading: false, error: null, data: json });
      } catch {
        if (!cancelled) {
          setState({
            loading: false,
            error: 'Store credit is temporarily unavailable.',
            data: null,
          });
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

/** The extension is served from the app's own domain, so its origin is the API host. */
export function appOriginFrom(extension) {
  try {
    return new URL(extension.scriptUrl).origin;
  } catch {
    return null;
  }
}

export function formatAmount(amount, currencyCode, i18n) {
  try {
    return i18n.formatCurrency(Number(amount), { currency: currencyCode });
  } catch {
    return `${Number(amount).toFixed(2)} ${currencyCode}`;
  }
}

export function formatDate(value, i18n) {
  try {
    return i18n.formatDate(new Date(value), { dateStyle: 'medium' });
  } catch {
    return new Date(value).toLocaleDateString();
  }
}
