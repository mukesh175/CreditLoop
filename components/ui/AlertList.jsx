import Link from 'next/link';
import { formatMoney } from '@/lib/util/money';
import Icon from './Icon';

const TONE = {
  danger: { bar: 'cl-alert-bar-danger', pill: 'cl-pill-danger', label: 'Critical' },
  warning: { bar: 'cl-alert-bar-warning', pill: 'cl-pill-warning', label: 'Warning' },
  success: { bar: 'cl-alert-bar-success', pill: 'cl-pill-green', label: 'Positive' },
  info: { bar: 'cl-alert-bar-info', pill: 'cl-pill-info', label: 'Info' },
};

export default function AlertList({ alerts = [] }) {
  if (!alerts.length) return null;

  return (
    <div>
      {alerts.map((alert) => {
        const tone = TONE[alert.tone] || TONE.info;
        return (
          <Link key={alert.id} href={alert.href || '#'} className="cl-alert-row">
            <span className={`cl-alert-bar ${tone.bar}`} />
            <div className="flex-grow-1 min-width-0">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className={`cl-pill ${tone.pill}`}>{tone.label}</span>
                <span className="cl-alert-title">{alert.title}</span>
              </div>
              <div className="cl-alert-body">
                {alert.amount != null && (
                  <strong className="cl-num">{formatMoney(alert.amount, alert.currencyCode)} </strong>
                )}
                {alert.message}
              </div>
            </div>
            <Icon name="chevron" size={16} style={{ color: 'var(--cl-faint)', marginTop: 4 }} />
          </Link>
        );
      })}
    </div>
  );
}
