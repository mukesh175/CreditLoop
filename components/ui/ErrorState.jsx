'use client';

/** Merchant-facing error surface. Technical detail stays in the server logs. */
export default function ErrorState({ title, message, lastSyncAt, onRetry, requestId }) {
  return (
    <div className="cl-card">
      <div className="cl-card-body text-center py-5">
        <div className="cl-empty-title mb-2">{title || 'Unable to load this data'}</div>
        <p className="text-secondary mb-2" style={{ fontSize: 14 }}>
          {message || 'Shopify did not return the requested information.'}
        </p>
        {lastSyncAt && (
          <p className="cl-source-note mb-3">
            Last successful sync: {new Date(lastSyncAt).toLocaleString()}
          </p>
        )}
        {onRetry && (
          <button type="button" className="btn btn-cl-primary" onClick={onRetry}>
            Retry
          </button>
        )}
        {requestId && (
          <div className="cl-source-note mt-3">Reference: {requestId}</div>
        )}
      </div>
    </div>
  );
}
