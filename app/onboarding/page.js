'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShopProvider, useShop } from '@/components/ui/ShopProvider';
import { apiFetch } from '@/lib/client/api';
import { BRAND } from '@/lib/config';

const STEPS = ['Welcome', 'How it works', 'Credit defaults', 'Notifications', 'Sync', 'Done'];

function Onboarding() {
  const router = useRouter();
  const { shop } = useShop();
  const [step, setStep] = useState(0);
  const [defaults, setDefaults] = useState({
    defaultBonusPercent: 10,
    defaultMaxBonus: 25,
    recommendationsEnabled: true,
  });
  const [notifications, setNotifications] = useState({
    weeklyReport: true,
    largeCreditIssued: true,
    customerCreditReminder: false,
  });
  const [sync, setSync] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function next() {
    setBusy(true);
    setError(null);
    try {
      if (step === 2) {
        await apiFetch('/api/onboarding', { method: 'POST', body: { ...defaults, step: 3 } });
      }
      if (step === 3) {
        await apiFetch('/api/notifications/preferences', { method: 'PATCH', body: notifications });
      }
      if (step === 4) {
        const result = await apiFetch('/api/onboarding', {
          method: 'POST',
          body: { action: 'sync' },
        });
        setSync(result.sync);
        setPendingApproval(result.pendingApproval || null);
      }
      if (step === 5) {
        await apiFetch('/api/onboarding', { method: 'POST', body: { done: true } });
        router.push('/');
        return;
      }
      setStep((s) => s + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center py-5 px-3" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 560, width: '100%' }}>
        <div className="d-flex align-items-center gap-2 mb-4">
          <div className="cl-brand-mark">C</div>
          <div className="cl-brand-name">{BRAND.name}</div>
        </div>

        <div className="progress mb-4" style={{ height: 5 }}>
          <div
            className="progress-bar"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--cl-green)' }}
          />
        </div>

        <div className="cl-card">
          <div className="cl-card-body p-4">
            {error && <div className="alert alert-danger">{error}</div>}

            {step === 0 && (
              <>
                <h1 className="h4 mb-2">Welcome to CreditLoop 👋</h1>
                <p style={{ fontSize: 15 }}>{BRAND.tagline}</p>
                <p className="text-secondary" style={{ fontSize: 14 }}>
                  Connected to <strong>{shop?.domain}</strong>
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <h1 className="h5 mb-3">How CreditLoop works</h1>
                <p style={{ fontSize: 15 }}>
                  CreditLoop uses <strong>Shopify Store Credit</strong> to help you create retention
                  offers. Shopify holds the balance — CreditLoop decides when an offer makes sense
                  and measures what happens next.
                </p>
                <div
                  className="p-3 mt-3"
                  style={{ background: 'var(--cl-green-soft)', borderRadius: 10, fontSize: 14 }}
                >
                  Return → Credit offer → Store credit → Reminder → Repeat purchase
                </div>
                <p className="cl-source-note mt-3 mb-0">
                  CreditLoop never holds your customers' money. Balances live in Shopify and stay
                  there even if you uninstall.
                </p>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="h5 mb-3">Credit defaults</h1>
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="ob-bonus">
                    Default credit bonus
                  </label>
                  <div className="input-group" style={{ maxWidth: 180 }}>
                    <input
                      id="ob-bonus"
                      type="number"
                      min="0"
                      max="100"
                      className="form-control"
                      value={defaults.defaultBonusPercent}
                      onChange={(e) =>
                        setDefaults({ ...defaults, defaultBonusPercent: Number(e.target.value) })
                      }
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="ob-max">
                    Maximum bonus
                  </label>
                  <div className="input-group" style={{ maxWidth: 180 }}>
                    <span className="input-group-text">{shop?.currencyCode || 'USD'}</span>
                    <input
                      id="ob-max"
                      type="number"
                      min="0"
                      className="form-control"
                      value={defaults.defaultMaxBonus}
                      onChange={(e) =>
                        setDefaults({ ...defaults, defaultMaxBonus: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="ob-recs"
                    checked={defaults.recommendationsEnabled}
                    onChange={(e) =>
                      setDefaults({ ...defaults, recommendationsEnabled: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor="ob-recs">
                    Enable return credit recommendations
                  </label>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="h5 mb-3">Notification preferences</h1>
                {[
                  ['weeklyReport', 'Weekly credit report'],
                  ['largeCreditIssued', 'Alert me on large credit issued'],
                  ['customerCreditReminder', 'Remind customers about unused credit'],
                ].map(([key, label]) => (
                  <div className="form-check form-switch mb-2" key={key}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`ob-${key}`}
                      checked={notifications[key]}
                      onChange={(e) =>
                        setNotifications({ ...notifications, [key]: e.target.checked })
                      }
                    />
                    <label className="form-check-label" htmlFor={`ob-${key}`}>
                      {label}
                    </label>
                  </div>
                ))}
                <p className="cl-source-note mt-3 mb-0">
                  Customer emails only go to customers with marketing consent in Shopify.
                </p>
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="h5 mb-3">Initial sync</h1>
                <p style={{ fontSize: 14 }}>
                  CreditLoop will pull your customers, orders and store credit balances from Shopify.
                </p>
                <ul className="list-unstyled" style={{ fontSize: 14 }}>
                  {['Customers', 'Orders', 'Returns', 'Store credit', 'Analytics'].map((label) => (
                    <li key={label} className="mb-1">
                      <span style={{ color: 'var(--cl-green)' }}>✓</span> {label}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {step === 5 && (
              <>
                <h1 className="h5 mb-3">You are set up</h1>
                {sync && (
                  <ul className="list-unstyled" style={{ fontSize: 14 }}>
                    <li>✓ {sync.customers} customers synced</li>
                    <li>✓ {sync.webhooks} webhooks registered</li>
                    <li>✓ {sync.creditBalances} store credit balances read from Shopify</li>
                  </ul>
                )}
                {pendingApproval && (
                  <div
                    className="p-3 mb-3"
                    style={{
                      background: 'var(--cl-warning-soft)',
                      border: '1px solid #f0d89a',
                      borderRadius: 10,
                      fontSize: 13,
                      color: 'var(--cl-warning)',
                    }}
                  >
                    <strong className="d-block mb-1">Some webhooks are waiting on approval</strong>
                    {pendingApproval.message}
                    <div className="mt-2">
                      <code style={{ fontSize: 12 }}>{pendingApproval.topics.join(', ')}</code>
                    </div>
                  </div>
                )}

                <p className="cl-source-note mb-0">
                  Your credit rules were created as drafts. Review them in Settings → Credit Rules
                  before enabling — nothing is offered to customers until you do.
                </p>
              </>
            )}
          </div>

          <div className="cl-card-body border-top d-flex justify-content-between align-items-center">
            <span className="cl-source-note">
              Step {step + 1} of {STEPS.length}
            </span>
            <button type="button" className="btn btn-cl-primary" onClick={next} disabled={busy}>
              {busy
                ? 'Working…'
                : step === 4
                  ? 'Run initial sync'
                  : step === 5
                    ? 'Go to dashboard'
                    : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <ShopProvider>
      <Onboarding />
    </ShopProvider>
  );
}
