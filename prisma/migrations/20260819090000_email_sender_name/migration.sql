-- Configurable display name for outgoing email.
-- Null means "use the store's own name", so existing rows need no backfill.
ALTER TABLE "NotificationPreference" ADD COLUMN "emailFromName" TEXT;
