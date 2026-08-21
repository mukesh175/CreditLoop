/**
 * Demo records carry their own GID namespace so they can never be confused with
 * Shopify data — but that also means Shopify will reject them outright
 * ("Variable $id of type ID! was provided invalid value").
 *
 * Anything that passes an identifier to Shopify must check this first and serve
 * local data instead. Financial operations refuse demo records entirely: a demo
 * order has no real money behind it, and attempting a refund would be
 * meaningless at best.
 */
export const DEMO_GID_PREFIX = 'gid://creditloop-demo/';

export function isDemoGid(gid) {
  return typeof gid === 'string' && gid.startsWith(DEMO_GID_PREFIX);
}

/** Readable label for a demo identifier, e.g. "Demo customer 1042". */
export function demoLabel(gid) {
  if (!isDemoGid(gid)) return null;
  const [, type, id] = gid.replace(DEMO_GID_PREFIX, '').match(/^(\w+)\/(.+)$/) || [];
  return type ? `Demo ${type.toLowerCase()} ${id}` : 'Demo record';
}
