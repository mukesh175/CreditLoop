'use client';

import { useState } from 'react';
import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';
import LoadingCard from '@/components/ui/LoadingCard';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { useApi } from '@/lib/client/useApi';
import { formatMoney } from '@/lib/util/money';

const ACTION_LABEL = {
  RULE_CREATED: 'Rule created',
  RULE_UPDATED: 'Rule changed',
  RULE_DISABLED: 'Rule disabled',
  RULE_DELETED: 'Rule deleted',
  CREDIT_ISSUED: 'Store credit issued',
  CREDIT_DEBITED: 'Store credit debited',
  REFUND_CREATED: 'Refund created',
  CAMPAIGN_ACTIVATED: 'Campaign activated',
  CAMPAIGN_PAUSED: 'Campaign paused',
  CAMPAIGN_RUN: 'Campaign run',
  NOTIFICATION_SENT: 'Notification sent',
  SETTINGS_UPDATED: 'Settings updated',
  ADMIN_ACTION: 'Admin action',
  API_ERROR: 'API error',
  RECONCILIATION_MISMATCH: 'Reconciliation difference',
  APP_UNINSTALLED: 'App uninstalled',
  DATA_REDACTED: 'Data redacted',
};

function AuditView() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(`/api/audit?page=${page}`);

  return (
    <>
      <PageHeader
        icon="audit"
        title="Audit log"
        subtitle="Every rule change, credit issuance and refund, with its Shopify transaction."
      />

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading ? (
        <LoadingCard rows={8} />
      ) : data?.logs?.length ? (
        <div className="cl-card">
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th className="text-end">Amount</th>
                  <th>Reason</th>
                  <th>Shopify transaction</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="cl-source-note" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="fw-semibold">{ACTION_LABEL[log.action] || log.action}</td>
                    <td className="text-end cl-num">
                      {log.amount != null ? formatMoney(log.amount, log.currencyCode) : '—'}
                    </td>
                    <td style={{ fontSize: 13.5 }}>{log.reason || '—'}</td>
                    <td>
                      <code className="cl-source-note">
                        {log.shopifyTransactionId
                          ? `…${log.shopifyTransactionId.slice(-14)}`
                          : '—'}
                      </code>
                    </td>
                    <td>
                      <span
                        className={`cl-pill ${
                          log.result === 'SUCCESS' ? 'cl-pill-green' : 'cl-pill-danger'
                        }`}
                      >
                        {log.result.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onChange={setPage} />
        </div>
      ) : (
        <div className="cl-card">
          <EmptyState
            title="No activity yet"
            message="Rule changes, credit issuance and refunds will appear here as they happen."
          />
        </div>
      )}
    </>
  );
}

export default function AuditPage() {
  return (
    <Page>
      <AuditView />
    </Page>
  );
}
