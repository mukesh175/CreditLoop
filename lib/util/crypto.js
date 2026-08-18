import crypto from 'node:crypto';

/**
 * Access tokens are encrypted at rest so a database leak alone does not hand an
 * attacker live Shopify credentials. Key comes from ENCRYPTION_KEY (32 bytes,
 * base64 or hex); falls back to a key derived from the app secret.
 */
function encryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-fA-F]{64}$/.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
  }
  const secret = process.env.SHOPIFY_API_SECRET || 'creditloop-dev-secret';
  return crypto.createHash('sha256').update(`creditloop:${secret}`).digest();
}

export function encrypt(plaintext) {
  if (plaintext == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decrypt(payload) {
  if (!payload) return null;
  if (!payload.startsWith('v1.')) return payload; // legacy/plaintext tolerance
  const [, ivB64, tagB64, dataB64] = payload.split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Timing-safe comparison for secrets and signatures. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** We store a hash rather than the customer's email address itself. */
export function hashRecipient(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || '').trim().toLowerCase())
    .digest('hex');
}

export function requestId() {
  return crypto.randomUUID();
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
