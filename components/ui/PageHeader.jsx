import Icon from './Icon';

export default function PageHeader({ title, subtitle, actions, icon, eyebrow }) {
  return (
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div className="d-flex align-items-start gap-3">
        {icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: 'var(--cl-green-soft)',
              color: 'var(--cl-green)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name={icon} size={20} />
          </div>
        )}
        <div>
          {eyebrow && <div className="cl-kpi-label mb-1">{eyebrow}</div>}
          <h1 className="mb-1" style={{ fontSize: 22 }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mb-0" style={{ fontSize: 13.5, color: 'var(--cl-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
