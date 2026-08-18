import crypto from 'node:crypto';
import { SHOPIFY_API_SECRET } from '@/lib/config';
import { safeEqual } from '@/lib/util/crypto';

/** Verifies the HMAC on an incoming webhook. Compares raw bytes, never JSON. */
export function verifyWebhookHmac(rawBody, headerHmac) {
  if (!headerHmac || !SHOPIFY_API_SECRET) return false;
  const digest = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');
  return safeEqual(digest, headerHmac);
}

/** Verifies the `hmac` query parameter on OAuth / App Bridge redirects. */
export function verifyQueryHmac(searchParams) {
  const params = new URLSearchParams(searchParams);
  const hmac = params.get('hmac');
  if (!hmac || !SHOPIFY_API_SECRET) return false;
  params.delete('hmac');
  params.delete('signature');

  const message = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const digest = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(message).digest('hex');
  return safeEqual(digest, hmac);
}

/** `foo.myshopify.com` only — blocks host-header style injection via `?shop=`. */
export function isValidShopDomain(shop) {
  return typeof shop === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}
