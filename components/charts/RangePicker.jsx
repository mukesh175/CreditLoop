'use client';

const RANGES = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

export default function RangePicker({ value, onChange, custom, onCustomChange }) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      <div className="btn-group btn-group-sm" role="group" aria-label="Date range">
        {RANGES.map((range) => (
          <button
            key={range.id}
            type="button"
            className={`btn ${value === range.id ? 'btn-cl-primary' : 'btn-cl-secondary'}`}
            onClick={() => onChange(range.id)}
          >
            {range.label}
          </button>
        ))}
        <button
          type="button"
          className={`btn ${value === 'custom' ? 'btn-cl-primary' : 'btn-cl-secondary'}`}
          onClick={() => onChange('custom')}
        >
          Custom
        </button>
      </div>

      {value === 'custom' && (
        <div className="d-flex align-items-center gap-2">
          <input
            type="date"
            className="form-control form-control-sm"
            value={custom?.from || ''}
            onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            aria-label="From date"
          />
          <span className="cl-source-note">to</span>
          <input
            type="date"
            className="form-control form-control-sm"
            value={custom?.to || ''}
            onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            aria-label="To date"
          />
        </div>
      )}
    </div>
  );
}
