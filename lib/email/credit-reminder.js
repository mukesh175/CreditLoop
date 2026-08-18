import { renderLayout, escapeHtml } from './layout';
import { formatMoney } from '@/lib/util/money';

export function creditReminderEmail({ storeName, storeUrl, balance, currencyCode, daysUnused }) {
  const formatted = formatMoney(balance, currencyCode);
  const body = `
    <p>You still have <strong>${escapeHtml(formatted)}</strong> in store credit waiting for you${
      daysUnused ? ` — it has been sitting there for ${escapeHtml(String(daysUnused))} days` : ''
    }.</p>
    <p>It is applied automatically at checkout.</p>
  `;
  return {
    subject: 'You have store credit waiting for you',
    html: renderLayout({
      storeName,
      heading: `${formatted} is waiting for you`,
      body,
      ctaLabel: 'Shop now',
      ctaUrl: storeUrl,
    }),
    text: `You have ${formatted} in store credit waiting at ${storeName}. ${storeUrl || ''}`,
  };
}
