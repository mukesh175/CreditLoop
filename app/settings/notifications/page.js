'use client';

import { useEffect, useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import { useApi } from '@/lib/client/useApi';
import { apiFetch } from '@/lib/client/api';

const MERCHANT_ALERTS = [
  ['weeklyReport', 'Weekly credit report'],
  ['largeCreditIssued', 'Large credit issued'],
  ['redemptionSpike', 'Credit redemption spike'],
  ['expiringCreditSummary', 'Expiring credit summary'],
];

const CUSTOMER_CAMPAIGNS = [
  ['customerCreditIssued', 'Credit issued'],
  ['customerCreditReminder', 'Credit reminder'],
  ['customerExpirationReminder', 'Expiration reminder'],
  ['customerWinBack', 'Win-back credit'],
];

function NotificationSettings() {
  const { data, loading, reload } = useApi('/api/notifications/preferences');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (data?.preferences && !form) setForm(data.preferences);
  }, [data, form]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await apiFetch('/api/notifications/preferences', { method: 'PATCH', body: form });
      setSaved(true);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) return <LoadingCard rows={6} />;

  const customerEmailsAvailable = data?.entitlements?.customerEmails;

  return (
    <>
      <PageHeader title="Notifications" subtitle="What CreditLoop sends, and to whom." />

      {error && <div className="alert alert-danger">{error}</div>}
      {saved && <div className="alert alert-success">Notification settings saved.</div>}

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Merchant alerts</h2>
            </div>
            <div className="cl-card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold" htmlFor="merchant-email">
                  Send alerts to
                </label>
                <input
                  id="merchant-email"
                  type="email"
                  className="form-control"
                  value={form.merchantEmail || ''}
                  onChange={(e) => setForm({ ...form, merchantEmail: e.target.value })}
                  placeholder="you@yourstore.com"
                />
              </div>

              {MERCHANT_ALERTS.map(([key, label]) => (
                <div className="form-check form-switch mb-2" key={key}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={key}
                    checked={Boolean(form[key])}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor={key}>
                    {label}
                  </label>
                </div>
              ))}

              <div className="mt-3">
                <label className="form-label cl-source-note" htmlFor="large-threshold">
                  Alert me when a single credit exceeds
                </label>
                <input
                  id="large-threshold"
                  type="number"
                  min="0"
                  className="form-control form-control-sm"
                  style={{ maxWidth: 160 }}
                  value={form.largeCreditThreshold}
                  onChange={(e) =>
                    setForm({ ...form, largeCreditThreshold: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="cl-card h-100">
            <div className="cl-card-header">
              <h2 className="cl-card-title">Customer campaigns</h2>
            </div>
            <div className="cl-card-body">
              {!customerEmailsAvailable && (
                <div className="alert alert-light border" style={{ fontSize: 13.5 }}>
                  Customer emails are available on the Growth plan and above.
                </div>
              )}

              {CUSTOMER_CAMPAIGNS.map(([key, label]) => (
                <div className="form-check form-switch mb-2" key={key}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={key}
                    checked={Boolean(form[key])}
                    disabled={!customerEmailsAvailable}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor={key}>
                    {label}
                  </label>
                </div>
              ))}

              <div className="mt-3">
                <label className="form-label cl-source-note" htmlFor="reminder-days">
                  Remind customers after this many days without redeeming
                </label>
                <input
                  id="reminder-days"
                  type="number"
                  min="1"
                  className="form-control form-control-sm"
                  style={{ maxWidth: 160 }}
                  value={form.reminderAfterDays}
                  onChange={(e) => setForm({ ...form, reminderAfterDays: Number(e.target.value) })}
                />
              </div>

              <p className="cl-source-note mt-3 mb-0">
                Customer emails are only sent to customers with marketing consent in Shopify.
                Holding store credit is not consent to be marketed to.
              </p>
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="btn btn-cl-primary mt-3" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save notification settings'}
      </button>
    </>
  );
}

export default function NotificationSettingsPage() {
  return (
    <Page>
      <NotificationSettings />
    </Page>
  );
}
