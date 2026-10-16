"use client";

import { IconSearch } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export type TableToolbarSelect = {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

type TableToolbarProps = {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: TableToolbarSelect[];
  className?: string;
};

export function TableToolbar({
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  filters = [],
  className,
}: TableToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between", className)}>
      <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          className="pl-9"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search table"
        />
      </div>
      {filters.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {filters.map((filter) => (
            <label key={filter.id} className="block text-sm">
              <span className="mb-1 block text-muted">{filter.label}</span>
              <select
                className="min-w-[9rem] rounded-control border border-border bg-cream px-3 py-2 text-sm text-ink"
                value={filter.value}
                onChange={(event) => filter.onChange(event.target.value)}
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
