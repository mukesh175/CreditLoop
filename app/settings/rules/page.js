'use client';

import { useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import RuleBuilder from '@/components/credit/RuleBuilder';
import { useApi } from '@/lib/client/useApi';
import { apiFetch } from '@/lib/client/api';
import { formatMoney } from '@/lib/util/money';
import { useShop } from '@/components/ui/ShopProvider';

function RulesView() {
  const { shop } = useShop();
  const { data, loading, error, reload } = useApi('/api/rules');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);

  async function toggle(rule) {
    setBusy(rule.id);
    try {
      await apiFetch(`/api/rules/${rule.id}`, {
        method: 'PATCH',
        body: { enabled: !rule.enabled },
      });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Credit rules"
        subtitle="Rules decide how much bonus credit a return is worth. They never stack — the highest-priority match wins."
        actions={
          <button type="button" className="btn btn-cl-primary btn-sm" onClick={() => setEditing({})}>
            New rule
          </button>
        }
      />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading ? (
        <LoadingCard rows={4} />
      ) : data?.rules?.length ? (
        <div className="d-flex flex-column gap-3">
          {data.rules.map((rule) => (
            <div className="cl-card" key={rule.id}>
              <div className="cl-card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <h3 className="cl-card-title mb-0">{rule.name}</h3>
                      <span className={`cl-pill ${rule.enabled ? 'cl-pill-green' : 'cl-pill-muted'}`}>
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="cl-source-note mb-2">{rule.description}</p>
                    )}
                    <div style={{ fontSize: 14 }}>
                      <span className="text-secondary">Bonus: </span>
                      <strong>
                        {rule.bonusType === 'PERCENTAGE'
                          ? `${rule.bonusValue}%`
                          : formatMoney(rule.bonusValue, shop?.currencyCode)}
                      </strong>
                      {rule.maxBonusAmount != null && (
                        <span className="text-secondary">
                          {' '}
                          · max {formatMoney(rule.maxBonusAmount, shop?.currencyCode)}
                        </span>
                      )}
                      {rule.minRefundAmount != null && (
                        <span className="text-secondary">
                          {' '}
                          · min refund {formatMoney(rule.minRefundAmount, shop?.currencyCode)}
                        </span>
                      )}
                    </div>
                    {rule.conditions?.length > 0 && (
                      <div className="cl-source-note mt-1">
                        {rule.conditions.length} condition{rule.conditions.length === 1 ? '' : 's'} ·
                        priority {rule.priority}
                      </div>
                    )}
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-cl-secondary btn-sm"
                      onClick={() => setEditing(rule)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-cl-secondary btn-sm"
                      disabled={busy === rule.id}
                      onClick={() => toggle(rule)}
                    >
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cl-card">
          <EmptyState
            title="No credit rules yet"
            message="Create a rule to decide when a return should be worth more as store credit than as a refund."
            action={
              <button type="button" className="btn btn-cl-primary" onClick={() => setEditing({})}>
                New rule
              </button>
            }
          />
        </div>
      )}

      {editing && (
        <RuleBuilder
          rule={editing.id ? editing : null}
          currencyCode={shop?.currencyCode || 'USD'}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

export default function RulesPage() {
  return (
    <Page>
      <RulesView />
    </Page>
  );
}
