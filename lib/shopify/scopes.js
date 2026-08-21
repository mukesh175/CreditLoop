/**
 * Scope comparison.
 *
 * Shopify does not echo back every scope it granted: a `write_x` grant implies
 * `read_x`, and only the write scope appears in the returned scope list. A
 * naive comparison therefore reports `read_orders` as missing on a store that
 * has full access to orders — which sends the merchant off to reinstall for no
 * reason.
 */

/** `write_orders` covers `read_orders`, and so on for every resource. */
export function expandGrantedScopes(scopes) {
  const list = Array.isArray(scopes)
    ? scopes
    : String(scopes || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

  const granted = new Set();
  for (const scope of list) {
    granted.add(scope);
    if (scope.startsWith('write_')) granted.add(scope.replace(/^write_/, 'read_'));

    // Unauthenticated storefront scopes follow the same pattern.
    if (scope.startsWith('unauthenticated_write_')) {
      granted.add(scope.replace(/^unauthenticated_write_/, 'unauthenticated_read_'));
    }
  }
  return granted;
}

/** Scopes the app needs that the grant genuinely does not cover. */
export function findMissingScopes(required, grantedScopes) {
  const granted = expandGrantedScopes(grantedScopes);
  return (required || []).filter((scope) => !granted.has(scope));
}
