import { formatPercent } from '@/lib/util/money';

/**
 * Radial score dial.
 *
 * Shows one headline ratio — how much issued credit has come back as orders —
 * with the arc coloured by band so the state reads before the number does.
 */
const BANDS = [
  { min: 60, label: 'Strong', color: 'var(--cl-green)', tone: 'green' },
  { min: 30, label: 'Building', color: '#e0a53a', tone: 'warning' },
  { min: 0, label: 'Needs attention', color: '#d1584f', tone: 'danger' },
];

export default function Gauge({ value = 0, label, caption, size = 168, loading = false }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const band = BANDS.find((b) => pct >= b.min) || BANDS[BANDS.length - 1];

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Three-quarter dial, rotated so the gap sits at the bottom.
  const arc = circumference * 0.75;
  const filled = arc * (pct / 100);

  if (loading) {
    return <div className="cl-skeleton mx-auto" style={{ width: size, height: size, borderRadius: '50%' }} />;
  }

  return (
    <div className="cl-gauge-wrap">
      <div className="cl-gauge" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${label}: ${formatPercent(pct)}`}
        >
          <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--cl-track)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={band.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            style={{ transition: 'stroke-dasharray .6s cubic-bezier(.4,0,.2,1)' }}
          />
        </g>
      </svg>

        {/* Only the figure sits inside the dial — anything more crowds the arc. */}
        <div className="cl-gauge-inner">
          <div className="cl-gauge-value">{Math.round(pct)}%</div>
          <div className="cl-gauge-label">{label}</div>
        </div>
      </div>

      <span className={`cl-pill cl-pill-${band.tone}`}>{band.label}</span>
      {caption && <div className="cl-gauge-caption">{caption}</div>}
    </div>
  );
}
