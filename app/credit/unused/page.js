'use client';

import { useState } from 'react';
import Link from 'next/link';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import SourceBadge from '@/components/ui/SourceBadge';
import { StatusPill } from '../page';
import { useApi } from '@/lib/client/useApi';
import { formatMoney } from '@/lib/util/money';

function UnusedView() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const { data, loading, error, reload } = useApi(
    `/api/credit/unused?page=${page}&filter=${filter}`
  );

  const buckets = data?.buckets;
  const currency = data?.currencyCode || 'USD';

  return (
    <>
      <PageHeader
        title="Unused store credit"
        subtitle="Credit sitting idle is the clearest retention opportunity you have."
        actions={
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className={`btn ${filter === 'all' ? 'btn-cl-primary' : 'btn-cl-secondary'}`}
              onClick={() => setFilter('all')}
            >
              All holders
            </button>
            <button
              type="button"
              className={`btn ${filter === 'expiring' ? 'btn-cl-primary' : 'btn-cl-secondary'}`}
              onClick={() => setFilter('expiring')}
            >
              Expiring
            </button>
          </div>
        }
      />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        <>
          <div className="row g-3 mb-4">
            {[
              { label: 'Total outstanding', value: buckets?.total },
              { label: 'Unused 30+ days', value: buckets?.days30 },
              { label: 'Unused 60+ days', value: buckets?.days60 },
              { label: 'Unused 90+ days', value: buckets?.days90 },
            ].map((bucket) => (
              <div className="col-6 col-xl-3" key={bucket.label}>
                <div className="cl-card h-100">
                  <div className="cl-card-body">
                    <div className="cl-kpi-label mb-2">{bucket.label}</div>
                    {loading ? (
                      <div className="cl-skeleton" style={{ height: 28 }} />
                    ) : (
                      <div className="cl-kpi-value cl-num">
                        {formatMoney(bucket.value || 0, currency)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="cl-card">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Customers holding credit</h2>
              <SourceBadge syncedAt={data?.outstanding?.syncedAt} />
            </div>

            {loading ? (
              <div className="cl-card-body">
                <LoadingCard rows={5} title={false} />
              </div>
            ) : data?.customers?.length ? (
              <>
                <div className="cl-table-wrap">
                  <table className="cl-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th className="text-end">Credit</th>
                        <th>Last purchase</th>
                        <th>Credit age</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customers.map((customer) => (
                        <tr key={customer.customerGid}>
                          <td>
                            <Link
                              href={`/customers/${encodeURIComponent(customer.customerGid)}`}
                              className="text-decoration-none fw-semibold"
                              style={{ color: 'var(--cl-navy)' }}
                            >
                              {customer.displayName || customer.customerGid.split('/').pop()}
                            </Link>
                          </td>
                          <td className="text-end cl-num fw-semibold">
                            {formatMoney(customer.balance, customer.currencyCode)}
                          </td>
                          <td className="cl-source-note">
                            {customer.lastOrderAt
                              ? `${Math.floor(
                                  (Date.now() - new Date(customer.lastOrderAt)) / 86400000
                                )} days ago`
                              : '—'}
                          </td>
                          <td className="cl-source-note">{customer.creditAgeDays} days</td>
                          <td>
                            <StatusPill status={customer.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination pagination={data.pagination} onChange={setPage} />
              </>
            ) : (
              <EmptyState
                title="No unused credit"
                message="Every customer with store credit has been spending it. That is the outcome you want."
              />
            )}
          </div>

          <p className="cl-source-note mt-3">{data?.note}</p>
        </>
      )}
    </>
  );
}

export default function UnusedCreditPage() {
  return (
    <Page>
      <UnusedView />
    </Page>
  );
}
