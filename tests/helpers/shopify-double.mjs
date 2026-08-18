import { createFakeShopify } from './fake-shopify.mjs';
import { ShopifyApiError } from '../../lib/util/errors.js';

/**
 * Stands in for lib/shopify/graphql during tests.
 *
 * `assertNoUserErrors` and `paginate` are the real implementations — only the
 * network call is replaced, so the error handling under test is the production
 * code path.
 */
let current = createFakeShopify();

export function setFakeShopify(fake) {
  current = fake;
  return current;
}

export function getFakeShopify() {
  return current;
}

export async function adminGraphql(session, query, variables, options) {
  return current.adminGraphql(session, query, variables, options);
}

export function assertNoUserErrors(userErrors, fallbackMessage) {
  if (!userErrors?.length) return;
  const message = userErrors.map((e) => e.message).filter(Boolean).join(' ');
  throw new ShopifyApiError(message || fallbackMessage, { userErrors });
}

export async function paginate(session, query, variables, extract, { maxPages = 10 } = {}) {
  const nodes = [];
  let cursor = null;
  for (let page = 0; page < maxPages; page += 1) {
    const { data } = await adminGraphql(session, query, { ...variables, after: cursor });
    const connection = extract(data);
    if (!connection) break;
    nodes.push(...(connection.nodes || []));
    if (!connection.pageInfo?.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }
  return nodes;
}
