import { renderLayout, escapeHtml } from './layout';
import { formatMoney } from '@/lib/util/money';

export function creditIssuedEmail({ storeName, storeUrl, amount, currencyCode, expiresAt, reason }) {
  const formatted = formatMoney(amount, currencyCode);
  const body = `
    <p>Good news — <strong>${escapeHtml(formatted)}</strong> in store credit has been added to your account.</p>
    <p>It is applied automatically at checkout, so there is no code to remember.</p>
    ${reason ? `<p style="color:#5b6b66;">${escapeHtml(reason)}</p>` : ''}
    ${
      expiresAt
        ? `<p style="color:#8a5a00;">Use it before <strong>${escapeHtml(
            new Date(expiresAt).toLocaleDateString('en-US', { dateStyle: 'long' })
          )}</strong>.</p>`
        : ''
    }
  `;
  return {
    subject: 'Your store credit is ready',
    html: renderLayout({
      storeName,
      heading: `You have ${formatted} in store credit`,
      body,
      ctaLabel: 'Shop now',
      ctaUrl: storeUrl,
    }),
    text: `You have ${formatted} in store credit at ${storeName}. It is applied automatically at checkout. ${storeUrl || ''}`,
  };
}
