import { BRAND } from '@/lib/config';

/**
 * Customer-facing emails are sent on behalf of the merchant's store. CreditLoop
 * is not the brand in front of the customer — the store is.
 */
export function renderLayout({ storeName, heading, body, ctaLabel, ctaUrl, footerNote }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f8f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6eae8;border-radius:14px;overflow:hidden;">
          <tr><td style="padding:28px 32px 8px 32px;">
            <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5b6b66;">${escapeHtml(storeName || 'Your store')}</div>
            <h1 style="margin:10px 0 0 0;font-size:24px;line-height:1.3;color:#0b1f17;">${escapeHtml(heading)}</h1>
          </td></tr>
          <tr><td style="padding:12px 32px 4px 32px;font-size:15px;line-height:1.6;color:#33413c;">${body}</td></tr>
          ${
            ctaUrl
              ? `<tr><td style="padding:20px 32px 32px 32px;">
                  <a href="${escapeAttr(ctaUrl)}" style="display:inline-block;background:#0f9d58;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;">${escapeHtml(ctaLabel || 'Shop now')}</a>
                </td></tr>`
              : ''
          }
          <tr><td style="padding:16px 32px 26px 32px;border-top:1px solid #eef1f0;font-size:12px;line-height:1.6;color:#7b8b85;">
            ${footerNote ? `${escapeHtml(footerNote)}<br/>` : ''}
            You are receiving this email because you have store credit with ${escapeHtml(storeName || 'this store')}.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Merchant-facing emails. The brand shown is the merchant's own, falling back
 * to CreditLoop only when no store name is available.
 */
export function renderMerchantLayout({ heading, body, brandName = null }) {
  return renderLayout({
    storeName: brandName || BRAND.name,
    heading,
    body,
    footerNote: BRAND.tagline,
  });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
