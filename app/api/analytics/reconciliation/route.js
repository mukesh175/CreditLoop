import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { reconcileShop } from '@/lib/credit/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const records = await prisma.reconciliationRecord.findMany({
    where: { shopId: shop.id, status: 'OPEN' },
    orderBy: { runAt: 'desc' },
    take: 50,
  });
  return ok({
    records,
    note: 'CreditLoop never changes a Shopify balance to resolve a difference. Review each item and adjust in Shopify if needed.',
  });
});

/** Run reconciliation on demand, or acknowledge a record. */
export const POST = withErrorHandling(async (request) => {
  const { shop, session } = await requireShop(request);
  const body = await readJson(request);

  if (body.acknowledgeId) {
    await prisma.reconciliationRecord.updateMany({
      where: { id: body.acknowledgeId, shopId: shop.id },
      data: { status: 'ACKNOWLEDGED', note: body.note || null },
    });
    return ok({ acknowledged: true });
  }

  const results = await reconcileShop({ shop, session, limit: 50 });
  return ok({ results });
});
