'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import RefundConfirmDialog from '@/components/returns/RefundConfirmDialog';
import { useApi } from '@/lib/client/useApi';
import { formatMoney } from '@/lib/util/money';

function ReturnDetail({ id }) {
  const { data, loading, error, reload } = useApi('/api/returns/opportunities?take=50');
  const [dialog, setDialog] = useState(null);

  const item = data?.opportunities?.find((o) => o.returnEventId === id);

  if (loading) return <LoadingCard rows={6} />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!item) {
    return (
      <ErrorState
        title="Return not found"
        message="This return is no longer open, or it has already been resolved."
      />
    );
  }

  return (
    <>
      <PageHeader
        title={item.orderName || 'Return'}
        subtitle={`Return from ${item.customerName || 'an unknown customer'}`}
        actions={
          <Link href="/returns" className="btn btn-cl-secondary btn-sm">
            Back to returns
          </Link>
        }
      />

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <div className="cl-card">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Recommendation</h2>
            </div>
            <div className="cl-card-body">
              <div className="cl-kpi-label">Refund value</div>
              <div className="h4 cl-num mb-3">
                {formatMoney(item.refundAmount, item.currencyCode)}
              </div>

              {item.recommendation.eligible ? (
                <>
                  <div className="cl-kpi-label">Recommended store credit</div>
                  <div className="h3 cl-num cl-money-in mb-2">
                    {formatMoney(item.recommendation.totalCredit, item.currencyCode)}
                  </div>
                  <p className="cl-source-note">
                    {formatMoney(item.refundAmount, item.currencyCode)} refund +{' '}
                    {formatMoney(item.recommendation.bonusAmount, item.currencyCode)}{' '}
                    merchant-funded bonus
                  </p>
                  <p style={{ fontSize: 14 }}>{item.recommendation.explanation}</p>
                </>
              ) : (
                <p style={{ fontSize: 14 }}>{item.recommendation.explanation}</p>
              )}

              <div className="d-flex gap-2 mt-3 flex-wrap">
                <button
                  type="button"
                  className="btn btn-cl-primary"
                  disabled={!item.recommendation.eligible}
                  onClick={() => setDialog('credit')}
                >
                  Offer credit
                </button>
                <button
                  type="button"
                  className="btn btn-cl-secondary"
                  onClick={() => setDialog('original')}
                >
                  Refund original payment
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="cl-card">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Customer profile</h2>
            </div>
            <div className="cl-card-body">
              <dl className="mb-0" style={{ fontSize: 14 }}>
                <Row label="Orders" value={item.customerProfile.orders ?? '—'} />
                <Row
                  label="Lifetime value"
                  value={
                    item.customerProfile.lifetimeValue != null
                      ? formatMoney(item.customerProfile.lifetimeValue, item.currencyCode)
                      : '—'
                  }
                />
                <Row
                  label="Previous store-credit usage"
                  value={`${item.customerProfile.previousCreditUses} times`}
                />
                <Row
                  label="Last purchase"
                  value={
                    item.customerProfile.daysSinceLastOrder != null
                      ? `${item.customerProfile.daysSinceLastOrder} days ago`
                      : '—'
                  }
                />
              </dl>
            </div>
          </div>
        </div>
      </div>

      {dialog && (
        <RefundConfirmDialog
          opportunity={item}
          mode={dialog}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="d-flex justify-content-between py-2 border-bottom">
      <dt className="fw-normal text-secondary">{label}</dt>
      <dd className="mb-0 fw-semibold">{value}</dd>
    </div>
  );
}

export default function ReturnDetailPage({ params }) {
  const { id } = use(params);
  return (
    <Page>
      <ReturnDetail id={id} />
    </Page>
  );
}
