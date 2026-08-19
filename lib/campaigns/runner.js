import prisma from '@/lib/prisma/client';
import { resolveSegment } from '@/lib/analytics/segments';
import { getCustomerContact, checkCampaignEligibility } from './consent';
import { getEntitlements, requireFeature } from '@/lib/billing/entitlements';
import { issueStoreCredit } from '@/lib/credit/store-credit';
import { campaignCreditKey } from '@/lib/util/idempotency';
import { sendEmail } from '@/lib/email/client';
import { creditReminderEmail } from '@/lib/email/credit-reminder';
import { creditExpiringEmail } from '@/lib/email/credit-expiring';
import { winBackEmail } from '@/lib/email/win-back';
import { creditIssuedEmail } from '@/lib/email/credit-issued';
import { recordAudit, AUDIT } from '@/lib/util/audit';
import { round2 } from '@/lib/util/money';

const TEMPLATES = {
  'credit-reminder': creditReminderEmail,
  'credit-expiring': creditExpiringEmail,
  'win-back': winBackEmail,
  'credit-issued': creditIssuedEmail,
};

function defaultTemplateFor(type) {
  if (type === 'WIN_BACK') return 'win-back';
  if (type === 'VIP') return 'credit-issued';
  return 'credit-reminder';
}

function defaultSegmentFor(campaign) {
  if (campaign.segment) return campaign.segment;
  if (campaign.type === 'WIN_BACK') return 'UNUSED_CREDIT';
  if (campaign.type === 'VIP') return 'HIGH_VALUE';
  return 'CREDIT_HOLDERS';
}

/**
 * Runs one campaign over a bounded batch of recipients.
 *
 * Batching keeps each serverless invocation well inside its time budget; the
 * cron re-enters until the segment is exhausted. Every step is idempotent, so a
 * retried invocation neither double-credits nor double-emails.
 */
export async function runCampaign({ shop, session, campaign, batchSize = 50, storeUrl }) {
  const entitlements = await getEntitlements(shop);
  if (campaign.grantsCredit || campaign.sendsEmail) {
    await requireFeature(shop, 'automatedCampaigns');
  }

  await prisma.campaignEvent.create({
    data: { campaignId: campaign.id, shopId: shop.id, type: 'RUN_STARTED' },
  });

  const currencyCode = campaign.currencyCode || shop.currencyCode;
  // One lookup per run — the sender name is the same for every recipient.
  const prefs = await prisma.notificationPreference.findUnique({ where: { shopId: shop.id } });
  const { customers } = await resolveSegment({
    shopId: shop.id,
    segment: defaultSegmentFor(campaign),
    currencyCode,
    options: {
      minBalance: campaign.minBalance ?? 100,
      inactiveDays: campaign.minDaysInactive ?? 30,
      minLifetimeValue: campaign.minLifetimeValue ?? 500,
    },
    take: batchSize,
  });

  const summary = { considered: customers.length, sent: 0, skipped: 0, credited: 0, failed: 0 };

  for (const customer of customers) {
    // Skip anyone this campaign has already processed.
    const existing = await prisma.campaignRecipient.findUnique({
      where: { campaignId_customerGid: { campaignId: campaign.id, customerGid: customer.customerGid } },
    });
    if (existing && existing.status !== 'PENDING') continue;

    const contact = await getCustomerContact(session, customer.customerGid).catch(() => null);
    const eligibility = checkCampaignEligibility({ campaign, contact, entitlements });

    if (!eligibility.allowed) {
      summary.skipped += 1;
      await upsertRecipient(campaign, shop, customer.customerGid, {
        status: 'SKIPPED',
        skipReason: eligibility.reason,
      });
      continue;
    }

    let grantedAmount = null;
    try {
      if (campaign.grantsCredit && campaign.grantValue) {
        grantedAmount = computeGrant(campaign, customer);
        if (grantedAmount > 0) {
          await issueStoreCredit({
            shop,
            session,
            customerGid: customer.customerGid,
            amount: grantedAmount,
            currencyCode,
            reason: `Campaign: ${campaign.name}`,
            source: 'CAMPAIGN',
            campaignId: campaign.id,
            expiresAt: campaign.grantExpiresInDays
              ? new Date(Date.now() + campaign.grantExpiresInDays * 86_400_000)
              : null,
            idempotencyKey: campaignCreditKey({
              campaignId: campaign.id,
              customerGid: customer.customerGid,
            }),
            actorId: 'campaign-runner',
          });
          summary.credited += 1;
        }
      }

      if (campaign.sendsEmail) {
        const templateName = campaign.emailTemplate || defaultTemplateFor(campaign.type);
        const build = TEMPLATES[templateName] || creditReminderEmail;
        const message = build({
          storeName: prefs?.emailFromName || shop.name || shop.domain,
          storeUrl: storeUrl || `https://${shop.domain}`,
          balance: round2((customer.balance || 0) + (grantedAmount || 0)),
          amount: grantedAmount || customer.balance,
          currencyCode,
          daysUnused: customer.creditAgeDays,
          expiresAt: customer.expiresAt,
          daysRemaining: customer.expiresAt
            ? Math.max(
                0,
                Math.floor((new Date(customer.expiresAt) - Date.now()) / 86_400_000)
              )
            : null,
          grantedAmount,
        });

        const result = await sendEmail({
          shopId: shop.id,
          shop,
          fromName: prefs?.emailFromName || null,
          to: contact.email,
          subject: message.subject,
          html: message.html,
          text: message.text,
          audience: 'CUSTOMER',
          template: templateName,
          customerGid: customer.customerGid,
          campaignId: campaign.id,
          dedupeKey: `campaign:${campaign.id}:${customer.customerGid}`,
        });

        if (result.sent) summary.sent += 1;
        else if (result.skipped) summary.skipped += 1;
        else summary.failed += 1;
      }

      await upsertRecipient(campaign, shop, customer.customerGid, {
        status: 'SENT',
        creditIssued: grantedAmount,
        currencyCode,
        sentAt: new Date(),
      });
    } catch (error) {
      summary.failed += 1;
      await upsertRecipient(campaign, shop, customer.customerGid, {
        status: 'FAILED',
        skipReason: String(error?.message || error).slice(0, 200),
      });
      await prisma.campaignEvent.create({
        data: {
          campaignId: campaign.id,
          shopId: shop.id,
          type: 'ERROR',
          message: String(error?.message || error).slice(0, 500),
        },
      });
    }
  }

  await prisma.creditCampaign.update({
    where: { id: campaign.id },
    data: { lastRunAt: new Date() },
  });
  await prisma.campaignEvent.create({
    data: {
      campaignId: campaign.id,
      shopId: shop.id,
      type: 'RUN_COMPLETED',
      metadata: summary,
    },
  });
  await recordAudit({
    shopId: shop.id,
    action: AUDIT.CAMPAIGN_RUN,
    actorType: 'SYSTEM',
    reason: campaign.name,
    metadata: summary,
  });

  return summary;
}

function computeGrant(campaign, customer) {
  let amount =
    campaign.grantType === 'PERCENTAGE'
      ? ((customer.lifetimeValue || 0) * Number(campaign.grantValue)) / 100
      : Number(campaign.grantValue);
  if (campaign.grantMaxAmount != null) amount = Math.min(amount, Number(campaign.grantMaxAmount));
  return round2(Math.max(0, amount));
}

function upsertRecipient(campaign, shop, customerGid, data) {
  return prisma.campaignRecipient.upsert({
    where: { campaignId_customerGid: { campaignId: campaign.id, customerGid } },
    create: { campaignId: campaign.id, shopId: shop.id, customerGid, ...data },
    update: data,
  });
}
