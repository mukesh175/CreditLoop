import test from 'node:test';
import assert from 'node:assert/strict';

process.env.RESEND_FROM_EMAIL = 'CreditLoop <credit@example-sender.com>';
const { buildSender } = await import('../lib/email/sender.js');

const shop = {
  name: 'Acme Store',
  domain: 'acme-store.myshopify.com',
  email: 'owner@acmestore.com',
};

test('customer email shows the store name as the sender', () => {
  const { from } = buildSender(shop, { audience: 'CUSTOMER' });
  assert.match(from, /^Acme Store </, 'the inbox shows the store, not CreditLoop');
  assert.match(from, /credit@example-sender\.com/, 'envelope stays on the verified domain');
});

test('replies go to the store owner', () => {
  const { replyTo } = buildSender(shop, { audience: 'CUSTOMER' });
  assert.equal(replyTo, 'owner@acmestore.com');
});

test('merchant email is from CreditLoop', () => {
  const { from } = buildSender(shop, { audience: 'MERCHANT' });
  assert.match(from, /^CreditLoop </);
});

test('falls back to the store handle when no name is synced yet', () => {
  const { from } = buildSender({ domain: 'acme-store.myshopify.com' }, { audience: 'CUSTOMER' });
  assert.match(from, /^acme-store </);
});

test('a display name cannot inject headers', () => {
  const { from } = buildSender(
    { name: 'Evil\r\nBcc: victim@example.com', domain: 'x.myshopify.com' },
    { audience: 'CUSTOMER' }
  );
  assert.ok(!from.includes('\r'), 'carriage returns are stripped');
  assert.ok(!from.includes('\n'), 'newlines are stripped');
});

test('a display name containing a comma is quoted', () => {
  const { from } = buildSender(
    { name: 'Acme, Inc', domain: 'x.myshopify.com' },
    { audience: 'CUSTOMER' }
  );
  assert.match(from, /^"Acme, Inc" </);
});
