export default function EmptyState({ title, message, action }) {
  return (
    <div className="cl-empty">
      <div className="cl-empty-title">{title}</div>
      <p className="mb-3" style={{ maxWidth: 420, margin: '0 auto', fontSize: 14 }}>
        {message}
      </p>
      {action}
    </div>
  );
}
