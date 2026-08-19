'use client';

import { useEffect, useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import { useApi } from '@/lib/client/useApi';
import { apiFetch } from '@/lib/client/api';

const SCOPE_REASONS = {
  read_orders: 'Read order totals and refund history to build return opportunities and attribution.',
  write_orders: 'Create refunds when you choose to refund an order to store credit.',
  read_returns: 'Read return requests so CreditLoop can suggest a credit offer.',
  read_customers: 'Read order counts, spend and marketing consent used by rules and campaigns.',
  read_store_credit_accounts: 'Read the authoritative store credit balance and transactions.',
  write_store_credit_account_transactions: 'Issue the store credit and bonuses you approve.',
};

function SettingsView() {
  const { data, loading, reload } = useApi('/api/shop');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);

  async function runSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await apiFetch('/api/onboarding', {
        method: 'POST',
        body: { action: 'sync' },
      });
      setSyncResult(result);
      reload();
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (data?.shop && !form) {
      setForm({
        defaultBonusPercent: data.shop.defaultBonusPercent,
        defaultMaxBonus: data.shop.defaultMaxBonus,
        recommendationsEnabled: data.shop.recommendationsEnabled,
      });
    }
  }, [data, form]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch('/api/shop', { method: 'PATCH', body: form });
      setSaved(true);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) return <LoadingCard rows={5} />;

  return (
    <>
      <PageHeader title="General settings" subtitle="Store defaults and app permissions." />

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <form className="cl-card" onSubmit={save}>
            <div className="cl-card-header">
              <h2 className="cl-card-title">Credit defaults</h2>
            </div>
            <div className="cl-card-body">
              {error && (
                <div className="alert alert-danger" style={{ fontSize: 14 }}>
                  {error}
                </div>
              )}
              {saved && (
                <div className="alert alert-success" style={{ fontSize: 14 }}>
                  Settings saved.
                </div>
              )}

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="bonus-percent">
                    Default credit bonus
                  </label>
                  <div className="input-group">
                    <input
                      id="bonus-percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="form-control"
                      value={form.defaultBonusPercent}
                      onChange={(e) =>
                        setForm({ ...form, defaultBonusPercent: Number(e.target.value) })
                      }
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="max-bonus">
                    Maximum bonus
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">{data.shop.currencyCode}</span>
                    <input
                      id="max-bonus"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={form.defaultMaxBonus}
                      onChange={(e) => setForm({ ...form, defaultMaxBonus: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-check form-switch mt-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="recommendations"
                  checked={form.recommendationsEnabled}
                  onChange={(e) =>
                    setForm({ ...form, recommendationsEnabled: e.target.checked })
                  }
                />
                <label className="form-check-label" htmlFor="recommendations">
                  Show return credit recommendations
                </label>
              </div>
            </div>
            <div className="cl-card-body border-top">
              <button type="submit" className="btn btn-cl-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        </div>

        <div className="col-12 col-lg-5">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Store</h2>
            </div>
            <div className="cl-card-body">
              <dl className="mb-0" style={{ fontSize: 14 }}>
                <Row label="Domain" value={data.shop.domain} />
                <Row label="Currency" value={data.shop.currencyCode} />
                <Row label="Plan" value={data.shop.plan} />
                <Row label="Shopify API version" value={data.apiVersion} />
                <Row
                  label="Last sync"
                  value={
                    data.shop.lastSyncAt
                      ? new Date(data.shop.lastSyncAt).toLocaleString()
                      : 'Not yet synced'
                  }
                />
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="cl-card mt-3">
        <div className="cl-card-header">
          <h2 className="cl-card-title">Sync with Shopify</h2>
          <button
            type="button"
            className="btn btn-cl-secondary btn-sm"
            onClick={runSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        <div className="cl-card-body">
          <p className="cl-source-note mb-0">
            Pulls customers, orders and store credit balances from Shopify. Webhooks keep things
            current afterwards, but a manual sync is useful after installing, after being granted
            protected customer data access, or if figures look stale.
          </p>

          {syncError && (
            <div className="alert alert-danger mt-3 mb-0" style={{ fontSize: 14 }}>
              {syncError}
            </div>
          )}

          {syncResult && (
            <div className="alert alert-success mt-3 mb-0" style={{ fontSize: 14 }}>
              <strong className="d-block mb-1">Sync complete</strong>
              {syncResult.sync.customers} customers · {syncResult.sync.orders} orders (
              {syncResult.sync.ordersUsingCredit} using credit) ·{' '}
              {syncResult.sync.creditBalances} credit balances · {syncResult.sync.webhooks} webhooks
            </div>
          )}

          {syncResult?.pendingApproval && (
            <div
              className="p-3 mt-3"
              style={{
                background: 'var(--cl-warning-soft)',
                border: '1px solid #f0d89a',
                borderRadius: 10,
                fontSize: 13,
                color: 'var(--cl-warning)',
              }}
            >
              <strong className="d-block mb-1">Some data cannot sync yet</strong>
              {syncResult.pendingApproval.message}
              <div className="mt-2">
                <code style={{ fontSize: 12 }}>
                  {syncResult.pendingApproval.topics.join(', ')}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="cl-card mt-3">
        <div className="cl-card-header">
          <h2 className="cl-card-title">App permissions</h2>
          <span className="cl-source-note">Why CreditLoop needs each scope</span>
        </div>
        <div className="cl-table-wrap">
          <table className="cl-table">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Why it is needed</th>
              </tr>
            </thead>
            <tbody>
              {data.scopes.map((scope) => (
                <tr key={scope}>
                  <td>
                    <code style={{ fontSize: 12.5 }}>{scope}</code>
                  </td>
                  <td style={{ fontSize: 13.5 }}>
                    {SCOPE_REASONS[scope] || 'Required by an implemented CreditLoop feature.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="d-flex justify-content-between py-2 border-bottom">
      <dt className="fw-normal text-secondary">{label}</dt>
      <dd className="mb-0 fw-semibold text-end">{value}</dd>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Page>
      <SettingsView />
    </Page>
  );
}
