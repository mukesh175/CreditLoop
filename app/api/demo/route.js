import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, readJson } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { DEMO_MODE_ALLOWED } from '@/lib/config';
import { ForbiddenError } from '@/lib/util/errors';
import { generateDemoData, clearDemoData } from '@/lib/demo/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Demo data for development and screenshots.
 *
 * Hard-gated: refuses to run in production, and every row it writes is tagged so
 * it can be removed wholesale. Demo data must never mix with real Shopify data.
 */
export const POST = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  if (!DEMO_MODE_ALLOWED) {
    throw new ForbiddenError(
      'Demo mode is disabled. It is only available outside production with CREDITLOOP_DEMO_MODE=true.'
    );
  }

  const body = await readJson(request);
  if (body.action === 'clear') {
    const result = await clearDemoData({ shopId: shop.id });
    await prisma.shop.update({ where: { id: shop.id }, data: { demoMode: false } });
    return ok({ cleared: result });
  }

  const result = await generateDemoData({ shopId: shop.id, currencyCode: shop.currencyCode });
  await prisma.shop.update({ where: { id: shop.id }, data: { demoMode: true } });
  return ok({ generated: result, warning: 'This store is now showing DEMO data.' });
});
