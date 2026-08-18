import prisma from '@/lib/prisma/client';
import { withErrorHandling, ok, parsePagination } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(async (request) => {
  const { shop } = await requireShop(request);
  const { searchParams } = request.nextUrl;
  const { take, skip, page } = parsePagination(searchParams, { defaultTake: 50 });
  const action = searchParams.get('action');

  const where = { shopId: shop.id, ...(action ? { action } : {}) };
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.auditLog.count({ where }),
  ]);

  return ok({ logs, pagination: { page, take, total, pages: Math.ceil(total / take) } });
});
