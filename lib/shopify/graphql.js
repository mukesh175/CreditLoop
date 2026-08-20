import { SHOPIFY_API_VERSION } from '@/lib/config';
import { ShopifyApiError, ShopifyAccessDeniedError } from '@/lib/util/errors';

const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Admin GraphQL client.
 *
 * Retries are deliberately limited to *throttling and transport* failures.
 * A financial mutation that reached Shopify is never blindly retried here —
 * see lib/util/idempotency.js, which guards those call sites instead.
 */
export async function adminGraphql(
  { shopDomain, accessToken },
  query,
  variables = {},
  { retryOnThrottle = true } = {}
) {
  if (!shopDomain || !accessToken) {
    throw new ShopifyApiError('Missing Shopify credentials for this shop.');
  }
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  let lastError = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (networkError) {
      lastError = networkError;
      if (attempt === MAX_RETRIES - 1) break;
      await sleep(2 ** attempt * 500);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      lastError = new ShopifyApiError(
        `Shopify responded with status ${response.status}.`,
        { status: response.status }
      );
      if (!retryOnThrottle || attempt === MAX_RETRIES - 1) break;
      const retryAfter = Number(response.headers.get('Retry-After')) || 2 ** attempt;
      await sleep(retryAfter * 1000);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      throw new ShopifyApiError(
        'Shopify rejected the app credentials for this store. Please reinstall CreditLoop.',
        { status: response.status }
      );
    }

    const json = await response.json().catch(() => null);
    if (!json) throw new ShopifyApiError('Shopify returned an unreadable response.');

    if (json.errors?.length) {
      const throttled = json.errors.some((e) => e.extensions?.code === 'THROTTLED');
      if (throttled && retryOnThrottle && attempt < MAX_RETRIES - 1) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      // Shopify's own wording is far more useful than a generic message here —
      // it names the missing scope or approval. It is merchant-safe text, not a
      // stack trace, so it is surfaced rather than swallowed.
      const messages = json.errors.map((e) => e.message).filter(Boolean);
      const accessDenied = json.errors.some(
        (e) =>
          e.extensions?.code === 'ACCESS_DENIED' ||
          /access denied|protected customer data|not approved|requires? .*approval/i.test(
            e.message || ''
          )
      );

      const details = { graphqlErrors: json.errors, query: query.slice(0, 200) };
      const text = messages.join(' ') || 'Shopify could not complete the request.';

      throw accessDenied
        ? new ShopifyAccessDeniedError(text, details)
        : new ShopifyApiError(text, details);
    }

    return { data: json.data, extensions: json.extensions };
  }

  throw lastError instanceof ShopifyApiError
    ? lastError
    : new ShopifyApiError('Could not reach Shopify. Please try again.', { cause: String(lastError) });
}

/**
 * Throws when a mutation returns userErrors, keeping the merchant-facing message
 * to Shopify's own text rather than a stack trace.
 */
export function assertNoUserErrors(userErrors, fallbackMessage) {
  if (!userErrors?.length) return;
  const message = userErrors.map((e) => e.message).filter(Boolean).join(' ');
  throw new ShopifyApiError(message || fallbackMessage, { userErrors });
}

/** Cursor-paginated fetch helper that never loads an unbounded result set. */
export async function paginate(session, query, variables, extract, { maxPages = 10 } = {}) {
  const nodes = [];
  let cursor = null;
  for (let page = 0; page < maxPages; page += 1) {
    const { data } = await adminGraphql(session, query, { ...variables, after: cursor });
    const connection = extract(data);
    if (!connection) break;
    nodes.push(...(connection.nodes || connection.edges?.map((e) => e.node) || []));
    if (!connection.pageInfo?.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }
  return nodes;
}
