import { renderMerchantLayout, escapeHtml } from './layout';
import { formatMoney, formatPercent } from '@/lib/util/money';

export function weeklyReportEmail({ shopDomain, metrics, appUrl }) {
  const row = (label, value) =>
    `<tr>
      <td style="padding:8px 0;color:#5b6b66;font-size:14px;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;text-align:right;font-weight:600;font-size:14px;">${escapeHtml(value)}</td>
    </tr>`;

  const c = metrics.currencyCode;
  const body = `
    <p style="color:#5b6b66;">Store credit performance for ${escapeHtml(shopDomain)}, last 7 days.</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:8px;">
      ${row('Credit issued', formatMoney(metrics.creditIssued, c))}
      ${row('Credit redeemed', formatMoney(metrics.creditRedeemed, c))}
      ${row('Orders using credit', String(metrics.ordersUsingCredit))}
      ${row('Revenue from orders using credit', formatMoney(metrics.revenueFromCreditOrders, c))}
      ${row('Outstanding credit', formatMoney(metrics.outstandingCredit, c))}
      ${row('Credit redemption rate', formatPercent(metrics.creditRedemptionRate))}
      ${metrics.topCampaign ? row('Top campaign', metrics.topCampaign) : ''}
      ${metrics.topSegment ? row('Best performing segment', metrics.topSegment) : ''}
    </table>
    <p style="margin-top:18px;font-size:13px;color:#7b8b85;">
      Revenue shown is from orders that used store credit. It is an observed association, not a causal claim.
    </p>
    <p style="margin-top:14px;"><a href="${escapeHtml(appUrl || '')}" style="color:#0f9d58;">Open CreditLoop</a></p>
  `;
  return {
    subject: `CreditLoop weekly report — ${shopDomain}`,
    html: renderMerchantLayout({ heading: 'Your weekly credit report', body }),
    text: `CreditLoop weekly report for ${shopDomain}: issued ${formatMoney(
      metrics.creditIssued,
      c
    )}, redeemed ${formatMoney(metrics.creditRedeemed, c)}, ${metrics.ordersUsingCredit} orders using credit.`,
  };
}
