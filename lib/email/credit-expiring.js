import { renderLayout, escapeHtml } from './layout';
import { formatMoney } from '@/lib/util/money';

export function creditExpiringEmail({ storeName, storeUrl, balance, currencyCode, expiresAt, daysRemaining }) {
  const formatted = formatMoney(balance, currencyCode);
  const heading =
    daysRemaining <= 1
      ? 'Last chance to use your store credit'
      : `Your ${formatted} store credit expires soon`;
  const body = `
    <p>Your <strong>${escapeHtml(formatted)}</strong> in store credit expires on
      <strong>${escapeHtml(new Date(expiresAt).toLocaleDateString('en-US', { dateStyle: 'long' }))}</strong>${
        daysRemaining != null ? ` — that is ${escapeHtml(String(daysRemaining))} day(s) away` : ''
      }.</p>
    <p>It is applied automatically at checkout.</p>
  `;
  return {
    subject:
      daysRemaining <= 1
        ? 'Last chance to use your store credit'
        : 'Your store credit expires soon',
    html: renderLayout({ storeName, heading, body, ctaLabel: 'Shop now', ctaUrl: storeUrl }),
    text: `Your ${formatted} store credit at ${storeName} expires on ${new Date(expiresAt).toDateString()}. ${storeUrl || ''}`,
  };
}
