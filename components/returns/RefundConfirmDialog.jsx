'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { formatMoney } from '@/lib/util/money';

/**
 * The confirmation step before any refund executes.
 *
 * It shows, unambiguously: the refund amount, the merchant-funded bonus, the
 * total credit, the customer, the order and the currency. The submit button
 * stays disabled until the preview has loaded from Shopify, so a merchant can
 * never confirm an amount the app has not verified.
 */
export default function RefundConfirmDialog({ opportunity, mode = 'credit', onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const isCredit = mode === 'credit';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch('/api/refunds/preview', {
          method: 'POST',
          body: {
            orderId: opportunity.orderGid,
            refundAmount: opportunity.refundAmount,
          },
        });
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opportunity]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const endpoint = isCredit
        ? '/api/refunds/store-credit'
        : '/api/refunds/original-payment';
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: {
          confirmed: true,
          orderId: opportunity.orderGid,
          refundAmount: preview.refund.refundAmount,
          currencyCode: preview.refund.currencyCode,
          ...(isCredit
            ? {
                bonusAmount: preview.recommendation.bonusAmount,
                ruleId: preview.recommendation.appliedRule?.id || null,
              }
            : {}),
          returnEventId: opportunity.returnEventId,
        },
      });
      setResult(data.refund);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const currency = preview?.refund?.currencyCode || opportunity.currencyCode;
  const refundAmount = preview?.refund?.refundAmount ?? opportunity.refundAmount;
  const bonus = isCredit ? preview?.recommendation?.bonusAmount || 0 : 0;
  const totalCredit = refundAmount + bonus;

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content" style={{ borderRadius: 16, border: '1px solid var(--cl-border)' }}>
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title">
                {result
                  ? 'Refund complete'
                  : isCredit
                    ? 'Confirm store credit refund'
                    : 'Confirm refund to original payment'}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              {loading && <div className="cl-skeleton" style={{ height: 160 }} />}

              {!loading && error && !result && (
                <div className="alert alert-danger" role="alert" style={{ fontSize: 14 }}>
                  <strong className="d-block mb-1">
                    {isCredit ? 'Store credit was not issued.' : 'The refund was not created.'}
                  </strong>
                  {error.message}
                  <div className="mt-2 cl-source-note">
                    No additional credit was created. Please verify the order in Shopify before
                    trying again.
                  </div>
                </div>
              )}

              {result && (
                <div className="alert alert-success" role="status" style={{ fontSize: 14 }}>
                  <strong className="d-block mb-1">
                    {formatMoney(result.totalCredit ?? result.amount, result.currencyCode)}{' '}
                    {isCredit ? 'store credit issued.' : 'refunded.'}
                  </strong>
                  {result.replayed
                    ? 'This request had already been processed — no duplicate was created.'
                    : 'Shopify has confirmed the transaction.'}
                </div>
              )}

              {!loading && preview && !result && (
                <>
                  <dl className="mb-3" style={{ fontSize: 14 }}>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <dt className="fw-normal text-secondary">Order</dt>
                      <dd className="mb-0 fw-semibold">{preview.order.name}</dd>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <dt className="fw-normal text-secondary">Customer</dt>
                      <dd className="mb-0 fw-semibold">
                        {preview.customer?.displayName || 'Unknown customer'}
                      </dd>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <dt className="fw-normal text-secondary">Currency</dt>
                      <dd className="mb-0 fw-semibold">{currency}</dd>
                    </div>
                    <div className="d-flex justify-content-between py-2 border-bottom">
                      <dt className="fw-normal text-secondary">Refund value</dt>
                      <dd className="mb-0 fw-semibold cl-num">
                        {formatMoney(refundAmount, currency)}
                      </dd>
                    </div>
                    {isCredit && (
                      <>
                        <div className="d-flex justify-content-between py-2 border-bottom">
                          <dt className="fw-normal text-secondary">Credit bonus</dt>
                          <dd className="mb-0 fw-semibold cl-num cl-money-in">
                            {bonus > 0 ? `+${formatMoney(bonus, currency)}` : '—'}
                          </dd>
                        </div>
                        <div className="d-flex justify-content-between py-2">
                          <dt className="fw-semibold" style={{ color: 'var(--cl-navy)' }}>
                            Total store credit
                          </dt>
                          <dd className="mb-0 fw-bold cl-num" style={{ color: 'var(--cl-navy)' }}>
                            {formatMoney(totalCredit, currency)}
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>

                  {isCredit && preview.disclosure && (
                    <div
                      className="p-3 mb-3"
                      style={{
                        background: 'var(--cl-warning-soft)',
                        border: '1px solid #f0d89a',
                        borderRadius: 10,
                        fontSize: 13,
                        color: 'var(--cl-warning)',
                      }}
                    >
                      {preview.disclosure}
                    </div>
                  )}

                  {isCredit && preview.recommendation.appliedRule && (
                    <p className="cl-source-note mb-0">
                      Rule applied: <strong>{preview.recommendation.appliedRule.name}</strong>
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer border-0 pt-0">
              {result ? (
                <button type="button" className="btn btn-cl-primary" onClick={onDone}>
                  Done
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-cl-secondary"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-cl-primary"
                    onClick={submit}
                    disabled={loading || submitting || !preview}
                  >
                    {submitting
                      ? 'Processing…'
                      : isCredit
                        ? `Issue ${formatMoney(totalCredit, currency)} credit`
                        : `Refund ${formatMoney(refundAmount, currency)}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
