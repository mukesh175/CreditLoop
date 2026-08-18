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
  constructor(message, details = null) {
    super(message, { code: 'SHOPIFY_API_ERROR', status: 502, details });
    this.name = 'ShopifyApiError';
  }
}

export class EntitlementError extends AppError {
  constructor(message, details = null) {
    super(message, { code: 'PLAN_LIMIT_REACHED', status: 402, details });
    this.name = 'EntitlementError';
  }
}

/** Converts any thrown value into a safe JSON body for an API route. */
export function toErrorResponse(error, requestId) {
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
