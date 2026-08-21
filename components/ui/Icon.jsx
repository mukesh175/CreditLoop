/**
 * Inline icon set.
 *
 * Kept as local SVG rather than an icon package: the admin renders inside the
 * Shopify iframe, where every extra kilobyte is paid on each page load, and we
 * only need a dozen glyphs.
 */
const PATHS = {
  overview: 'M3 12h4l3 8 4-16 3 8h4',
  returns: 'M3 7h13a5 5 0 0 1 0 10H8m0 0 3-3m-3 3 3 3',
  orders: 'M4 4h16v4H4zM4 8v12h16V8M9 12h6',
  credit: 'M3 7h18v10H3zM3 11h18M7 15h3',
  customers: 'M16 20v-2a4 4 0 0 0-8 0v2M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-2a4 4 0 0 0-3-3.8',
  campaigns: 'M4 10v4h3l5 4V6l-5 4H4zM16.5 9.5a4 4 0 0 1 0 5M19 7a7.5 7.5 0 0 1 0 10',
  analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  notifications: 'M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M13.7 21a2 2 0 0 1-3.4 0',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.9 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13.9H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3',
  rules: 'M4 6h16M4 12h10M4 18h6M18 15l2 2 3-4',
  email: 'M3 6h18v12H3zM3 7l9 6 9-6',
  billing: 'M3 6h18v12H3zM3 10h18M7 15h4',
  audit: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h4',
  refresh: 'M20 11a8 8 0 1 0-1.5 5M20 5v6h-6',
  sync: 'M4 12a8 8 0 0 1 13.7-5.7L20 8M20 12a8 8 0 0 1-13.7 5.7L4 16M20 4v4h-4M4 20v-4h4',
  alert: 'M12 8v5M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
  check: 'M20 6 9 17l-5-5',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  chevron: 'M9 6l6 6-6 6',
};

export default function Icon({ name, size = 18, strokeWidth = 1.75, className = '', style }) {
  const d = PATHS[name];
  if (!d) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
