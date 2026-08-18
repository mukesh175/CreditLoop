'use client';

import { use } from 'react';
import Link from 'next/link';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import SourceBadge from '@/components/ui/SourceBadge';
import { useApi } from '@/lib/client/useApi';
import { formatMoney } from '@/lib/util/money';

function CustomerDetail({ id }) {
  const { data, loading, error, reload } = useApi(`/api/customers/${encodeURIComponent(id)}`);

  if (loading) return <LoadingCard rows={6} />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const { shopify, creditloop } = data;
  const account = shopify.storeCreditAccounts[0];

  return (
    <>
      <PageHeader
        title={shopify.displayName || 'Customer'}
        subtitle={`${shopify.orderCount} orders · ${formatMoney(
          shopify.lifetimeValue,
          shopify.lifetimeValueCurrency
        )} lifetime value`}
        actions={
          <Link href="/customers" className="btn btn-cl-secondary btn-sm">
            Back to customers
          </Link>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-4">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Store credit</h2>
              <SourceBadge source="shopify" />
            </div>
            <div className="cl-card-body">
              {shopify.storeCreditAccounts.length ? (
                shopify.storeCreditAccounts.map((acct) => (
                  <div key={acct.id} className="mb-3">
                    <div className="cl-kpi-value cl-num">
                      {formatMoney(acct.balance, acct.currencyCode)}
                    </div>
                    <div className="cl-source-note">{acct.currencyCode} account</div>
                  </div>
                ))
              ) : (
                <p className="cl-source-note mb-0">No store credit account yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <h2 className="cl-card-title">CreditLoop analytics</h2>
              <SourceBadge />
            </div>
            <div className="cl-card-body">
              <div className="row g-3">
                <Stat
                  label="Total issued"
                  value={formatMoney(creditloop.totalIssued, account?.currencyCode || 'USD')}
                />
                <Stat
                  label="Total redeemed"
                  value={formatMoney(creditloop.totalRedeemed, account?.currencyCode || 'USD')}
                />
                <Stat label="Orders" value={shopify.orderCount} />
                <Stat label="Credit purchases" value={creditloop.creditPurchases} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cl-card mb-4">
        <div className="cl-card-header">
          <h2 className="cl-card-title">Credit history</h2>
          <SourceBadge />
        </div>
        {creditloop.events.length ? (
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-end">Amount</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {creditloop.events.map((event) => (
                  <tr key={event.id}>
                    <td className="cl-source-note">
                      {new Date(event.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-end cl-num">
                      <span className={event.eventType === 'CREDIT' ? 'cl-money-in' : 'cl-money-out'}>
                        {event.eventType === 'CREDIT' ? '+' : '−'}
                        {formatMoney(event.amount, event.currencyCode)}
                      </span>
                    </td>
                    <td>{event.eventType === 'CREDIT' ? 'Credit' : 'Debit'}</td>
                    <td className="cl-source-note">{event.source.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="cl-source-note">
                      {event.orderGid ? event.orderGid.split('/').pop() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cl-card-body">
            <p className="cl-source-note mb-0">No CreditLoop credit activity for this customer.</p>
          </div>
        )}
      </div>

      <p className="cl-source-note">
        Balances shown as “Shopify balance” are read live from Shopify Store Credit, which is the
        source of truth. CreditLoop figures are analytics derived from events this app recorded.
      </p>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="col-6 col-md-3">
      <div className="cl-kpi-label mb-1">{label}</div>
      <div className="fw-bold cl-num" style={{ fontSize: 19, color: 'var(--cl-navy)' }}>
        {value}
      </div>
    </div>
  );
}

export default function CustomerDetailPage({ params }) {
  const { id } = use(params);
  return (
    <Page>
      <CustomerDetail id={decodeURIComponent(id)} />
    </Page>
  );
}
