import { renderMerchantLayout, escapeHtml } from './layout';
import { formatMoney } from '@/lib/util/money';

export function largeCreditIssuedEmail({ shopDomain, amount, currencyCode, customerName, orderName }) {
  const body = `
    <p>A store credit of <strong>${escapeHtml(formatMoney(amount, currencyCode))}</strong> was issued${
      customerName ? ` to ${escapeHtml(customerName)}` : ''
    }${orderName ? ` for order ${escapeHtml(orderName)}` : ''}.</p>
    <p style="color:#5b6b66;">You are receiving this because large credit alerts are enabled for ${escapeHtml(shopDomain)}.</p>
  `;
  return {
    subject: `Large store credit issued — ${formatMoney(amount, currencyCode)}`,
    html: renderMerchantLayout({ heading: 'Large store credit issued', body }),
    text: `A store credit of ${formatMoney(amount, currencyCode)} was issued on ${shopDomain}.`,
  };
}

export function expiringCreditSummaryEmail({ shopDomain, amount, currencyCode, customerCount, days }) {
  const body = `
    <p><strong>${escapeHtml(formatMoney(amount, currencyCode))}</strong> in store credit across
      ${escapeHtml(String(customerCount))} customer(s) expires within ${escapeHtml(String(days))} days.</p>
  `;
  return {
    subject: 'Expiring store credit summary',
    html: renderMerchantLayout({ heading: 'Store credit expiring soon', body }),
    text: `${formatMoney(amount, currencyCode)} in store credit expires within ${days} days on ${shopDomain}.`,
  };
}
