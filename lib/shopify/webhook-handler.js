import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma/client';
import { verifyWebhookHmac } from './hmac';
import { sha256 } from '@/lib/util/crypto';

/**
 * Shared webhook plumbing.
 *
 * Every handler built with this:
 *   - verifies the HMAC against the raw request body (before parsing),
 *   - records the delivery id so redeliveries are idempotent,
 *   - returns 200 quickly, because Shopify retries on slow responses,
 *   - never lets a processing failure turn into an infinite retry storm.
 *
 * Shopify retries on non-2xx. We return 200 for "received but could not
 * process" cases that a retry would not fix (unknown shop), and 500 only where
 * a retry genuinely might succeed.
 */
export function createWebhookHandler(topic, processor, { requireShop = true } = {}) {
  return async function POST(request) {
    const rawBody = await request.text();
    const hmac = request.headers.get('x-shopify-hmac-sha256');
    const shopDomain = request.headers.get('x-shopify-shop-domain');
    const webhookId = request.headers.get('x-shopify-webhook-id') || sha256(rawBody);

    if (!verifyWebhookHmac(rawBody, hmac)) {
      // Unverified payloads are never parsed or stored.
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!shopDomain) return new NextResponse('Missing shop domain', { status: 400 });

    // Idempotency: a duplicate delivery is acknowledged, not reprocessed.
    const existing = await prisma.webhookEvent.findUnique({
      where: { webhookId_topic: { webhookId, topic } },
    });
    if (existing && existing.status === 'PROCESSED') {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
    if (requireShop && !shop) {
      // Nothing to do and a retry will not help.
      return NextResponse.json({ ok: true, ignored: 'shop_not_installed' });
    }

    const event = existing
      ? await prisma.webhookEvent.update({
          where: { id: existing.id },
          data: { attempts: { increment: 1 }, status: 'RECEIVED' },
        })
      : await prisma.webhookEvent.create({
          data: {
            shopId: shop?.id || null,
            shopDomain,
            topic,
            webhookId,
            payloadHash: sha256(rawBody),
            attempts: 1,
          },
        });

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED', error: 'Payload was not valid JSON.' },
      });
      return NextResponse.json({ ok: true, ignored: 'invalid_json' });
    }

    try {
      await processor({ shop, shopDomain, payload, event, topic });
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date(), error: null },
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = String(error?.message || error).slice(0, 500);
      // eslint-disable-next-line no-console
      console.error('[creditloop] webhook processing failed', { topic, shopDomain, message });
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED', error: message },
      });
      // Let Shopify retry — after several attempts we stop asking for retries so
      // one poisoned payload cannot loop forever.
      const status = event.attempts >= 5 ? 200 : 500;
      return NextResponse.json({ ok: false }, { status });
    }
  };
}
