import { RESEND_FROM_EMAIL } from '@/lib/config';

/**
 * Builds the From and Reply-To for a store's outgoing mail.
 *
 * An important constraint: email providers only let you send from a domain you
 * have verified. CreditLoop cannot put a merchant's own address in `From` —
 * that is spoofing, and SPF/DKIM/DMARC would either reject the message or land
 * it in spam.
 *
 * What we do instead gives the merchant's identity everywhere it can appear:
 *   - the *display name* is the store's name, so the inbox shows "Acme Store"
 *   - the envelope address stays on the verified sending domain
 *   - `Reply-To` is the store's own email, so replies reach the merchant
 *
 * To send from the merchant's actual domain, verify that domain with Resend and
 * set RESEND_FROM_EMAIL accordingly per deployment.
 */
export function buildSender(shop, { audience = 'CUSTOMER' } = {}) {
  const fallback = RESEND_FROM_EMAIL || '';
  if (!fallback) return { from: null, replyTo: null };

  const address = extractAddress(fallback);
  const storeName = (shop?.name || shop?.domain?.replace('.myshopify.com', '') || '').trim();

  // Merchant-facing mail is from CreditLoop; customer-facing mail is from the
  // merchant's store, because that is who the customer bought from.
  const displayName =
    audience === 'MERCHANT' ? 'CreditLoop' : storeName || 'Store credit';

  return {
    from: `${sanitizeDisplayName(displayName)} <${address}>`,
    replyTo: shop?.email || null,
  };
}

function extractAddress(value) {
  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
}

/** Quotes/strips anything that would break the header. */
function sanitizeDisplayName(name) {
  const cleaned = String(name).replace(/[\r\n"<>]/g, '').trim().slice(0, 64);
  return /[,;:@]/.test(cleaned) ? `"${cleaned}"` : cleaned;
}
