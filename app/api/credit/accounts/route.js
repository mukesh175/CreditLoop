import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getCustomerStoreCredit } from '@/lib/credit/store-credit';
import { ValidationError } from '@/lib/util/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live balance straight from Shopify — the authoritative figure. */
export const GET = withErrorHandling(async (request) => {
  const { session } = await requireShop(request);
  const customerGid = request.nextUrl.searchParams.get('customerId');
  if (!customerGid) throw new ValidationError('A customer id is required.');

  const profile = await getCustomerStoreCredit(session, customerGid, { transactions: 10 });
  if (!profile) throw new ValidationError('That customer could not be found.');

  return ok({
    customer: {
      id: profile.customerGid,
      displayName: profile.displayName,
      orderCount: profile.orderCount,
      lifetimeValue: profile.lifetimeValue,
    },
    accounts: profile.accounts,
    source: 'shopify',
    note: 'Balances are read live from Shopify Store Credit, which is the source of truth.',
  });
});
