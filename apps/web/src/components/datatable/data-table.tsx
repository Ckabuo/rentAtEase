"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { TablePagination } from "./table-pagination";

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  if (!direction) {
    return <span className="ml-1 text-muted/60" aria-hidden>↕</span>;
  }
  return (
    <span className="ml-1 text-primary" aria-hidden>
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}

export type DataTableProps<TData extends object> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  emptyMessage?: string;
  initialSorting?: SortingState;
  initialPageSize?: number;
  striped?: boolean;
};

export function DataTable<TData extends object>({
  columns,
  data,
  loading = false,
  emptyMessage = "No items found.",
  initialSorting = [],
  initialPageSize = 10,
  striped = true,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [data.length]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  const th =
    "px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap";
  const td = "px-4 py-3 align-middle text-sm text-ink";

  const rows = table.getRowModel().rows;
  const pageIndex = pagination.pageIndex + 1;

  return (
    <div className="relative">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70">
          <Spinner label="Loading…" />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-card text-sm">
          <thead className="bg-canvas/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={th}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-0.5 text-left",
                          header.column.getCanSort() ? "cursor-pointer select-none hover:text-ink" : "cursor-default",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? (
                          <SortIndicator direction={header.column.getIsSorted()} />
                        ) : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-border",
                    striped && rowIndex % 2 === 1 ? "bg-canvas/40" : "bg-card",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={td}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data.length > 0 ? (
        <TablePagination
          count={data.length}
          pageIndex={pageIndex}
          pageSize={pagination.pageSize}
          onPageIndexChange={(index) => table.setPageIndex(index - 1)}
          onPageSizeChange={(size) => table.setPageSize(size)}
        />
      ) : null}
    </div>
  );
}
