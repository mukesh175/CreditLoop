import test from 'node:test';
import assert from 'node:assert/strict';

process.env.RESEND_FROM_EMAIL = 'CreditLoop <credit@example-sender.com>';
const { buildSender, resolveDisplayName } = await import('../lib/email/sender.js');

const shop = {
  name: 'Acme Store',
  domain: 'acme-store.myshopify.com',
  email: 'owner@acmestore.com',
};

test('the store name is the sender a customer sees', () => {
  const { from } = buildSender(shop);
  assert.match(from, /^Acme Store </, 'the inbox shows the store, not CreditLoop');
  assert.match(from, /credit@example-sender\.com/, 'envelope stays on the verified domain');
});

test('a merchant-configured sender name wins over the store name', () => {
  const { from, displayName } = buildSender(shop, { fromName: 'Acme Rewards' });
  assert.equal(displayName, 'Acme Rewards');
  assert.match(from, /^Acme Rewards </);
});

test('replies go to the store owner', () => {
  assert.equal(buildSender(shop).replyTo, 'owner@acmestore.com');
});

test('falls back to the store handle before anything generic', () => {
  const name = resolveDisplayName({ domain: 'acme-store.myshopify.com' });
  assert.equal(name, 'acme-store');
});

test('an empty configured name falls back rather than sending a blank sender', () => {
  const { displayName } = buildSender(shop, { fromName: '   ' });
  assert.equal(displayName, 'Acme Store');
});

test('CreditLoop never appears as the sender when a store name exists', () => {
  const { from } = buildSender(shop, { fromName: null });
  assert.ok(!from.startsWith('CreditLoop'), 'the merchant brand fronts every message');
});

test('a display name cannot inject headers', () => {
  const { from } = buildSender(
    { name: 'Evil\r\nBcc: victim@example.com', domain: 'x.myshopify.com' }
  );
  assert.ok(!from.includes('\r'), 'carriage returns are stripped');
  assert.ok(!from.includes('\n'), 'newlines are stripped');
});

test('a display name containing a comma is quoted', () => {
  const { from } = buildSender({ name: 'Acme, Inc', domain: 'x.myshopify.com' });
  assert.match(from, /^"Acme, Inc" </);
});

test('display names are bounded in length', () => {
  const { displayName } = buildSender({ name: 'A'.repeat(200), domain: 'x.myshopify.com' });
  assert.ok(displayName.length <= 64);
});
