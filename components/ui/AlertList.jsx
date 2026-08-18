import Link from 'next/link';
import { formatMoney } from '@/lib/util/money';

const TONE_CLASS = {
  info: 'cl-pill-muted',
  success: 'cl-pill-green',
  warning: 'cl-pill-warning',
  danger: 'cl-pill-danger',
};

export default function AlertList({ alerts = [] }) {
  if (!alerts.length) return null;
  return (
    <div className="d-flex flex-column gap-2">
      {alerts.map((alert) => (
        <Link
          key={alert.id}
          href={alert.href || '#'}
          className="cl-card text-decoration-none"
          style={{ color: 'inherit' }}
        >
          <div className="cl-card-body py-3 d-flex align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <span className={`cl-pill ${TONE_CLASS[alert.tone] || 'cl-pill-muted'}`}>
                {alert.title}
              </span>
              <span style={{ fontSize: 14 }}>
                {alert.amount != null && (
                  <strong className="cl-num">
                    {formatMoney(alert.amount, alert.currencyCode)}{' '}
                  </strong>
                )}
                {alert.message}
              </span>
            </div>
            <span className="cl-source-note">View →</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
