import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma/client';
import { CRON_SECRET, SHOPIFY_API_VERSION } from '@/lib/config';
import { safeEqual } from '@/lib/util/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Deployment diagnostics.
 *
 * Public response is deliberately minimal — whether the database answers, and
 * nothing else. Pass ?secret=$CRON_SECRET for the configuration checklist,
 * which reports only whether each value is present, never its value.
 */
/** Strips credentials out of any connection string in an error message. */
function redactConnectionStrings(message) {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, 'postgresql://[redacted]')
    .replace(/password=[^\s&"']+/gi, 'password=[redacted]');
}

export async function GET(request) {
  const checks = { database: 'unknown' };
  let databaseError = null;
  let status = 200;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (error) {
    status = 503;
    const code = error?.code;
    checks.database =
      code === 'P2021' || code === 'P2022'
        ? 'schema_out_of_date'
        : code === 'P1001' || code === 'P1002'
          ? 'unreachable'
          : 'error';
    databaseError = {
      code: code || error?.name || 'UNKNOWN',
      // Redact anything that looks like a connection string before this is
      // shown to anyone, even behind the secret.
      message: redactConnectionStrings(String(error?.message || '')).slice(0, 600),
    };
    // eslint-disable-next-line no-console
    console.error('[creditloop] health check failed', { code, message: error?.message });
  }

  const provided = request.nextUrl.searchParams.get('secret') || '';
  const detailed = CRON_SECRET && safeEqual(provided, CRON_SECRET);

  if (!detailed) {
    return NextResponse.json({ ok: status === 200, checks }, { status });
  }

  // Presence only — never the values themselves.
  const required = [
    'DATABASE_URL',
    'DIRECT_DATABASE_URL',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL',
    'CRON_SECRET',
    'ENCRYPTION_KEY',
  ];
  const optional = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'];

  const env = {};
  for (const key of [...required, ...optional]) env[key] = Boolean(process.env[key]);

  let shops = null;
  let migrations = null;
  try {
    shops = await prisma.shop.count();
  } catch (error) {
    migrations = 'Shop table is not queryable — migrations have probably not been applied.';
  }

  return NextResponse.json(
    {
      ok: status === 200,
      checks,
      env,
      missingRequired: required.filter((key) => !process.env[key]),
      apiVersion: SHOPIFY_API_VERSION,
      appUrl: process.env.SHOPIFY_APP_URL || null,
      installedShops: shops,
      ...(databaseError ? { databaseError } : {}),
      ...(migrations ? { migrations } : {}),
    },
    { status }
  );
}
