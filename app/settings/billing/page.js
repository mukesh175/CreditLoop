'use client';

import { useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import { useApi } from '@/lib/client/useApi';
import { apiFetch } from '@/lib/client/api';

function BillingView() {
  const { data, loading, error, reload } = useApi('/api/billing/status');
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function subscribe(planId) {
    setBusy(planId);
    setActionError(null);
    try {
      const result = await apiFetch('/api/billing/subscribe', {
        method: 'POST',
        body: { plan: planId },
      });
      // Shopify hosts the approval screen; App Bridge redirects the top frame.
      if (result.confirmationUrl) {
        if (window.top) window.top.location.href = result.confirmationUrl;
        else window.location.href = result.confirmationUrl;
      }
    } catch (err) {
      setActionError(err.message);
      setBusy(null);
    }
  }

  if (loading) return <LoadingCard rows={5} />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;

  const usage = data.entitlements;

  return (
    <>
      <PageHeader
        icon="billing"
        title="Billing"
        subtitle="Billed through Shopify. CreditLoop never handles your payment details."
      />

      {actionError && <div className="alert alert-danger">{actionError}</div>}

      <div className="cl-card mb-4">
        <div className="cl-card-body">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-md-4">
              <div className="cl-kpi-label">Current plan</div>
              <div className="cl-kpi-value">{usage.planName}</div>
            </div>
            <div className="col-12 col-md-8">
              <div className="cl-kpi-label mb-1">Credit offers this period</div>
              <div className="d-flex align-items-center gap-3">
                <div className="progress flex-grow-1" style={{ height: 8 }}>
                  <div
                    className="progress-bar"
                    style={{
                      width: usage.creditOffersLimit
                        ? `${Math.min(100, (usage.creditOffersUsed / usage.creditOffersLimit) * 100)}%`
                        : '8%',
                      background: 'var(--cl-green)',
                    }}
                  />
                </div>
                <span className="cl-num fw-semibold" style={{ whiteSpace: 'nowrap' }}>
                  {usage.creditOffersUsed} / {usage.creditOffersLimit ?? '∞'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {data.plans.map((plan) => {
          const current = plan.id === data.currentPlan;
          return (
            <div className="col-12 col-md-6 col-xl-3" key={plan.id}>
              <div
                className="cl-card h-100"
                style={current ? { outline: '2px solid var(--cl-green)' } : undefined}
              >
                <div className="cl-card-body d-flex flex-column h-100">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h3 className="cl-card-title mb-0">{plan.name}</h3>
                    {current && <span className="cl-pill cl-pill-green">Current</span>}
                  </div>
                  <div className="cl-kpi-value mb-1">
                    ${plan.price}
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--cl-muted)' }}>
                      /month
                    </span>
                  </div>
                  {plan.trialDays > 0 && (
                    <div className="cl-source-note mb-2">{plan.trialDays}-day free trial</div>
                  )}

                  <ul className="list-unstyled mt-2 mb-3" style={{ fontSize: 13.5 }}>
                    {plan.features.map((feature) => (
                      <li key={feature} className="mb-1">
                        <span style={{ color: 'var(--cl-green)' }}>✓</span> {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    {current ? (
                      <button type="button" className="btn btn-cl-secondary w-100" disabled>
                        Your plan
                      </button>
                    ) : plan.id === 'FREE' ? (
                      <span className="cl-source-note">Downgrade by cancelling your plan.</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-cl-primary w-100"
                        disabled={busy === plan.id}
                        onClick={() => subscribe(plan.id)}
                      >
                        {busy === plan.id ? 'Redirecting…' : `Choose ${plan.name}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="cl-source-note mt-3">
        Plan limits are enforced on the server. If you reach your monthly credit-offer limit,
        CreditLoop stops issuing new credit rather than silently exceeding your plan — your existing
        customer balances in Shopify are never affected.
      </p>
    </>
  );
}

export default function BillingPage() {
  return (
    <Page>
      <BillingView />
    </Page>
  );
}
