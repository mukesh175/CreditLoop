import { formatMoney, formatPercent } from '@/lib/util/money';
import Icon from './Icon';

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
  accent,
}) {
  if (loading) {
    return (
      <div className="cl-card h-100">
        <div className="cl-card-body">
          <div className="cl-skeleton mb-3" style={{ height: 10, width: '55%' }} />
          <div className="cl-skeleton mb-2" style={{ height: 26, width: '72%' }} />
          <div className="cl-skeleton" style={{ height: 10, width: '38%' }} />
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
    <div className="cl-card cl-card-hover h-100">
      <div className="cl-card-body">
        <div className="d-flex align-items-center gap-2 mb-2">
          {accent && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: accent,
                display: 'inline-block',
              }}
            />
          )}
          <span className="cl-kpi-label">{label}</span>
        </div>

        <div className="cl-kpi-value">{display}</div>

        <div className="d-flex align-items-center gap-2 mt-2" style={{ minHeight: 18 }}>
          {change != null ? (
            <span className={`cl-kpi-delta ${direction}`}>
              {direction !== 'flat' && (
                <Icon name={direction === 'up' ? 'arrowUp' : 'arrowDown'} size={13} strokeWidth={2.4} />
              )}
              {Math.abs(change)}%
            </span>
          ) : (
            <span className="cl-kpi-delta flat">no prior period</span>
          )}
          {hint && <span className="cl-source-note">{hint}</span>}
        </div>
      </div>
    </div>
  );
}
