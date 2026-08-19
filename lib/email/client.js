import { Resend } from 'resend';
import prisma from '@/lib/prisma/client';
import { RESEND_API_KEY, RESEND_FROM_EMAIL } from '@/lib/config';
import { hashRecipient } from '@/lib/util/crypto';
import { buildSender } from './sender';

let resendClient = null;
function getResend() {
  if (!RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

/**
 * Sends one email and logs the outcome.
 *
 * We log a hash of the recipient, never the address itself — CreditLoop has no
 * reason to keep a permanent copy of customer emails (see README → data
 * minimization). Addresses are fetched from Shopify at send time and discarded.
 *
 * `dedupeKey` makes sending idempotent, so a retried cron run cannot email the
 * same customer twice.
 */
export async function sendEmail({
  shopId,
  shop = null,
  to,
  subject,
  html,
  text,
  audience = 'CUSTOMER',
  template,
  customerGid = null,
  campaignId = null,
  dedupeKey = null,
  replyTo = null,
  fromName = null,
}) {
  // The merchant's brand appears as the sender; replies go to the store.
  const sender = buildSender(shop, { fromName, replyTo });
  const fromHeader = sender.from || RESEND_FROM_EMAIL;
  const replyToHeader = sender.replyTo;
  if (dedupeKey) {
    const existing = await prisma.notificationLog.findUnique({
      where: { shopId_dedupeKey: { shopId, dedupeKey } },
    });
    if (existing) return { skipped: true, reason: 'ALREADY_SENT', log: existing };
  }

  const log = await prisma.notificationLog.create({
    data: {
      shopId,
      audience,
      template,
      channel: 'EMAIL',
      recipientHash: to ? hashRecipient(to) : null,
      customerGid,
      campaignId,
      dedupeKey,
      status: 'QUEUED',
    },
  });

  const resend = getResend();
  if (!resend || !RESEND_FROM_EMAIL) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'SKIPPED', error: 'Email delivery is not configured for this store.' },
    });
    return { skipped: true, reason: 'NOT_CONFIGURED', log };
  }

  try {
    const response = await resend.emails.send({
      from: fromHeader,
      to,
      subject,
      html,
      text,
      ...(replyToHeader ? { replyTo: replyToHeader } : {}),
    });
    if (response.error) throw new Error(response.error.message || 'Resend rejected the message.');

    const updated = await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'SENT', messageId: response.data?.id || null, sentAt: new Date() },
    });
    return { sent: true, messageId: response.data?.id, log: updated };
  } catch (error) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: String(error?.message || error).slice(0, 500) },
    });
    return { sent: false, error: String(error?.message || error), log };
  }
}
