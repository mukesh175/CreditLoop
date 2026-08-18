import { renderLayout, escapeHtml } from './layout';
import { formatMoney } from '@/lib/util/money';

export function winBackEmail({ storeName, storeUrl, balance, currencyCode, grantedAmount }) {
  const formatted = formatMoney(balance, currencyCode);
  const body = `
    <p>We have not seen you in a while.</p>
    ${
      grantedAmount
        ? `<p>We have added <strong>${escapeHtml(
            formatMoney(grantedAmount, currencyCode)
          )}</strong> in store credit to your account as a welcome back.</p>`
        : ''
    }
    <p>Your balance is <strong>${escapeHtml(formatted)}</strong>, applied automatically at checkout.</p>
  `;
  return {
    subject: 'Your store credit is waiting',
    html: renderLayout({
      storeName,
      heading: 'Your store credit is waiting',
      body,
      ctaLabel: 'Shop now',
      ctaUrl: storeUrl,
    }),
    text: `Your store credit balance at ${storeName} is ${formatted}. ${storeUrl || ''}`,
  };
}
