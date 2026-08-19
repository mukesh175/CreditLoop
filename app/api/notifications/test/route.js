import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { ValidationError } from '@/lib/util/errors';
import { sendEmail } from '@/lib/email/client';
import { buildSender } from '@/lib/email/sender';
import { creditIssuedEmail } from '@/lib/email/credit-issued';
import { creditReminderEmail } from '@/lib/email/credit-reminder';
import { creditExpiringEmail } from '@/lib/email/credit-expiring';
import { winBackEmail } from '@/lib/email/win-back';
import { weeklyReportEmail } from '@/lib/email/weekly-report';
import { APP_URL } from '@/lib/config';
import { recordAudit, AUDIT } from '@/lib/util/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sends a real email to the merchant so they can see exactly what a customer
 * would receive — sender name, reply-to, wording and layout — before enabling a
 * campaign that mails their customers.
 *
 * Always addressed to the merchant, never to a customer, and always with sample
 * figures. There is no way to use this to mail a real customer.
 */
const TEMPLATES = {
  'credit-issued': (shop, sample) =>
    creditIssuedEmail({ ...sample, reason: 'Return credit from order #1001' }),
  'credit-reminder': (shop, sample) => creditReminderEmail({ ...sample, daysUnused: 34 }),
  'credit-expiring': (shop, sample) =>
    creditExpiringEmail({
      ...sample,
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      daysRemaining: 7,
    }),
  'win-back': (shop, sample) => winBackEmail({ ...sample, grantedAmount: 15 }),
  'weekly-report': (shop) =>
    weeklyReportEmail({
      shopDomain: shop.domain,
      appUrl: APP_URL,
      metrics: {
        currencyCode: shop.currencyCode,
        creditIssued: 12400,
        creditRedeemed: 8820,
        ordersUsingCredit: 84,
        revenueFromCreditOrders: 14200,
        outstandingCredit: 9420,
        creditRedemptionRate: 71,
        topCampaign: 'Return Credit',
      },
    }),
};

export const POST = withErrorHandling(async (request) => {
  const { shop, userId } = await requireShop(request);
  const body = await readJson(request);

  const template = body.template || 'credit-reminder';
  const build = TEMPLATES[template];
  if (!build) throw new ValidationError(`"${template}" is not a CreditLoop email template.`);

  const prefs = await prisma.notificationPreference.findUnique({ where: { shopId: shop.id } });
  const recipient = (body.to || prefs?.merchantEmail || shop.email || '').trim();
  if (!recipient) {
    throw new ValidationError(
      'Add an email address in Settings → Notifications before sending a test.'
    );
  }

  const audience = template === 'weekly-report' ? 'MERCHANT' : 'CUSTOMER';
  const sample = {
    storeName: shop.name || shop.domain,
    storeUrl: `https://${shop.domain}`,
    amount: 110,
    balance: 110,
    currencyCode: shop.currencyCode,
  };

  const message = build(shop, sample);
  const sender = buildSender(shop, { audience });

  const result = await sendEmail({
    shopId: shop.id,
    shop,
    to: recipient,
    subject: `[Test] ${message.subject}`,
    html: message.html,
    text: message.text,
    audience: 'MERCHANT', // it goes to the merchant, whichever template it is
    template: `test:${template}`,
    // No dedupe key — a merchant may send as many tests as they like.
  });

  await recordAudit({
    shopId: shop.id,
    action: AUDIT.NOTIFICATION_SENT,
    actorId: userId,
    reason: `Test email sent: ${template}`,
    result: result.sent ? 'SUCCESS' : 'FAILURE',
    errorMessage: result.error || null,
  });

  if (result.skipped) {
    throw new ValidationError(
      result.reason === 'NOT_CONFIGURED'
        ? 'Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL for this deployment.'
        : 'The test email was not sent.'
    );
  }
  if (!result.sent) {
    throw new ValidationError(result.error || 'The test email could not be sent.');
  }

  return ok({
    sent: true,
    to: recipient,
    template,
    // Shown in the UI so the merchant can see how it will appear.
    sender: { from: sender.from, replyTo: sender.replyTo },
  });
});
