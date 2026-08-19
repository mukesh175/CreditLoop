'use client';

import { useEffect, useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import { useApi } from '@/lib/client/useApi';
import { apiFetch } from '@/lib/client/api';
import { useShop } from '@/components/ui/ShopProvider';

const MERCHANT_ALERTS = [
  ['weeklyReport', 'Weekly credit report'],
  ['largeCreditIssued', 'Large credit issued'],
  ['redemptionSpike', 'Credit redemption spike'],
  ['expiringCreditSummary', 'Expiring credit summary'],
];

const TEST_TEMPLATES = [
  ['credit-reminder', 'Credit reminder'],
  ['credit-issued', 'Credit issued'],
  ['credit-expiring', 'Credit expiring'],
  ['win-back', 'Win-back'],
  ['weekly-report', 'Weekly report (merchant)'],
];

const CUSTOMER_CAMPAIGNS = [
  ['customerCreditIssued', 'Credit issued'],
  ['customerCreditReminder', 'Credit reminder'],
  ['customerExpirationReminder', 'Expiration reminder'],
  ['customerWinBack', 'Win-back credit'],
];

function NotificationSettings() {
  const { shop } = useShop();
  const { data, loading, reload } = useApi('/api/notifications/preferences');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [testTemplate, setTestTemplate] = useState('credit-reminder');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState(null);

  async function sendTest() {
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const result = await apiFetch('/api/notifications/test', {
        method: 'POST',
        body: { template: testTemplate, to: form.merchantEmail || undefined },
      });
      setTestResult(result);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTesting(false);
    }
  }

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

              <div className="mb-3">
                <label className="form-label fw-semibold" htmlFor="from-name">
                  Sender name
                </label>
                <input
                  id="from-name"
                  className="form-control"
                  value={form.emailFromName || ''}
                  onChange={(e) => setForm({ ...form, emailFromName: e.target.value })}
                  placeholder={shop?.name || 'Your store name'}
                  maxLength={64}
                />
                <div className="cl-source-note mt-1">
                  The name customers see in their inbox. Defaults to your store name
                  {shop?.name ? ` ("${shop.name}")` : ''}. Replies go to the address above.
                </div>
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

      <div className="cl-card mt-4">
        <div className="cl-card-header">
          <h2 className="cl-card-title">Send a test email</h2>
          <span className="cl-source-note">Always sent to you, never to a customer</span>
        </div>
        <div className="cl-card-body">
          <p className="cl-source-note">
            See exactly what a customer receives — sender name, reply-to address, wording and
            layout — before enabling a campaign that emails your customers. Sample amounts are
            used.
          </p>

          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div style={{ minWidth: 220 }}>
              <label className="form-label cl-source-note mb-1" htmlFor="test-template">
                Template
              </label>
              <select
                id="test-template"
                className="form-select form-select-sm"
                value={testTemplate}
                onChange={(e) => setTestTemplate(e.target.value)}
              >
                {TEST_TEMPLATES.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-cl-secondary btn-sm"
              onClick={sendTest}
              disabled={testing || !form.merchantEmail}
            >
              {testing ? 'Sending…' : 'Send test email'}
            </button>
          </div>

          {!form.merchantEmail && (
            <p className="cl-source-note mt-2 mb-0">
              Add an email address above and save before sending a test.
            </p>
          )}

          {testError && (
            <div className="alert alert-danger mt-3 mb-0" style={{ fontSize: 14 }}>
              {testError}
            </div>
          )}

          {testResult && (
            <div className="alert alert-success mt-3 mb-0" style={{ fontSize: 14 }}>
              <strong className="d-block mb-1">Test sent to {testResult.to}</strong>
              <div className="cl-source-note">
                From: {testResult.sender?.from || '—'}
                {testResult.sender?.replyTo ? ` · Reply-to: ${testResult.sender.replyTo}` : ''}
              </div>
            </div>
          )}
        </div>
      </div>
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
