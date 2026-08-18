import { formatMoney, formatPercent } from '@/lib/util/money';

/**
 * A single KPI. `change` is null when there is no comparable prior period —
 * showing "+100%" against a zero baseline would be misleading.
 */
export default function KpiCard({
  label,
  value,
  currencyCode,
  change,
  format = 'money',
  hint,
  loading,
}) {
  if (loading) {
    return (
      <div className="cl-card h-100">
        <div className="cl-card-body">
          <div className="cl-skeleton mb-2" style={{ height: 12, width: '55%' }} />
          <div className="cl-skeleton" style={{ height: 28, width: '75%' }} />
        </div>
      </div>
    );
  }

  const display =
    format === 'money'
      ? formatMoney(value, currencyCode)
      : format === 'percent'
        ? formatPercent(value)
        : new Intl.NumberFormat('en-US').format(value || 0);

  const direction = change == null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  return (
    <div className="cl-card h-100">
      <div className="cl-card-body">
        <div className="cl-kpi-label mb-2">{label}</div>
        <div className="cl-kpi-value cl-num">{display}</div>
        <div className="d-flex align-items-center gap-2 mt-1">
          {change != null && (
            <span className={`cl-kpi-delta ${direction}`}>
              {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change)}%
            </span>
          )}
          {hint && <span className="cl-source-note">{hint}</span>}
        </div>
      </div>
    </div>
  );
}
