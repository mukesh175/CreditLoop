'use client';

import { useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import CampaignForm from '@/components/campaigns/CampaignForm';
import { useApi } from '@/lib/client/useApi';
import { apiFetch } from '@/lib/client/api';
import { useShop } from '@/components/ui/ShopProvider';

const TYPE_LABEL = {
  RETURN_CREDIT: 'Return credit',
  WIN_BACK: 'Win-back credit',
  VIP: 'VIP credit',
};

const STATUS_PILL = {
  DRAFT: 'cl-pill-muted',
  ACTIVE: 'cl-pill-green',
  PAUSED: 'cl-pill-warning',
  COMPLETED: 'cl-pill-muted',
};

function CampaignsView() {
  const { entitlements } = useShop();
  const { data, loading, error, reload } = useApi('/api/campaigns');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function setStatus(campaign, status) {
    setBusy(campaign.id);
    setActionError(null);
    try {
      await apiFetch(`/api/campaigns/${campaign.id}`, { method: 'PATCH', body: { status } });
      await reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function runNow(campaign) {
    setBusy(campaign.id);
    setActionError(null);
    try {
      await apiFetch(`/api/campaigns/${campaign.id}`, { method: 'PATCH', body: { action: 'run' } });
      await reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Remind customers about credit they already hold, and win back the ones who drifted."
        actions={
          <button type="button" className="btn btn-cl-primary btn-sm" onClick={() => setShowForm(true)}>
            New campaign
          </button>
        }
      />

      {!entitlements?.automatedCampaigns && (
        <div className="alert alert-light border mb-3" style={{ fontSize: 14 }}>
          Automated campaigns are available on the Growth plan and above. You can still create
          campaigns as drafts.
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger" style={{ fontSize: 14 }}>
          {actionError}
        </div>
      )}

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading ? (
        <LoadingCard rows={4} />
      ) : data?.campaigns?.length ? (
        <div className="d-flex flex-column gap-3">
          {data.campaigns.map((campaign) => (
            <div className="cl-card" key={campaign.id}>
              <div className="cl-card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <h3 className="cl-card-title mb-0">{campaign.name}</h3>
                      <span className={`cl-pill ${STATUS_PILL[campaign.status]}`}>
                        {campaign.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="cl-source-note">
                      {TYPE_LABEL[campaign.type]} · segment {campaign.segment.replace(/_/g, ' ').toLowerCase()}
                      {campaign.grantsCredit ? ' · grants credit' : ''}
                      {campaign.sendsEmail ? ' · sends email' : ''}
                    </div>
                    {campaign.description && (
                      <p className="mb-0 mt-2" style={{ fontSize: 14 }}>
                        {campaign.description}
                      </p>
                    )}
                  </div>

                  <div className="d-flex gap-2 flex-wrap">
                    {campaign.status === 'ACTIVE' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-cl-secondary btn-sm"
                          disabled={busy === campaign.id}
                          onClick={() => runNow(campaign)}
                        >
                          {busy === campaign.id ? 'Running…' : 'Run now'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-cl-secondary btn-sm"
                          disabled={busy === campaign.id}
                          onClick={() => setStatus(campaign, 'PAUSED')}
                        >
                          Pause
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-cl-primary btn-sm"
                        disabled={busy === campaign.id}
                        onClick={() => setStatus(campaign, 'ACTIVE')}
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-4 mt-3 pt-3 border-top" style={{ fontSize: 13.5 }}>
                  <Stat label="Sent" value={campaign.stats?.SENT || 0} />
                  <Stat label="Skipped" value={campaign.stats?.SKIPPED || 0} />
                  <Stat label="Failed" value={campaign.stats?.FAILED || 0} />
                  <Stat
                    label="Last run"
                    value={campaign.lastRunAt ? new Date(campaign.lastRunAt).toLocaleDateString() : 'Never'}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cl-card">
          <EmptyState
            title="No campaigns yet"
            message="Create a campaign to remind customers about unused credit, or win back customers who have not ordered in a while."
            action={
              <button type="button" className="btn btn-cl-primary" onClick={() => setShowForm(true)}>
                New campaign
              </button>
            }
          />
        </div>
      )}

      <p className="cl-source-note mt-3">
        Customer campaign emails are only sent to customers with marketing consent in Shopify.
        Holding store credit is not consent.
      </p>

      {showForm && (
        <CampaignForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="cl-source-note">{label}</div>
      <div className="fw-semibold cl-num">{value}</div>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Page>
      <CampaignsView />
    </Page>
  );
}
