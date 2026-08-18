'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { formatMoney } from '@/lib/util/money';

const FIELDS = [
  { id: 'refundAmount', label: 'Refund amount', type: 'money' },
  { id: 'customerOrderCount', label: 'Customer orders', type: 'number' },
  { id: 'customerLifetimeValue', label: 'Customer lifetime value', type: 'money' },
  { id: 'averageOrderValue', label: 'Average order value', type: 'money' },
  { id: 'daysSinceLastOrder', label: 'Days since last order', type: 'number' },
  { id: 'previousCreditUses', label: 'Previous store-credit uses', type: 'number' },
  { id: 'previousReturns', label: 'Previous returns', type: 'number' },
];

const OPERATORS = [
  { id: 'gte', label: 'is at least' },
  { id: 'gt', label: 'is greater than' },
  { id: 'lte', label: 'is at most' },
  { id: 'lt', label: 'is less than' },
  { id: 'eq', label: 'equals' },
  { id: 'neq', label: 'does not equal' },
];

/**
 * Visual rule builder with a built-in test harness.
 *
 * Testing before saving is not a nicety here — a rule is a standing commitment
 * to give away money, so the merchant sees the exact payout for a worked example
 * before the rule can be enabled.
 */
export default function RuleBuilder({ rule, currencyCode, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: rule?.name || '',
    description: rule?.description || '',
    enabled: rule?.enabled ?? false,
    priority: rule?.priority ?? 0,
    bonusType: rule?.bonusType || 'PERCENTAGE',
    bonusValue: rule?.bonusValue ?? 10,
    maxBonusAmount: rule?.maxBonusAmount ?? 25,
    minRefundAmount: rule?.minRefundAmount ?? '',
    customerEligibility: rule?.customerEligibility || 'ALL',
    conditions:
      rule?.conditions?.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value,
      })) || [{ field: 'refundAmount', operator: 'gte', value: 50 }],
  }));

  const [testInput, setTestInput] = useState({
    refundAmount: 100,
    customerOrderCount: 6,
    customerLifetimeValue: 850,
    previousCreditUses: 1,
    daysSinceLastOrder: 18,
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function payload() {
    return {
      ...form,
      bonusValue: Number(form.bonusValue),
      priority: Number(form.priority),
      maxBonusAmount: form.maxBonusAmount === '' ? null : Number(form.maxBonusAmount),
      minRefundAmount: form.minRefundAmount === '' ? null : Number(form.minRefundAmount),
      conditions: form.conditions.map((c) => ({ ...c, value: Number(c.value) })),
    };
  }

  async function runTest() {
    setTesting(true);
    setError(null);
    try {
      const data = await apiFetch('/api/rules/test', {
        method: 'POST',
        body: { ...testInput, currencyCode, draftRule: payload() },
      });
      setTestResult(data.result);
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(rule ? `/api/rules/${rule.id}` : '/api/rules', {
        method: rule ? 'PATCH' : 'POST',
        body: payload(),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const setCondition = (index, patch) =>
    setForm((f) => ({
      ...f,
      conditions: f.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <form className="modal-content" style={{ borderRadius: 16 }} onSubmit={save}>
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title">{rule ? 'Edit rule' : 'New credit rule'}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              {error && (
                <div className="alert alert-danger" style={{ fontSize: 14 }}>
                  {error}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold" htmlFor="rule-name">
                  Rule name
                </label>
                <input
                  id="rule-name"
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Standard Return Credit"
                  required
                />
              </div>

              {/* WHEN ------------------------------------------------------ */}
              <div className="p-3 mb-3" style={{ background: '#f7f9f8', borderRadius: 12 }}>
                <div className="cl-kpi-label mb-2">When</div>

                {form.conditions.map((condition, index) => (
                  <div className="row g-2 align-items-center mb-2" key={index}>
                    <div className="col-12 col-md-4">
                      <select
                        className="form-select form-select-sm"
                        value={condition.field}
                        onChange={(e) => setCondition(index, { field: e.target.value })}
                        aria-label="Condition field"
                      >
                        {FIELDS.map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-7 col-md-4">
                      <select
                        className="form-select form-select-sm"
                        value={condition.operator}
                        onChange={(e) => setCondition(index, { operator: e.target.value })}
                        aria-label="Condition operator"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-4 col-md-3">
                      <input
                        type="number"
                        step="0.01"
                        className="form-control form-control-sm"
                        value={condition.value}
                        onChange={(e) => setCondition(index, { value: e.target.value })}
                        aria-label="Condition value"
                      />
                    </div>
                    <div className="col-1">
                      {form.conditions.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-secondary p-0"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              conditions: f.conditions.filter((_, i) => i !== index),
                            }))
                          }
                          aria-label="Remove condition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {index < form.conditions.length - 1 && (
                      <div className="col-12">
                        <span className="cl-source-note fw-semibold">AND</span>
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-cl-secondary btn-sm mt-1"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      conditions: [
                        ...f.conditions,
                        { field: 'customerOrderCount', operator: 'gte', value: 3 },
                      ],
                    }))
                  }
                >
                  + Add condition
                </button>
              </div>

              {/* THEN ------------------------------------------------------ */}
              <div className="p-3 mb-3" style={{ background: 'var(--cl-green-soft)', borderRadius: 12 }}>
                <div className="cl-kpi-label mb-2">Then</div>
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <label className="form-label cl-source-note mb-1" htmlFor="bonus-type">
                      Store credit bonus
                    </label>
                    <select
                      id="bonus-type"
                      className="form-select form-select-sm"
                      value={form.bonusType}
                      onChange={(e) => setForm({ ...form, bonusType: e.target.value })}
                    >
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED">Fixed amount</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-4">
                    <label className="form-label cl-source-note mb-1" htmlFor="bonus-value">
                      {form.bonusType === 'PERCENTAGE' ? 'Percent' : `Amount (${currencyCode})`}
                    </label>
                    <input
                      id="bonus-value"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control form-control-sm"
                      value={form.bonusValue}
                      onChange={(e) => setForm({ ...form, bonusValue: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-6 col-md-4">
                    <label className="form-label cl-source-note mb-1" htmlFor="max-bonus">
                      Maximum bonus ({currencyCode})
                    </label>
                    <input
                      id="max-bonus"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control form-control-sm"
                      value={form.maxBonusAmount}
                      onChange={(e) => setForm({ ...form, maxBonusAmount: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-12 col-md-4">
                  <label className="form-label cl-source-note mb-1" htmlFor="min-refund">
                    Minimum refund amount
                  </label>
                  <input
                    id="min-refund"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control form-control-sm"
                    value={form.minRefundAmount}
                    onChange={(e) => setForm({ ...form, minRefundAmount: e.target.value })}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label cl-source-note mb-1" htmlFor="eligibility">
                    Customer eligibility
                  </label>
                  <select
                    id="eligibility"
                    className="form-select form-select-sm"
                    value={form.customerEligibility}
                    onChange={(e) => setForm({ ...form, customerEligibility: e.target.value })}
                  >
                    <option value="ALL">All customers</option>
                    <option value="NEW">New customers</option>
                    <option value="RETURNING">Returning customers</option>
                    <option value="VIP">VIP customers</option>
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label cl-source-note mb-1" htmlFor="priority">
                    Priority (highest wins)
                  </label>
                  <input
                    id="priority"
                    type="number"
                    className="form-control form-control-sm"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  />
                </div>
              </div>

              {/* TEST ------------------------------------------------------ */}
              <div className="cl-card">
                <div className="cl-card-header">
                  <h6 className="cl-card-title mb-0">Test rule</h6>
                  <button
                    type="button"
                    className="btn btn-cl-secondary btn-sm"
                    onClick={runTest}
                    disabled={testing}
                  >
                    {testing ? 'Testing…' : 'Run test'}
                  </button>
                </div>
                <div className="cl-card-body">
                  <div className="row g-2 mb-3">
                    {[
                      ['refundAmount', 'Refund amount'],
                      ['customerOrderCount', 'Customer orders'],
                      ['customerLifetimeValue', 'Lifetime value'],
                    ].map(([key, label]) => (
                      <div className="col-12 col-md-4" key={key}>
                        <label className="form-label cl-source-note mb-1" htmlFor={`test-${key}`}>
                          {label}
                        </label>
                        <input
                          id={`test-${key}`}
                          type="number"
                          className="form-control form-control-sm"
                          value={testInput[key]}
                          onChange={(e) =>
                            setTestInput({ ...testInput, [key]: Number(e.target.value) })
                          }
                        />
                      </div>
                    ))}
                  </div>

                  {testResult && (
                    <div
                      className="p-3"
                      style={{
                        background: testResult.eligible ? 'var(--cl-green-soft)' : '#f4f6f5',
                        borderRadius: 10,
                        fontSize: 14,
                      }}
                    >
                      <div className="fw-semibold mb-2">
                        {testResult.eligible ? '✓ Eligible' : '✕ Not eligible'}
                      </div>
                      {testResult.eligible ? (
                        <>
                          <div>
                            Recommended credit:{' '}
                            <strong className="cl-num">
                              {formatMoney(testResult.totalCredit, currencyCode)}
                            </strong>
                          </div>
                          <div>
                            Bonus:{' '}
                            <strong className="cl-num">
                              {formatMoney(testResult.bonusAmount, currencyCode)}
                            </strong>
                            {testResult.capped && (
                              <span className="cl-source-note"> (capped at your maximum)</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <ul className="mb-0 ps-3 cl-source-note">
                          {testResult.evaluations?.[0]?.reasons?.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-check form-switch mt-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="rule-enabled"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="rule-enabled">
                  Enable this rule
                </label>
              </div>
            </div>

            <div className="modal-footer border-0">
              <button type="button" className="btn btn-cl-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-cl-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save rule'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
