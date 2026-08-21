import { withErrorHandling, ok } from '@/lib/api/respond';
import { requireShop } from '@/lib/shopify/auth-guard';
import { getStoreCreditAccount } from '@/lib/credit/store-credit';
import { ValidationError } from '@/lib/util/errors';
import { isDemoGid } from '@/lib/demo/identifiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Transaction history, read from Shopify. */
export const GET = withErrorHandling(async (request) => {
  const { session } = await requireShop(request);
  const accountId = request.nextUrl.searchParams.get('accountId');
  if (!accountId) throw new ValidationError('A store credit account id is required.');

  if (isDemoGid(accountId)) {
    throw new ValidationError(
      'This is a demo store credit account. Transaction history is only available for real Shopify accounts.'
    );
  }

  const account = await getStoreCreditAccount(session, accountId, { transactions: 50 });
  if (!account) throw new ValidationError('That store credit account could not be found.');

  return ok({ account, source: 'shopify' });
});
