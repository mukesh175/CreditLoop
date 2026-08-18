-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "shopifyShopGid" TEXT,
    "name" TEXT,
    "email" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "scopes" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "billingSubGid" TEXT,
    "billingStatus" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "billingPeriodStart" TIMESTAMP(3),
    "defaultBonusPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "defaultMaxBonus" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "recommendationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifySession" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "state" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "onlineUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditRule" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "bonusType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "bonusValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxBonusAmount" DOUBLE PRECISION,
    "minRefundAmount" DOUBLE PRECISION,
    "customerEligibility" TEXT NOT NULL DEFAULT 'ALL',
    "currencyCode" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditRuleCondition" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditRuleCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderGid" TEXT NOT NULL,
    "orderName" TEXT,
    "customerGid" TEXT,
    "returnGid" TEXT,
    "refundGid" TEXT,
    "refundAmount" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "refundMethod" TEXT NOT NULL DEFAULT 'PENDING',
    "creditOffered" DOUBLE PRECISION,
    "creditAccepted" BOOLEAN NOT NULL DEFAULT false,
    "bonusAmount" DOUBLE PRECISION,
    "ruleIdApplied" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerGid" TEXT NOT NULL,
    "shopifyStoreCreditAccountId" TEXT,
    "shopifyTransactionId" TEXT,
    "eventType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "orderGid" TEXT,
    "refundGid" TEXT,
    "campaignId" TEXT,
    "ruleId" TEXT,
    "returnEventId" TEXT,
    "bonusAmount" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCampaign" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "segment" TEXT NOT NULL DEFAULT 'CREDIT_HOLDERS',
    "minBalance" DOUBLE PRECISION,
    "minDaysInactive" INTEGER,
    "minLifetimeValue" DOUBLE PRECISION,
    "currencyCode" TEXT,
    "grantsCredit" BOOLEAN NOT NULL DEFAULT false,
    "grantType" TEXT,
    "grantValue" DOUBLE PRECISION,
    "grantMaxAmount" DOUBLE PRECISION,
    "grantExpiresInDays" INTEGER,
    "sendsEmail" BOOLEAN NOT NULL DEFAULT true,
    "emailTemplate" TEXT,
    "requiresMarketingConsent" BOOLEAN NOT NULL DEFAULT true,
    "scheduleCron" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerGid" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "creditIssued" DOUBLE PRECISION,
    "currencyCode" TEXT,
    "sentAt" TIMESTAMP(3),
    "convertedOrderGid" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMetric" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerGid" TEXT NOT NULL,
    "displayName" TEXT,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "lifetimeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "averageOrderValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3),
    "firstOrderAt" TIMESTAMP(3),
    "returnCount" INTEGER NOT NULL DEFAULT 0,
    "creditIssuedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditRedeemedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditUseCount" INTEGER NOT NULL DEFAULT 0,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCreditSnapshot" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerGid" TEXT NOT NULL,
    "shopifyStoreCreditAccountId" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL,
    "lastCreditAt" TIMESTAMP(3),
    "lastDebitAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCreditSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAttribution" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderGid" TEXT NOT NULL,
    "orderName" TEXT,
    "customerGid" TEXT,
    "shopifyStoreCreditAccountId" TEXT,
    "creditAmountUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL,
    "isRepeatPurchase" BOOLEAN NOT NULL DEFAULT false,
    "daysSincePreviousOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAttribution" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "creditEventId" TEXT NOT NULL,
    "orderAttributionId" TEXT NOT NULL,
    "amountAttributed" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "daysToRedemption" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "merchantEmail" TEXT,
    "weeklyReport" BOOLEAN NOT NULL DEFAULT true,
    "largeCreditIssued" BOOLEAN NOT NULL DEFAULT true,
    "largeCreditThreshold" DOUBLE PRECISION NOT NULL DEFAULT 250,
    "redemptionSpike" BOOLEAN NOT NULL DEFAULT true,
    "expiringCreditSummary" BOOLEAN NOT NULL DEFAULT true,
    "customerCreditIssued" BOOLEAN NOT NULL DEFAULT false,
    "customerCreditReminder" BOOLEAN NOT NULL DEFAULT false,
    "customerExpirationReminder" BOOLEAN NOT NULL DEFAULT false,
    "customerWinBack" BOOLEAN NOT NULL DEFAULT false,
    "reminderAfterDays" INTEGER NOT NULL DEFAULT 30,
    "expiryReminderDays" INTEGER[] DEFAULT ARRAY[14, 7, 1]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipientHash" TEXT,
    "customerGid" TEXT,
    "campaignId" TEXT,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "dedupeKey" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'MERCHANT',
    "actorId" TEXT,
    "customerGid" TEXT,
    "orderGid" TEXT,
    "amount" DOUBLE PRECISION,
    "currencyCode" TEXT,
    "shopifyTransactionId" TEXT,
    "requestId" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "shopDomain" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "payloadHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "requestHash" TEXT,
    "responseJson" JSONB,
    "shopifyTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "creditIssued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusIssued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordersUsingCredit" INTEGER NOT NULL DEFAULT 0,
    "revenueFromCreditOrders" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditOffersUsed" INTEGER NOT NULL DEFAULT 0,
    "returnsOffered" INTEGER NOT NULL DEFAULT 0,
    "returnsAcceptedCredit" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMetric" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "creditIssued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordersUsingCredit" INTEGER NOT NULL DEFAULT 0,
    "revenueFromCreditOrders" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "redemptionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topCampaignId" TEXT,
    "topSegment" TEXT,
    "reportSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRecord" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerGid" TEXT NOT NULL,
    "shopifyStoreCreditAccountId" TEXT,
    "shopifyBalance" DOUBLE PRECISION NOT NULL,
    "expectedFromEvents" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "Shop"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopifyShopGid_key" ON "Shop"("shopifyShopGid");

-- CreateIndex
CREATE INDEX "Shop_isActive_idx" ON "Shop"("isActive");

-- CreateIndex
CREATE INDEX "ShopifySession_shopId_idx" ON "ShopifySession"("shopId");

-- CreateIndex
CREATE INDEX "ShopifySession_shopDomain_idx" ON "ShopifySession"("shopDomain");

-- CreateIndex
CREATE INDEX "CreditRule_shopId_enabled_idx" ON "CreditRule"("shopId", "enabled");

-- CreateIndex
CREATE INDEX "CreditRule_shopId_priority_idx" ON "CreditRule"("shopId", "priority");

-- CreateIndex
CREATE INDEX "CreditRuleCondition_ruleId_idx" ON "CreditRuleCondition"("ruleId");

-- CreateIndex
CREATE INDEX "ReturnEvent_shopId_status_idx" ON "ReturnEvent"("shopId", "status");

-- CreateIndex
CREATE INDEX "ReturnEvent_shopId_createdAt_idx" ON "ReturnEvent"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnEvent_customerGid_idx" ON "ReturnEvent"("customerGid");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnEvent_shopId_orderGid_refundGid_key" ON "ReturnEvent"("shopId", "orderGid", "refundGid");

-- CreateIndex
CREATE UNIQUE INDEX "CreditEvent_shopifyTransactionId_key" ON "CreditEvent"("shopifyTransactionId");

-- CreateIndex
CREATE INDEX "CreditEvent_shopId_createdAt_idx" ON "CreditEvent"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditEvent_shopId_customerGid_idx" ON "CreditEvent"("shopId", "customerGid");

-- CreateIndex
CREATE INDEX "CreditEvent_shopId_eventType_idx" ON "CreditEvent"("shopId", "eventType");

-- CreateIndex
CREATE INDEX "CreditEvent_shopifyStoreCreditAccountId_idx" ON "CreditEvent"("shopifyStoreCreditAccountId");

-- CreateIndex
CREATE INDEX "CreditEvent_campaignId_idx" ON "CreditEvent"("campaignId");

-- CreateIndex
CREATE INDEX "CreditCampaign_shopId_status_idx" ON "CreditCampaign"("shopId", "status");

-- CreateIndex
CREATE INDEX "CreditCampaign_shopId_type_idx" ON "CreditCampaign"("shopId", "type");

-- CreateIndex
CREATE INDEX "CampaignRecipient_shopId_status_idx" ON "CampaignRecipient"("shopId", "status");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_customerGid_key" ON "CampaignRecipient"("campaignId", "customerGid");

-- CreateIndex
CREATE INDEX "CampaignEvent_campaignId_createdAt_idx" ON "CampaignEvent"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerMetric_shopId_lifetimeValue_idx" ON "CustomerMetric"("shopId", "lifetimeValue");

-- CreateIndex
CREATE INDEX "CustomerMetric_shopId_lastOrderAt_idx" ON "CustomerMetric"("shopId", "lastOrderAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMetric_shopId_customerGid_key" ON "CustomerMetric"("shopId", "customerGid");

-- CreateIndex
CREATE INDEX "CustomerCreditSnapshot_shopId_balance_idx" ON "CustomerCreditSnapshot"("shopId", "balance");

-- CreateIndex
CREATE INDEX "CustomerCreditSnapshot_shopId_syncedAt_idx" ON "CustomerCreditSnapshot"("shopId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCreditSnapshot_shopId_customerGid_currencyCode_key" ON "CustomerCreditSnapshot"("shopId", "customerGid", "currencyCode");

-- CreateIndex
CREATE INDEX "OrderAttribution_shopId_createdAt_idx" ON "OrderAttribution"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderAttribution_shopId_customerGid_idx" ON "OrderAttribution"("shopId", "customerGid");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAttribution_shopId_orderGid_key" ON "OrderAttribution"("shopId", "orderGid");

-- CreateIndex
CREATE INDEX "CreditAttribution_shopId_createdAt_idx" ON "CreditAttribution"("shopId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditAttribution_creditEventId_orderAttributionId_key" ON "CreditAttribution"("creditEventId", "orderAttributionId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_shopId_key" ON "NotificationPreference"("shopId");

-- CreateIndex
CREATE INDEX "NotificationLog_shopId_createdAt_idx" ON "NotificationLog"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_shopId_status_idx" ON "NotificationLog"("shopId", "status");

-- CreateIndex
CREATE INDEX "NotificationLog_campaignId_idx" ON "NotificationLog"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_shopId_dedupeKey_key" ON "NotificationLog"("shopId", "dedupeKey");

-- CreateIndex
CREATE INDEX "AuditLog_shopId_createdAt_idx" ON "AuditLog"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_shopId_action_idx" ON "AuditLog"("shopId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_customerGid_idx" ON "AuditLog"("customerGid");

-- CreateIndex
CREATE INDEX "WebhookEvent_shopDomain_topic_idx" ON "WebhookEvent"("shopDomain", "topic");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_webhookId_topic_key" ON "WebhookEvent"("webhookId", "topic");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_shopId_operation_idx" ON "IdempotencyRecord"("shopId", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_shopId_key_key" ON "IdempotencyRecord"("shopId", "key");

-- CreateIndex
CREATE INDEX "DailyMetric_shopId_date_idx" ON "DailyMetric"("shopId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_shopId_date_currencyCode_key" ON "DailyMetric"("shopId", "date", "currencyCode");

-- CreateIndex
CREATE INDEX "WeeklyMetric_shopId_weekStart_idx" ON "WeeklyMetric"("shopId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMetric_shopId_weekStart_currencyCode_key" ON "WeeklyMetric"("shopId", "weekStart", "currencyCode");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_shopId_status_idx" ON "ReconciliationRecord"("shopId", "status");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_shopId_runAt_idx" ON "ReconciliationRecord"("shopId", "runAt");

-- AddForeignKey
ALTER TABLE "ShopifySession" ADD CONSTRAINT "ShopifySession_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRule" ADD CONSTRAINT "CreditRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRuleCondition" ADD CONSTRAINT "CreditRuleCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CreditRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnEvent" ADD CONSTRAINT "ReturnEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEvent" ADD CONSTRAINT "CreditEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEvent" ADD CONSTRAINT "CreditEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "CreditRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEvent" ADD CONSTRAINT "CreditEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CreditCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEvent" ADD CONSTRAINT "CreditEvent_returnEventId_fkey" FOREIGN KEY ("returnEventId") REFERENCES "ReturnEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCampaign" ADD CONSTRAINT "CreditCampaign_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CreditCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CreditCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMetric" ADD CONSTRAINT "CustomerMetric_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditSnapshot" ADD CONSTRAINT "CustomerCreditSnapshot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAttribution" ADD CONSTRAINT "OrderAttribution_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAttribution" ADD CONSTRAINT "CreditAttribution_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAttribution" ADD CONSTRAINT "CreditAttribution_creditEventId_fkey" FOREIGN KEY ("creditEventId") REFERENCES "CreditEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAttribution" ADD CONSTRAINT "CreditAttribution_orderAttributionId_fkey" FOREIGN KEY ("orderAttributionId") REFERENCES "OrderAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMetric" ADD CONSTRAINT "DailyMetric_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMetric" ADD CONSTRAINT "WeeklyMetric_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
