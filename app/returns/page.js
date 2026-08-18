'use client';

import { useState } from 'react';
import Link from 'next/link';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import LoadingCard from '@/components/ui/LoadingCard';
import Pagination from '@/components/ui/Pagination';
import { useApi } from '@/lib/client/useApi';
import { formatMoney } from '@/lib/util/money';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'credit_offered', label: 'Credit offered' },
  { id: 'credit_accepted', label: 'Credit accepted' },
  { id: 'original_payment', label: 'Original payment' },
  { id: 'pending', label: 'Pending' },
];

const STATUS_PILL = {
  OPEN: 'cl-pill-warning',
  CREDIT_OFFERED: 'cl-pill-muted',
  CREDIT_ISSUED: 'cl-pill-green',
  REFUNDED: 'cl-pill-muted',
  DISMISSED: 'cl-pill-muted',
};

function ReturnsView() {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(`/api/returns?filter=${filter}&page=${page}`);

  return (
    <>
      <PageHeader
        title="Returns"
        subtitle="Every return, and what happened to the refund."
        actions={
          <Link href="/returns/opportunities" className="btn btn-cl-primary btn-sm">
            Return → Credit
          </Link>
        }
      />

      <div className="btn-group btn-group-sm mb-3" role="group" aria-label="Filter returns">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`btn ${filter === f.id ? 'btn-cl-primary' : 'btn-cl-secondary'}`}
            onClick={() => {
              setFilter(f.id);
              setPage(1);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} requestId={error.requestId} />
      ) : loading ? (
        <LoadingCard rows={6} />
      ) : data?.returns?.length ? (
        <div className="cl-card">
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="text-end">Return amount</th>
                  <th>Refund method</th>
                  <th className="text-end">Credit offered</th>
                  <th className="text-end">Bonus</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.returns.map((row) => (
                  <tr key={row.id}>
                    <td className="fw-semibold">
                      <Link
                        href={`/returns/${row.id}`}
                        className="text-decoration-none"
                        style={{ color: 'var(--cl-navy)' }}
                      >
                        {row.orderName || row.orderGid.split('/').pop()}
                      </Link>
                    </td>
                    <td>{row.customer?.displayName || '—'}</td>
                    <td className="text-end cl-num">
                      {formatMoney(row.refundAmount, row.currencyCode)}
                    </td>
                    <td>
                      {row.refundMethod === 'STORE_CREDIT'
                        ? 'Store credit'
                        : row.refundMethod === 'ORIGINAL_PAYMENT'
                          ? 'Original payment'
                          : 'Pending'}
                    </td>
                    <td className="text-end cl-num">
                      {row.creditOffered ? formatMoney(row.creditOffered, row.currencyCode) : '—'}
                    </td>
                    <td className="text-end cl-num">
                      {row.bonusAmount ? (
                        <span className="cl-money-in">
                          +{formatMoney(row.bonusAmount, row.currencyCode)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`cl-pill ${STATUS_PILL[row.status] || 'cl-pill-muted'}`}>
                        {row.status.replace('_', ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="cl-source-note">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onChange={setPage} />
        </div>
      ) : (
        <div className="cl-card">
          <EmptyState
            title="No returns yet"
            message="When customers request returns, they appear here with the store-credit offer CreditLoop recommends."
          />
        </div>
      )}
    </>
  );
}

export default function ReturnsPage() {
  return (
    <Page>
      <ReturnsView />
    </Page>
  );
}
