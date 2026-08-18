'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';

const TYPES = [
  {
    id: 'RETURN_CREDIT',
    label: 'Return credit',
    description: 'Encourage customers to choose store credit when they return an item.',
    defaultSegment: 'CREDIT_HOLDERS',
    defaultTemplate: 'credit-reminder',
  },
  {
    id: 'WIN_BACK',
    label: 'Win-back credit',
    description: 'Reach customers who hold credit but have not ordered in a while.',
    defaultSegment: 'UNUSED_CREDIT',
    defaultTemplate: 'win-back',
  },
  {
    id: 'VIP',
    label: 'VIP credit',
    description: 'Reward your highest-value customers with store credit.',
    defaultSegment: 'HIGH_VALUE',
    defaultTemplate: 'credit-issued',
  },
];

export default function CampaignForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    type: 'RETURN_CREDIT',
    description: '',
    segment: 'CREDIT_HOLDERS',
    minDaysInactive: 30,
    minBalance: '',
    minLifetimeValue: '',
    sendsEmail: true,
    emailTemplate: 'credit-reminder',
    grantsCredit: false,
    grantType: 'FIXED',
    grantValue: '',
    grantMaxAmount: '',
    grantExpiresInDays: '',
    requiresMarketingConsent: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  function selectType(type) {
    const meta = TYPES.find((t) => t.id === type);
    setForm((f) => ({
      ...f,
      type,
      segment: meta.defaultSegment,
      emailTemplate: meta.defaultTemplate,
      grantsCredit: type === 'VIP' ? true : f.grantsCredit,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/campaigns', {
        method: 'POST',
        body: {
          ...form,
          minBalance: form.minBalance === '' ? null : Number(form.minBalance),
          minLifetimeValue: form.minLifetimeValue === '' ? null : Number(form.minLifetimeValue),
          grantValue: form.grantValue === '' ? null : Number(form.grantValue),
          grantMaxAmount: form.grantMaxAmount === '' ? null : Number(form.grantMaxAmount),
          grantExpiresInDays:
            form.grantExpiresInDays === '' ? null : Number(form.grantExpiresInDays),
        },
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <form className="modal-content" style={{ borderRadius: 16 }} onSubmit={submit}>
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title">New campaign</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              {error && (
                <div className="alert alert-danger" style={{ fontSize: 14 }}>
                  {error}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold" htmlFor="campaign-name">
                  Campaign name
                </label>
                <input
                  id="campaign-name"
                  className="form-control"
                  value={form.name}
                  onChange={set('name')}
                  required
                  placeholder="e.g. Unused credit reminder"
                />
              </div>

              <div className="mb-3">
                <span className="form-label fw-semibold d-block">Campaign type</span>
                <div className="row g-2">
                  {TYPES.map((type) => (
                    <div className="col-12 col-md-4" key={type.id}>
                      <button
                        type="button"
                        className="cl-card w-100 text-start p-3 border-0"
                        style={{
                          borderColor: form.type === type.id ? 'var(--cl-green)' : undefined,
                          outline:
                            form.type === type.id ? '2px solid var(--cl-green)' : '1px solid var(--cl-border)',
                          background: form.type === type.id ? 'var(--cl-green-soft)' : '#fff',
                        }}
                        onClick={() => selectType(type.id)}
                        aria-pressed={form.type === type.id}
                      >
                        <div className="fw-semibold" style={{ fontSize: 14 }}>
                          {type.label}
                        </div>
                        <div className="cl-source-note">{type.description}</div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="min-inactive">
                    Days without a purchase
                  </label>
                  <input
                    id="min-inactive"
                    type="number"
                    min="1"
                    className="form-control"
                    value={form.minDaysInactive}
                    onChange={set('minDaysInactive')}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label fw-semibold" htmlFor="min-balance">
                    Minimum credit balance
                  </label>
                  <input
                    id="min-balance"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    value={form.minBalance}
                    onChange={set('minBalance')}
                    placeholder="Any balance"
                  />
                </div>
              </div>

              <div className="form-check form-switch mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="sends-email"
                  checked={form.sendsEmail}
                  onChange={set('sendsEmail')}
                />
                <label className="form-check-label" htmlFor="sends-email">
                  Send a customer email
                </label>
              </div>

              <div className="form-check form-switch mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="grants-credit"
                  checked={form.grantsCredit}
                  onChange={set('grantsCredit')}
                />
                <label className="form-check-label" htmlFor="grants-credit">
                  Grant store credit to each recipient
                </label>
              </div>

              {form.grantsCredit && (
                <div className="row g-3 mb-3 p-3" style={{ background: '#f7f9f8', borderRadius: 10 }}>
                  <div className="col-12 col-md-4">
                    <label className="form-label fw-semibold" htmlFor="grant-type">
                      Grant type
                    </label>
                    <select
                      id="grant-type"
                      className="form-select"
                      value={form.grantType}
                      onChange={set('grantType')}
                    >
                      <option value="FIXED">Fixed amount</option>
                      <option value="PERCENTAGE">% of lifetime value</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label fw-semibold" htmlFor="grant-value">
                      Amount
                    </label>
                    <input
                      id="grant-value"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={form.grantValue}
                      onChange={set('grantValue')}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label fw-semibold" htmlFor="grant-max">
                      Maximum per customer
                    </label>
                    <input
                      id="grant-max"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control"
                      value={form.grantMaxAmount}
                      onChange={set('grantMaxAmount')}
                    />
                  </div>
                  <div className="col-12">
                    <p className="cl-source-note mb-0">
                      This campaign issues real store credit in Shopify to every eligible recipient.
                      It starts as a draft — nothing is issued until you activate it.
                    </p>
                  </div>
                </div>
              )}

              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="requires-consent"
                  checked={form.requiresMarketingConsent}
                  onChange={set('requiresMarketingConsent')}
                />
                <label className="form-check-label" htmlFor="requires-consent">
                  Only email customers with marketing consent (recommended)
                </label>
              </div>
            </div>

            <div className="modal-footer border-0">
              <button type="button" className="btn btn-cl-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-cl-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save as draft'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
