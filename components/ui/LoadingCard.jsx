export default function LoadingCard({ rows = 4, title = true }) {
  return (
    <div className="cl-card">
      {title && (
        <div className="cl-card-header">
          <div className="cl-skeleton" style={{ height: 14, width: 160 }} />
        </div>
      )}
      <div className="cl-card-body">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="cl-skeleton mb-2"
            style={{ height: 16, width: `${95 - index * 9}%` }}
          />
        ))}
      </div>
    </div>
  );
}
