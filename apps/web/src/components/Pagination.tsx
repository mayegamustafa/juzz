'use client';

import { ChevronLeft, ChevronRight } from '@/components/icons';

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
}

/** Compact page numbers with ellipses: 1 … 4 [5] 6 … 20 */
function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push('…');
  out.push(total);
  return out;
}

export function Pagination({
  meta,
  onPage,
  onPageSize,
  pageSizes = [10, 25, 50, 100],
}: {
  meta: PageMeta;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  pageSizes?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  if (meta.total === 0) return null;

  const first = (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-3" style={{ color: 'var(--muted)' }}>
        <span>
          <b>{first}</b>–<b>{last}</b> of <b>{meta.total}</b>
        </span>
        {onPageSize && (
          <label className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Rows</span>
            <select
              className="input h-8 w-auto py-0 text-xs"
              value={meta.pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          className="btn-outline h-8 px-2"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {pageNumbers(meta.page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1.5" style={{ color: 'var(--muted)' }}>
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === meta.page ? 'page' : undefined}
              className={`h-8 min-w-8 rounded-md px-2 text-xs font-medium transition-colors ${
                p === meta.page ? 'bg-emerald-600 text-white' : 'border hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
              }`}
              style={p === meta.page ? {} : { borderColor: 'var(--border)' }}
            >
              {p}
            </button>
          ),
        )}

        <button
          className="btn-outline h-8 px-2"
          disabled={meta.page >= totalPages}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
