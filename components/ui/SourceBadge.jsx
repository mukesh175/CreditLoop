/**
 * Marks where a number came from. Shopify balances and CreditLoop analytics must
 * never be visually indistinguishable — that is how people end up trusting the
 * wrong figure.
 */
export default function SourceBadge({ source, syncedAt }) {
  if (source === 'shopify') {
    return <span className="cl-pill cl-pill-green">Shopify balance</span>;
  }
  return (
    <span className="cl-pill cl-pill-muted" title={syncedAt ? `Synced ${new Date(syncedAt).toLocaleString()}` : undefined}>
      CreditLoop analytics{syncedAt ? ` · synced ${timeAgo(syncedAt)}` : ''}
    </span>
  );
}

function timeAgo(date) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
