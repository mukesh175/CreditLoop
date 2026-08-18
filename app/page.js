'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/ui/AppShell';
import { ShopProvider, useShop } from '@/components/ui/ShopProvider';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import AlertList from '@/components/ui/AlertList';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import SourceBadge from '@/components/ui/SourceBadge';
import CreditPerformanceChart from '@/components/charts/CreditPerformanceChart';
import RangePicker from '@/components/charts/RangePicker';
import { useApi } from '@/lib/client/useApi';
import { formatMoney, formatPercent } from '@/lib/util/money';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Dashboard() {
  const { shop } = useShop();
  const [range, setRange] = useState('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });

  const query = new URLSearchParams({
    range,
    ...(range === 'custom' && custom.from ? { from: custom.from, to: custom.to } : {}),
  }).toString();

  const overview = useApi(`/api/analytics/overview?${query}`);
  const timeseries = useApi(`/api/analytics/timeseries?${query}`);
  const opportunities = useApi('/api/returns/opportunities?take=5');

  const metrics = overview.data?.metrics;
  const currency = metrics?.currencyCode || shop?.currencyCode || 'USD';

  if (overview.error) {
    return (
      <ErrorState
        title="Unable to retrieve store credit data"
        message={overview.error.message}
        lastSyncAt={shop?.lastSyncAt}
        onRetry={overview.reload}
        requestId={overview.error.requestId}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`${greeting()} 👋`}
        subtitle="Turn more returns into repeat purchases."
        actions={<RangePicker value={range} onChange={setRange} custom={custom} onCustomChange={setCustom} />}
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <KpiCard
            label="Credit issued"
            value={metrics?.creditIssued}
            currencyCode={currency}
            change={metrics?.creditIssuedChange}
            loading={overview.loading}
          />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard
            label="Credit redeemed"
            value={metrics?.creditRedeemed}
            currencyCode={currency}
            change={metrics?.creditRedeemedChange}
            loading={overview.loading}
          />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard
            label="Revenue from credit"
            value={metrics?.revenueFromCreditOrders}
            currencyCode={currency}
            change={metrics?.revenueChange}
            hint="orders using credit"
            loading={overview.loading}
          />
        </div>
        <div className="col-6 col-xl-3">
          <KpiCard
            label="Repeat purchase rate"
            value={metrics?.repeatPurchaseRate}
            format="percent"
            hint="credit users"
            loading={overview.loading}
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-8">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Credit performance</h2>
              <span className="cl-source-note">{currency}</span>
            </div>
            <div className="cl-card-body">
              {timeseries.loading ? (
                <div className="cl-skeleton" style={{ height: 260 }} />
              ) : (
                <CreditPerformanceChart
                  series={timeseries.data?.series || []}
                  currencyCode={currency}
                />
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Credit health</h2>
              <SourceBadge syncedAt={metrics?.outstandingSyncedAt} />
            </div>
            <div className="cl-card-body">
              <div className="cl-kpi-label">Outstanding</div>
              <div className="cl-kpi-value cl-num mb-3">
                {formatMoney(metrics?.outstandingCredit || 0, currency)}
              </div>

              <dl className="mb-0" style={{ fontSize: 14 }}>
                <div className="d-flex justify-content-between py-2 border-top">
                  <dt className="fw-normal text-secondary">Credit redemption rate</dt>
                  <dd className="mb-0 fw-semibold cl-num">
                    {formatPercent(metrics?.creditRedemptionRate)}
                  </dd>
                </div>
                <div className="d-flex justify-content-between py-2 border-top">
                  <dt className="fw-normal text-secondary">Orders using credit</dt>
                  <dd className="mb-0 fw-semibold cl-num">{metrics?.ordersUsingCredit ?? 0}</dd>
                </div>
                <div className="d-flex justify-content-between py-2 border-top">
                  <dt className="fw-normal text-secondary">Average order value</dt>
                  <dd className="mb-0 fw-semibold cl-num">
                    {formatMoney(metrics?.averageOrderValue || 0, currency)}
                  </dd>
                </div>
              </dl>

              <Link href="/credit" className="btn btn-cl-secondary btn-sm w-100 mt-3">
                View credit
              </Link>
            </div>
          </div>
        </div>
      </div>

      {overview.data?.alerts?.length > 0 && (
        <div className="mb-4">
          <h2 className="h6 mb-2">Alerts</h2>
          <AlertList alerts={overview.data.alerts} />
        </div>
      )}

      <div className="cl-card">
        <div className="cl-card-header">
          <h2 className="cl-card-title">Recent return opportunities</h2>
          <Link href="/returns" className="cl-source-note text-decoration-none">
            View all →
          </Link>
        </div>

        {opportunities.loading ? (
          <div className="cl-card-body">
            <div className="cl-skeleton mb-2" style={{ height: 18 }} />
            <div className="cl-skeleton" style={{ height: 18, width: '80%' }} />
          </div>
        ) : opportunities.data?.opportunities?.length ? (
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="text-end">Refund value</th>
                  <th className="text-end">Recommended credit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {opportunities.data.opportunities.map((item) => (
                  <tr key={item.returnEventId}>
                    <td className="fw-semibold">{item.orderName || '—'}</td>
                    <td>{item.customerName || 'Unknown customer'}</td>
                    <td className="text-end cl-num">
                      {formatMoney(item.refundAmount, item.currencyCode)}
                    </td>
                    <td className="text-end cl-num">
                      {item.recommendation.eligible ? (
                        <span className="cl-money-in">
                          {formatMoney(item.recommendation.totalCredit, item.currencyCode)}
                        </span>
                      ) : (
                        <span className="text-secondary">No offer</span>
                      )}
                    </td>
                    <td className="text-end">
                      <Link
                        href={`/returns/${encodeURIComponent(item.returnEventId)}`}
                        className="btn btn-cl-secondary btn-sm"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No return opportunities yet"
            message="When customers request returns, CreditLoop will help identify eligible store-credit opportunities."
          />
        )}
      </div>

      <p className="cl-source-note mt-3 mb-0">{overview.data?.revenueDisclaimer}</p>
    </>
  );
}

function Shell() {
  const { shop } = useShop();
  return (
    <AppShell shop={shop} demoMode={shop?.demoMode}>
      <Dashboard />
    </AppShell>
  );
}

export default function OverviewPage() {
  return (
    <ShopProvider>
      <Shell />
    </ShopProvider>
  );
}
