/**
 * Error taxonomy. Merchant-facing messages never leak GraphQL internals —
 * technical detail stays in `details` for server-side logging only.
 */
export class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', status = 400, details = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required.', details = null) {
    super(message, { code: 'UNAUTHENTICATED', status: 401, details });
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource.', details = null) {
    super(message, { code: 'FORBIDDEN', status: 403, details });
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, { code: 'VALIDATION_ERROR', status: 422, details });
    this.name = 'ValidationError';
  }
}

export class ShopifyApiError extends AppError {
  constructor(message, details = null, { code = 'SHOPIFY_API_ERROR', status = 502 } = {}) {
    super(message, { code, status, details });
    this.name = 'ShopifyApiError';
  }
}

/**
 * Shopify refused the request because the app lacks a scope or an approval —
 * an account state the merchant can act on, not a transient failure.
 */
export class ShopifyAccessDeniedError extends ShopifyApiError {
  constructor(message, details = null) {
    super(message, details, { code: 'SHOPIFY_ACCESS_DENIED', status: 403 });
    this.name = 'ShopifyAccessDeniedError';
  }
}

export class EntitlementError extends AppError {
  constructor(message, details = null) {
    super(message, { code: 'PLAN_LIMIT_REACHED', status: 402, details });
    this.name = 'EntitlementError';
  }
}

/**
 * Recognises infrastructure failures that would otherwise surface as a useless
 * "something went wrong".
 *
 * These say what is wrong and what to do, without leaking connection strings,
 * table contents or stack traces.
 */
function describeInfrastructureFailure(error) {
  const code = error?.code;
  const name = error?.name || '';
  const message = String(error?.message || '');

  if (code === 'P1001' || code === 'P1002' || name === 'PrismaClientInitializationError') {
    return {
      code: 'DATABASE_UNREACHABLE',
      status: 503,
      message:
        'CreditLoop cannot reach its database. Check that DATABASE_URL is set for this environment and that the database is running.',
    };
  }
  if (code === 'P2021' || code === 'P2022' || /does not exist in the current database/i.test(message)) {
    return {
      code: 'DATABASE_SCHEMA_OUT_OF_DATE',
      status: 503,
      message:
        'The CreditLoop database schema is missing or out of date. Run `npx prisma migrate deploy` against this environment.',
    };
  }
  if (/DATABASE_URL/.test(message) && /not found|missing|invalid/i.test(message)) {
    return {
      code: 'DATABASE_NOT_CONFIGURED',
      status: 503,
      message: 'DATABASE_URL is not configured for this deployment.',
    };
  }
  return null;
}

/** Converts any thrown value into a safe JSON body for an API route. */
export function toErrorResponse(error, requestId) {
  const infrastructure = !(error instanceof AppError) ? describeInfrastructureFailure(error) : null;
  if (infrastructure) {
    // eslint-disable-next-line no-console
    console.error('[creditloop] infrastructure error', {
      requestId,
      code: infrastructure.code,
      prismaCode: error?.code,
      message: error?.message,
    });
    return {
      status: infrastructure.status,
      body: {
        ok: false,
        error: { code: infrastructure.code, message: infrastructure.message, requestId },
      },
    };
  }

  const isApp = error instanceof AppError;
  if (!isApp) {
    // eslint-disable-next-line no-console
    console.error('[creditloop] unhandled error', { requestId, error });
  } else if (error.details) {
    // eslint-disable-next-line no-console
    console.error('[creditloop] app error', { requestId, code: error.code, details: error.details });
  }
  return {
    status: isApp ? error.status : 500,
    body: {
      ok: false,
      error: {
        code: isApp ? error.code : 'INTERNAL_ERROR',
        message: isApp
          ? error.message
          : 'Something went wrong on our side. The action was not completed.',
        requestId,
      },
    },
  };
}
