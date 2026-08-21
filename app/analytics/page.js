'use client';

import { useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import CreditPerformanceChart from '@/components/charts/CreditPerformanceChart';
import RangePicker from '@/components/charts/RangePicker';
import { useApi } from '@/lib/client/useApi';
import { formatMoney, formatPercent } from '@/lib/util/money';

function AnalyticsView() {
  const [range, setRange] = useState('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const query = new URLSearchParams({
    range,
    ...(range === 'custom' && custom.from ? { from: custom.from, to: custom.to } : {}),
  }).toString();

  const overview = useApi(`/api/analytics/overview?${query}`);
  const series = useApi(`/api/analytics/timeseries?${query}`);
  const repeat = useApi(`/api/analytics/repeat-purchase?${query}`);

  const metrics = overview.data?.metrics;
  const currency = metrics?.currencyCode || 'USD';
  const stats = repeat.data?.stats;

  if (overview.error) {
    return <ErrorState message={overview.error.message} onRetry={overview.reload} />;
  }

  return (
    <>
      <PageHeader
        icon="analytics"
        title="Analytics"
        subtitle="What happened after you issued store credit."
        actions={
          <RangePicker value={range} onChange={setRange} custom={custom} onCustomChange={setCustom} />
        }
      />

      <div className="cl-card mb-4">
        <div className="cl-card-header">
          <h2 className="cl-card-title">CreditLoop impact</h2>
          <span className="cl-source-note">{currency}</span>
        </div>
        <div className="cl-card-body">
          <div className="row g-4">
            <Impact label="Store credit issued" value={formatMoney(metrics?.creditIssued || 0, currency)} />
            <Impact label="Credit redeemed" value={formatMoney(metrics?.creditRedeemed || 0, currency)} />
            <Impact label="Orders using credit" value={metrics?.ordersUsingCredit ?? 0} />
            <Impact
              label="Revenue from orders using credit"
              value={formatMoney(metrics?.revenueFromCreditOrders || 0, currency)}
            />
            <Impact
              label="Average order value"
              value={formatMoney(metrics?.averageOrderValue || 0, currency)}
            />
            <Impact
              label="Repeat purchase rate"
              value={formatPercent(metrics?.repeatPurchaseRate || 0)}
            />
          </div>
          <p className="cl-source-note mt-3 mb-0">{overview.data?.revenueDisclaimer}</p>
        </div>
      </div>

      <div className="cl-card mb-4">
        <div className="cl-card-header">
          <h2 className="cl-card-title">Credit issued, redeemed and revenue</h2>
        </div>
        <div className="cl-card-body">
          {series.loading ? (
            <div className="cl-skeleton" style={{ height: 260 }} />
          ) : (
            <CreditPerformanceChart series={series.data?.series || []} currencyCode={currency} />
          )}
        </div>
      </div>

      <h2 className="h6 mb-2">Repeat purchase</h2>
      {repeat.loading ? (
        <LoadingCard rows={4} />
      ) : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-xl-3">
              <KpiCard label="Customers who used credit" value={stats?.creditCustomers} format="number" />
            </div>
            <div className="col-6 col-xl-3">
              <KpiCard label="Returned to purchase" value={stats?.returnedToPurchase} format="number" />
            </div>
            <div className="col-6 col-xl-3">
              <KpiCard label="Repeat purchase rate" value={stats?.repeatPurchaseRate} format="percent" />
            </div>
            <div className="col-6 col-xl-3">
              <KpiCard
                label="Avg days to next purchase"
                value={stats?.averageDaysToNextPurchase ?? 0}
                format="number"
              />
            </div>
          </div>

          <div className="cl-card">
            <div className="cl-card-header">
              <h3 className="cl-card-title">Credit users vs non-credit customers</h3>
            </div>
            <div className="cl-table-wrap">
              <table className="cl-table">
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th className="text-end">Credit users</th>
                    <th className="text-end">Non-credit customers</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Repeat purchase rate</td>
                    <td className="text-end cl-num fw-semibold">
                      {formatPercent(stats?.repeatPurchaseRate || 0)}
                    </td>
                    <td className="text-end cl-num">
                      {formatPercent(stats?.comparison?.nonCreditRepeatRate || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>Average order value</td>
                    <td className="text-end cl-num fw-semibold">
                      {formatMoney(stats?.averageOrderValue || 0, currency)}
                    </td>
                    <td className="text-end cl-num">
                      {formatMoney(stats?.comparison?.nonCreditAverageOrderValue || 0, currency)}
                    </td>
                  </tr>
                  <tr>
                    <td>Orders in period</td>
                    <td className="text-end cl-num fw-semibold">{metrics?.ordersUsingCredit ?? 0}</td>
                    <td className="text-end cl-num">{stats?.comparison?.nonCreditOrders ?? 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="cl-card-body pt-0">
              <p className="cl-source-note mb-0">
                <strong>Observed comparison.</strong> {repeat.data?.methodology}
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Impact({ label, value }) {
  return (
    <div className="col-6 col-md-4">
      <div className="cl-kpi-label mb-1">{label}</div>
      <div className="fw-bold cl-num" style={{ fontSize: 22, color: 'var(--cl-navy)' }}>
        {value}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Page>
      <AnalyticsView />
    </Page>
  );
}
