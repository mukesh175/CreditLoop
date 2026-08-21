'use client';

import { useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingCard from '@/components/ui/LoadingCard';
import Pagination from '@/components/ui/Pagination';
import RefundConfirmDialog from '@/components/returns/RefundConfirmDialog';
import { useApi } from '@/lib/client/useApi';
import { formatMoney } from '@/lib/util/money';

function OpportunitiesView() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('credit');
  const { data, loading, error, reload } = useApi(`/api/returns/opportunities?page=${page}&take=10`);

  return (
    <>
      <PageHeader
        icon="returns"
        title="Return → Credit"
        subtitle="Orders eligible for a store-credit offer. Nothing is issued until you confirm."
      />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} requestId={error.requestId} />
      ) : loading ? (
        <LoadingCard rows={5} />
      ) : data?.opportunities?.length ? (
        <>
          <div className="d-flex flex-column gap-3">
            {data.opportunities.map((item) => (
              <div className="cl-card" key={item.returnEventId}>
                <div className="cl-card-body">
                  <div className="row g-3 align-items-center">
                    <div className="col-12 col-lg-4">
                      <div className="fw-semibold" style={{ color: 'var(--cl-navy)' }}>
                        {item.orderName || item.orderGid.split('/').pop()}
                      </div>
                      <div className="cl-source-note">
                        Customer: {item.customerName || 'Unknown'}
                      </div>
                      <div className="mt-2" style={{ fontSize: 14 }}>
                        Refund value:{' '}
                        <strong className="cl-num">
                          {formatMoney(item.refundAmount, item.currencyCode)}
                        </strong>
                      </div>
                    </div>

                    <div className="col-12 col-lg-4">
                      {item.recommendation.eligible ? (
                        <>
                          <div className="cl-kpi-label">Recommended</div>
                          <div className="h5 mb-1 cl-num cl-money-in">
                            {formatMoney(item.recommendation.totalCredit, item.currencyCode)} store
                            credit
                          </div>
                          <div className="cl-source-note">
                            {formatMoney(item.refundAmount, item.currencyCode)} refund +{' '}
                            {formatMoney(item.recommendation.bonusAmount, item.currencyCode)} bonus
                          </div>
                          <div className="cl-source-note mt-1">
                            {item.recommendation.explanation}
                          </div>
                        </>
                      ) : (
                        <div className="cl-source-note">
                          {item.recommendation.explanation}
                        </div>
                      )}
                    </div>

                    <div className="col-12 col-lg-4">
                      <div className="d-flex flex-column flex-sm-row gap-2 justify-content-lg-end">
                        <button
                          type="button"
                          className="btn btn-cl-primary btn-sm"
                          disabled={!item.recommendation.eligible}
                          onClick={() => {
                            setMode('credit');
                            setSelected(item);
                          }}
                        >
                          Offer credit
                        </button>
                        <button
                          type="button"
                          className="btn btn-cl-secondary btn-sm"
                          onClick={() => {
                            setMode('original');
                            setSelected(item);
                          }}
                        >
                          Refund original payment
                        </button>
                      </div>
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="cl-source-note" style={{ cursor: 'pointer' }}>
                      Customer profile
                    </summary>
                    <div className="row g-3 mt-1" style={{ fontSize: 13.5 }}>
                      <div className="col-6 col-md-3">
                        <div className="cl-source-note">Orders</div>
                        <div className="fw-semibold">{item.customerProfile.orders ?? '—'}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="cl-source-note">Lifetime value</div>
                        <div className="fw-semibold">
                          {item.customerProfile.lifetimeValue != null
                            ? formatMoney(item.customerProfile.lifetimeValue, item.currencyCode)
                            : '—'}
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="cl-source-note">Store credit used before</div>
                        <div className="fw-semibold">
                          {item.customerProfile.previousCreditUses} times
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="cl-source-note">Last purchase</div>
                        <div className="fw-semibold">
                          {item.customerProfile.daysSinceLastOrder != null
                            ? `${item.customerProfile.daysSinceLastOrder} days ago`
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>

          <div className="cl-card mt-3">
            <Pagination pagination={data.pagination} onChange={setPage} />
          </div>
        </>
      ) : (
        <div className="cl-card">
          <EmptyState
            title="No return opportunities yet"
            message="When customers request returns, CreditLoop will help identify eligible store-credit opportunities."
          />
        </div>
      )}

      {selected && (
        <RefundConfirmDialog
          opportunity={selected}
          mode={mode}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </>
  );
}

export default function OpportunitiesPage() {
  return (
    <Page>
      <OpportunitiesView />
    </Page>
  );
}
