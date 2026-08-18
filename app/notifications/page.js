'use client';

import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import AlertList from '@/components/ui/AlertList';
import EmptyState from '@/components/ui/EmptyState';
import { useApi } from '@/lib/client/useApi';

function NotificationsView() {
  const alerts = useApi('/api/analytics/overview?range=30d');
  const prefs = useApi('/api/notifications/preferences');

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="What needs your attention, and what CreditLoop has sent."
      />

      {alerts.error ? (
        <ErrorState message={alerts.error.message} onRetry={alerts.reload} />
      ) : alerts.loading ? (
        <LoadingCard rows={3} />
      ) : alerts.data?.alerts?.length ? (
        <AlertList alerts={alerts.data.alerts} />
      ) : (
        <div className="cl-card">
          <EmptyState
            title="Nothing needs your attention"
            message="Alerts about outstanding credit, unused balances and expiring credit will appear here."
          />
        </div>
      )}

      <div className="cl-card mt-4">
        <div className="cl-card-header">
          <h2 className="cl-card-title">Delivery settings</h2>
          <a href="/settings/notifications" className="cl-source-note text-decoration-none">
            Manage →
          </a>
        </div>
        <div className="cl-card-body">
          {prefs.loading ? (
            <div className="cl-skeleton" style={{ height: 60 }} />
          ) : (
            <div className="row g-3" style={{ fontSize: 14 }}>
              <Toggle label="Weekly credit report" on={prefs.data?.preferences?.weeklyReport} />
              <Toggle label="Large credit issued" on={prefs.data?.preferences?.largeCreditIssued} />
              <Toggle label="Credit redemption spike" on={prefs.data?.preferences?.redemptionSpike} />
              <Toggle
                label="Expiring credit summary"
                on={prefs.data?.preferences?.expiringCreditSummary}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Toggle({ label, on }) {
  return (
    <div className="col-6 col-md-3">
      <span className={`cl-pill ${on ? 'cl-pill-green' : 'cl-pill-muted'}`}>{on ? 'ON' : 'OFF'}</span>
      <div className="mt-1">{label}</div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Page>
      <NotificationsView />
    </Page>
  );
}
