import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/util/errors';
import { requestId as newRequestId } from '@/lib/util/crypto';

export function ok(data, init = {}) {
  return NextResponse.json({ ok: true, ...data }, init);
}

/** Wraps a route handler so no raw stack trace can ever reach the browser. */
export function withErrorHandling(handler) {
  return async (request, context) => {
    const rid = newRequestId();
    try {
      return await handler(request, context, { requestId: rid });
    } catch (error) {
      const { status, body } = toErrorResponse(error, rid);
      return NextResponse.json(body, { status });
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function parsePagination(searchParams, { defaultTake = 25, maxTake = 100 } = {}) {
  const take = Math.min(maxTake, Math.max(1, Number(searchParams.get('take')) || defaultTake));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  return { take, skip: (page - 1) * take, page };
}
