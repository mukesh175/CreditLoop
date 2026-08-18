'use client';

import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/util/money';

/**
 * Inline SVG line chart — three series, no charting dependency.
 *
 * Kept dependency-free deliberately: this renders inside the Shopify admin
 * iframe where every extra kilobyte is paid on each page load.
 */
const SERIES = [
  { key: 'issued', label: 'Credit issued', color: '#0f9d58' },
  { key: 'redeemed', label: 'Credit redeemed', color: '#2a6df4' },
  { key: 'revenue', label: 'Revenue from orders using credit', color: '#8b5cf6' },
];

export default function CreditPerformanceChart({ series = [], currencyCode = 'USD', height = 260 }) {
  const [hidden, setHidden] = useState({});
  const [hoverIndex, setHoverIndex] = useState(null);

  const visible = SERIES.filter((s) => !hidden[s.key]);

  const { paths, maxValue, points } = useMemo(() => {
    const width = 1000;
    const max = Math.max(
      1,
      ...series.flatMap((row) => visible.map((s) => Number(row[s.key]) || 0))
    );
    const stepX = series.length > 1 ? width / (series.length - 1) : width;
    const toY = (value) => height - 24 - ((Number(value) || 0) / max) * (height - 48);

    const built = visible.map((s) => ({
      ...s,
      d: series
        .map((row, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${toY(row[s.key])}`)
        .join(' '),
    }));

    return {
      paths: built,
      maxValue: max,
      points: series.map((row, i) => ({ x: i * stepX, row })),
    };
  }, [series, visible, height]);

  if (!series.length) {
    return (
      <div className="cl-empty">
        <div className="cl-empty-title">No store credit activity yet</div>
        <p style={{ fontSize: 14 }}>
          Once store credit is issued or redeemed, your performance data will appear here.
        </p>
      </div>
    );
  }

  const hovered = hoverIndex != null ? series[hoverIndex] : null;

  return (
    <div>
      <div className="d-flex flex-wrap gap-3 mb-3">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
            className="btn btn-sm p-0 border-0 bg-transparent d-flex align-items-center gap-2"
            style={{ opacity: hidden[s.key] ? 0.4 : 1, fontSize: 12.5, fontWeight: 600 }}
            aria-pressed={!hidden[s.key]}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: s.color,
                display: 'inline-block',
              }}
            />
            <span style={{ color: 'var(--cl-body)' }}>{s.label}</span>
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 1000 ${height}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height, display: 'block' }}
          role="img"
          aria-label="Credit performance over time"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2="1000"
              y1={24 + ratio * (height - 48)}
              y2={24 + ratio * (height - 48)}
              stroke="#eef1f0"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {points.map((pt, i) => (
            <rect
              key={pt.row.date}
              x={pt.x - 6}
              y={0}
              width={12}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
            />
          ))}

          {hoverIndex != null && (
            <line
              x1={points[hoverIndex].x}
              x2={points[hoverIndex].x}
              y1="12"
              y2={height - 20}
              stroke="#c9d3cf"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        <div className="d-flex justify-content-between cl-source-note mt-1">
          <span>{series[0]?.date}</span>
          <span>Peak {formatMoney(maxValue, currencyCode, { compact: true })}</span>
          <span>{series[series.length - 1]?.date}</span>
        </div>

        {hovered && (
          <div
            className="cl-card p-2 mt-2"
            style={{ fontSize: 12.5, display: 'inline-block' }}
            role="status"
          >
            <strong>{hovered.date}</strong>
            {visible.map((s) => (
              <span key={s.key} className="ms-3" style={{ color: s.color, fontWeight: 600 }}>
                {formatMoney(hovered[s.key], currencyCode)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
