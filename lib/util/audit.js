import prisma from '@/lib/prisma/client';

/**
 * Appends to the immutable audit trail. Audit writes must never break the
 * operation they describe, so failures are logged and swallowed.
 */
export async function recordAudit({
  shopId,
  action,
  actorType = 'MERCHANT',
  actorId = null,
  customerGid = null,
  orderGid = null,
  amount = null,
  currencyCode = null,
  shopifyTransactionId = null,
  requestId = null,
  result = 'SUCCESS',
  errorMessage = null,
  reason = null,
  metadata = null,
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        shopId,
        action,
        actorType,
        actorId: actorId ? String(actorId) : null,
        customerGid,
        orderGid,
        amount,
        currencyCode,
        shopifyTransactionId,
        requestId,
        result,
        errorMessage: errorMessage ? String(errorMessage).slice(0, 1000) : null,
        reason,
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[creditloop] failed to write audit log', { action, shopId, error });
    return null;
  }
}

export const AUDIT = {
  RULE_CREATED: 'RULE_CREATED',
  RULE_UPDATED: 'RULE_UPDATED',
  RULE_DISABLED: 'RULE_DISABLED',
  RULE_DELETED: 'RULE_DELETED',
  CREDIT_ISSUED: 'CREDIT_ISSUED',
  CREDIT_DEBITED: 'CREDIT_DEBITED',
  REFUND_CREATED: 'REFUND_CREATED',
  CAMPAIGN_ACTIVATED: 'CAMPAIGN_ACTIVATED',
  CAMPAIGN_PAUSED: 'CAMPAIGN_PAUSED',
  CAMPAIGN_RUN: 'CAMPAIGN_RUN',
  NOTIFICATION_SENT: 'NOTIFICATION_SENT',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  ADMIN_ACTION: 'ADMIN_ACTION',
  API_ERROR: 'API_ERROR',
  RECONCILIATION_MISMATCH: 'RECONCILIATION_MISMATCH',
  APP_UNINSTALLED: 'APP_UNINSTALLED',
  DATA_REDACTED: 'DATA_REDACTED',
};
