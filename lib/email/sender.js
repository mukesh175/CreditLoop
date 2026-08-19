import { RESEND_FROM_EMAIL } from '@/lib/config';

/**
 * Builds the From and Reply-To for a store's outgoing mail.
 *
 * The display name is the merchant's brand — their configured sender name, or
 * the store's own name. CreditLoop never puts itself in front of the customer,
 * and by default not in front of the merchant either.
 *
 * An important constraint on the address: providers only accept mail from a
 * domain you have verified. A merchant's own address cannot go in `From` —
 * that is spoofing, and SPF/DKIM/DMARC would reject the message or route it to
 * spam. So the brand appears as the display name, the envelope stays on the
 * verified sending domain, and `Reply-To` is the store's own email so replies
 * reach the merchant.
 *
 * To send from a merchant's real domain, verify that domain with Resend and
 * point RESEND_FROM_EMAIL at it for that deployment.
 */
export function buildSender(shop, { fromName = null, replyTo = null } = {}) {
  const configured = RESEND_FROM_EMAIL || '';
  if (!configured) return { from: null, replyTo: null, displayName: null };

  const address = extractAddress(configured);
  const displayName = resolveDisplayName(shop, fromName);

  return {
    from: `${quoteIfNeeded(displayName)} <${address}>`,
    replyTo: replyTo || shop?.email || null,
    displayName,
  };
}

/** Merchant's configured name → store name → store handle → a neutral fallback. */
export function resolveDisplayName(shop, fromName = null) {
  const candidates = [
    fromName,
    shop?.name,
    shop?.domain ? shop.domain.replace('.myshopify.com', '') : null,
  ];

  for (const candidate of candidates) {
    const cleaned = sanitize(candidate);
    if (cleaned) return cleaned;
  }
  return 'Store credit';
}

function extractAddress(value) {
  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
}

/** Strips anything that could inject a header, and bounds the length. */
function sanitize(name) {
  if (!name) return '';
  return String(name).replace(/[\r\n"<>]/g, '').trim().slice(0, 64);
}

function quoteIfNeeded(name) {
  return /[,;:@]/.test(name) ? `"${name}"` : name;
}
