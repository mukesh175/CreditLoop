'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/ui/AppShell';
import { ShopProvider, useShop } from '@/components/ui/ShopProvider';
import KpiCard from '@/components/ui/KpiCard';
import Gauge from '@/components/ui/Gauge';
import AlertList from '@/components/ui/AlertList';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import CreditPerformanceChart from '@/components/charts/CreditPerformanceChart';
import RangePicker from '@/components/charts/RangePicker';
import { useApi, invalidateApiCache } from '@/lib/client/useApi';
import { formatMoney, formatPercent } from '@/lib/util/money';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Dashboard({ onAlerts }) {
  const { shop } = useShop();
  const [range, setRange] = useState('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });

  const query = new URLSearchParams({
    range,
    ...(range === 'custom' && custom.from ? { from: custom.from, to: custom.to } : {}),
  }).toString();

  const overview = useApi(`/api/analytics/overview?${query}`);
  const timeseries = useApi(`/api/analytics/timeseries?${query}`);
  const opportunities = useApi('/api/returns/opportunities?take=4');

  const metrics = overview.data?.metrics;
  const alerts = overview.data?.alerts || [];

  // Feed the sidebar badge from the response already loaded here.
  useEffect(() => {
    onAlerts?.(alerts.length);
  }, [alerts.length, onAlerts]);
  const currency = metrics?.currencyCode || shop?.currencyCode || 'USD';
  const storeName = shop?.name || shop?.domain?.replace('.myshopify.com', '') || 'there';

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

  const criticalCount = alerts.filter((a) => a.tone === 'danger').length;
  const warningCount = alerts.filter((a) => a.tone === 'warning').length;

  return (
    <>
      {/* Hero ------------------------------------------------------------- */}
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="mb-1" style={{ fontSize: 26 }}>
            {greeting()}, {storeName} 👋
          </h1>
          <p className="mb-0 cl-source-note" style={{ fontSize: 14 }}>
            Turn more returns into repeat purchases.
          </p>
        </div>
        <RangePicker value={range} onChange={setRange} custom={custom} onCustomChange={setCustom} />
      </div>

      {/* Health + KPIs ---------------------------------------------------- */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-4">
          <div className="cl-card h-100">
            <div className="cl-card-body text-center py-4">
              <Gauge
                value={metrics?.creditRedemptionRate || 0}
                label="Redemption"
                loading={overview.loading}
                caption={
                  overview.loading
                    ? null
                    : `${formatMoney(metrics?.creditRedeemed || 0, currency)} of ${formatMoney(
                        metrics?.creditIssued || 0,
                        currency
                      )} issued has come back`
                }
              />

              <div className="d-flex justify-content-center gap-3 mt-3 pt-3 border-top">
                <span className="cl-source-note">
                  <strong style={{ color: 'var(--cl-danger)' }}>{criticalCount}</strong> critical
                </span>
                <span className="cl-source-note">
                  <strong style={{ color: '#a86a00' }}>{warningCount}</strong> warnings
                </span>
                <span className="cl-source-note">
                  <strong style={{ color: 'var(--cl-green-dark)' }}>
                    {metrics?.ordersUsingCredit ?? 0}
                  </strong>{' '}
                  credit orders
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="row g-3">
            <div className="col-6">
              <KpiCard
                label="Credit issued"
                value={metrics?.creditIssued}
                currencyCode={currency}
                change={metrics?.creditIssuedChange}
                loading={overview.loading}
                accent="var(--cl-green)"
              />
            </div>
            <div className="col-6">
              <KpiCard
                label="Credit redeemed"
                value={metrics?.creditRedeemed}
                currencyCode={currency}
                change={metrics?.creditRedeemedChange}
                loading={overview.loading}
                accent="#2a6df4"
              />
            </div>
            <div className="col-6">
              <KpiCard
                label="Revenue from credit"
                value={metrics?.revenueFromCreditOrders}
                currencyCode={currency}
                change={metrics?.revenueChange}
                hint="orders using credit"
                loading={overview.loading}
                accent="#8b5cf6"
              />
            </div>
            <div className="col-6">
              <KpiCard
                label="Outstanding credit"
                value={metrics?.outstandingCredit}
                currencyCode={currency}
                change={null}
                hint="held in Shopify"
                loading={overview.loading}
                accent="#e0a53a"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Performance ------------------------------------------------------ */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-8">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Credit performance</h2>
              <Link href="/analytics" className="btn btn-cl-ghost btn-sm">
                Analytics
              </Link>
            </div>
            <div className="cl-card-body">
              {timeseries.loading ? (
                <div className="cl-skeleton" style={{ height: 250 }} />
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
              <h2 className="cl-card-title">At a glance</h2>
            </div>
            <div className="cl-card-body">
              <dl className="mb-0" style={{ fontSize: 14 }}>
                {[
                  ['Orders using credit', metrics?.ordersUsingCredit ?? 0],
                  ['Average order value', formatMoney(metrics?.averageOrderValue || 0, currency)],
                  ['Repeat purchase rate', formatPercent(metrics?.repeatPurchaseRate || 0)],
                  ['Bonus issued', formatMoney(metrics?.bonusIssued || 0, currency)],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`d-flex justify-content-between py-2${index ? ' border-top' : ''}`}
                  >
                    <dt className="fw-normal" style={{ color: 'var(--cl-muted)' }}>
                      {label}
                    </dt>
                    <dd className="mb-0 fw-semibold cl-num" style={{ color: 'var(--cl-navy)' }}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <Link href="/credit" className="btn btn-cl-secondary btn-sm w-100 mt-3">
                View credit
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Today's brief ---------------------------------------------------- */}
      <div className="row g-3">
        <div className="col-12 col-xl-6">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <div className="d-flex align-items-center gap-2">
                <Icon name="alert" size={16} style={{ color: 'var(--cl-muted)' }} />
                <h2 className="cl-card-title">Needs your attention</h2>
              </div>
              {alerts.length > 0 && (
                <span className="cl-pill cl-pill-muted">{alerts.length}</span>
              )}
            </div>

            {overview.loading ? (
              <div className="cl-card-body">
                <div className="cl-skeleton mb-2" style={{ height: 16 }} />
                <div className="cl-skeleton" style={{ height: 16, width: '70%' }} />
              </div>
            ) : alerts.length ? (
              <AlertList alerts={alerts} />
            ) : (
              <EmptyState
                icon="check"
                title="Nothing needs attention"
                message="Alerts about outstanding credit, unused balances and expiring credit will appear here."
              />
            )}
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <div className="d-flex align-items-center gap-2">
                <Icon name="returns" size={16} style={{ color: 'var(--cl-muted)' }} />
                <h2 className="cl-card-title">Return opportunities</h2>
              </div>
              <Link href="/returns/opportunities" className="btn btn-cl-ghost btn-sm">
                View all
              </Link>
            </div>

            {opportunities.loading ? (
              <div className="cl-card-body">
                <div className="cl-skeleton mb-2" style={{ height: 16 }} />
                <div className="cl-skeleton" style={{ height: 16, width: '80%' }} />
              </div>
            ) : opportunities.data?.opportunities?.length ? (
              <div className="cl-table-wrap">
                <table className="cl-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th className="text-end">Refund</th>
                      <th className="text-end">Recommended</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.data.opportunities.map((item) => (
                      <tr key={item.returnEventId}>
                        <td className="fw-semibold" style={{ color: 'var(--cl-navy)' }}>
                          {item.orderName || '—'}
                        </td>
                        <td>{item.customerName || 'Unknown'}</td>
                        <td className="text-end cl-num">
                          {formatMoney(item.refundAmount, item.currencyCode)}
                        </td>
                        <td className="text-end cl-num">
                          {item.recommendation.eligible ? (
                            <span className="cl-money-in">
                              {formatMoney(item.recommendation.totalCredit, item.currencyCode)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--cl-faint)' }}>—</span>
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
                icon="returns"
                title="No return opportunities yet"
                message="When customers request returns, CreditLoop will identify eligible store-credit opportunities here."
              />
            )}
          </div>
        </div>
      </div>

      <p className="cl-source-note mt-3 mb-0">{overview.data?.revenueDisclaimer}</p>
    </>
  );
}

function Shell() {
  const { shop, reload } = useShop();
  // The dashboard already loads the overview; the badge reads the same cached
  // response rather than issuing a second identical request.
  const [alertCount, setAlertCount] = useState(0);

  return (
    <AppShell
      shop={shop}
      demoMode={shop?.demoMode}
      badges={{ alerts: alertCount }}
      onSynced={() => {
        invalidateApiCache('/api/');
        reload?.();
      }}
    >
      <Dashboard onAlerts={setAlertCount} />
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
