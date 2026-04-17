'use client';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  total?: number;
  limit?: number;
}

export function AdminPagination({ page, totalPages, onPage, total, limit }: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const showCounter = total !== undefined && limit !== undefined;
  const from = showCounter ? (page - 1) * (limit ?? 0) + 1 : null;
  const to = showCounter ? Math.min(page * (limit ?? 0), total ?? 0) : null;

  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-100 mt-4 px-4 pb-4">
      {showCounter ? (
        <p className="text-xs text-gray-500">{from}–{to} sur {total}</p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          ← Précédent
        </button>
        <span className="text-sm text-gray-600 px-2">Page {page} / {totalPages}</span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}

export default AdminPagination;
