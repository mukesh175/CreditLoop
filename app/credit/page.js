'use client';

import Link from 'next/link';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import SourceBadge from '@/components/ui/SourceBadge';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { useApi } from '@/lib/client/useApi';
import { formatMoney } from '@/lib/util/money';

function CreditView() {
  const overview = useApi('/api/analytics/overview?range=30d');
  const unused = useApi('/api/credit/unused?take=10');
  const reconciliation = useApi('/api/analytics/reconciliation');

  const metrics = overview.data?.metrics;
  const currency = metrics?.currencyCode || 'USD';

  if (overview.error) {
    return <ErrorState message={overview.error.message} onRetry={overview.reload} />;
  }

  return (
    <>
      <PageHeader
        title="Credit"
        subtitle="Outstanding store credit and what it is turning into."
        actions={
          <Link href="/credit/unused" className="btn btn-cl-secondary btn-sm">
            Unused credit
          </Link>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <KpiCard
            label="Outstanding"
            value={metrics?.outstandingCredit}
            currencyCode={currency}
            loading={overview.loading}
          />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard
            label="Issued (30d)"
            value={metrics?.creditIssued}
            currencyCode={currency}
            change={metrics?.creditIssuedChange}
            loading={overview.loading}
          />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard
            label="Redeemed (30d)"
            value={metrics?.creditRedeemed}
            currencyCode={currency}
            change={metrics?.creditRedeemedChange}
            loading={overview.loading}
          />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard
            label="Redemption rate"
            value={metrics?.creditRedemptionRate}
            format="percent"
            loading={overview.loading}
          />
        </div>
      </div>

      {reconciliation.data?.records?.length > 0 && (
        <div className="cl-card mb-4" style={{ borderColor: '#f0d89a' }}>
          <div className="cl-card-header">
            <h2 className="cl-card-title">Reconciliation warnings</h2>
            <span className="cl-pill cl-pill-warning">
              {reconciliation.data.records.length} to review
            </span>
          </div>
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-end">CreditLoop expected</th>
                  <th className="text-end">Shopify balance</th>
                  <th className="text-end">Difference</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.data.records.slice(0, 5).map((record) => (
                  <tr key={record.id}>
                    <td className="cl-source-note">{record.customerGid.split('/').pop()}</td>
                    <td className="text-end cl-num">
                      {formatMoney(record.expectedFromEvents, record.currencyCode)}
                    </td>
                    <td className="text-end cl-num fw-semibold">
                      {formatMoney(record.shopifyBalance, record.currencyCode)}
                    </td>
                    <td className="text-end cl-num">
                      {formatMoney(record.difference, record.currencyCode)}
                    </td>
                    <td>
                      <span className="cl-pill cl-pill-warning">Review required</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cl-card-body pt-0">
            <p className="cl-source-note mb-0">{reconciliation.data.note}</p>
          </div>
        </div>
      )}

      <div className="cl-card">
        <div className="cl-card-header">
          <h2 className="cl-card-title">Credit holders</h2>
          <SourceBadge syncedAt={unused.data?.outstanding?.syncedAt} />
        </div>

        {unused.loading ? (
          <div className="cl-card-body">
            <LoadingCard rows={4} title={false} />
          </div>
        ) : unused.data?.customers?.length ? (
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-end">Credit</th>
                  <th className="text-end">Orders</th>
                  <th>Credit age</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {unused.data.customers.map((customer) => (
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
                    <td className="text-end cl-num">{customer.orderCount}</td>
                    <td className="cl-source-note">{customer.creditAgeDays} days</td>
                    <td>
                      <StatusPill status={customer.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No store credit activity yet"
            message="Once store credit is issued or redeemed, your performance data will appear here."
          />
        )}
      </div>
    </>
  );
}

export function StatusPill({ status }) {
  if (status === 'LONG_UNUSED') return <span className="cl-pill cl-pill-danger">🔴 Long unused</span>;
  if (status === 'UNUSED') return <span className="cl-pill cl-pill-warning">⚠️ Unused</span>;
  return <span className="cl-pill cl-pill-green">🟢 Active</span>;
}

export default function CreditPage() {
  return (
    <Page>
      <CreditView />
    </Page>
  );
}
