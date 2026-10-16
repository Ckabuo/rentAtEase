"use client";

type TablePaginationProps = {
  count: number;
  pageIndex: number;
  pageSize: number;
  onPageIndexChange: (index: number) => void;
  onPageSizeChange: (size: number) => void;
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

export function TablePagination({
  count,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const lastPage = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(pageIndex, lastPage);
  const startEntry = count === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endEntry = Math.min(safePage * pageSize, count);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted">
        Showing {startEntry}–{endEntry} of {count} {count === 1 ? "entry" : "entries"}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          Show
          <select
            className="rounded-control border border-border bg-cream px-2 py-1 text-sm text-ink"
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
              onPageIndexChange(1);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          per page
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageIndexChange(Math.max(1, safePage - 1))}
            className="rounded-control border border-border bg-card px-3 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            Prev
          </button>
          <span className="min-w-[4.5rem] text-center text-sm font-medium text-ink">
            {safePage} / {lastPage}
          </span>
          <button
            type="button"
            disabled={safePage >= lastPage}
            onClick={() => onPageIndexChange(Math.min(lastPage, safePage + 1))}
            className="rounded-control border border-border bg-card px-3 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
