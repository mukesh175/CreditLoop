'use client';

export default function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;

  return (
    <div className="d-flex align-items-center justify-content-between px-3 py-2 border-top">
      <span className="cl-source-note">
        Page {page} of {pages} · {total} total
      </span>
      <div className="btn-group btn-group-sm">
        <button
          type="button"
          className="btn btn-cl-secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-cl-secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
