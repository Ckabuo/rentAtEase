"use client";

import { type ReactNode } from "react";
import { IconSearch } from "@/components/icons";
import { cn } from "@/lib/cn";

type ListToolbarProps = {
  /** Shown on small screens; header search covers desktop when wired to portal chrome. */
  mobileSearch?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
  resultSummary: string;
  activeFilterCount: number;
  onClearFilters: () => void;
  children: ReactNode;
};

export function ListToolbar({
  mobileSearch,
  resultSummary,
  activeFilterCount,
  onClearFilters,
  children,
}: ListToolbarProps) {
  return (
    <div className="mb-5 space-y-3">
      {mobileSearch ? (
        <label className="flex items-center gap-2 rounded-control border border-border bg-card px-3 py-2 text-muted sm:hidden">
          <IconSearch className="size-4 shrink-0" />
          <input
            value={mobileSearch.value}
            onChange={(event) => mobileSearch.onChange(event.target.value)}
            placeholder={mobileSearch.placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{resultSummary}</span>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="font-semibold text-primary hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
};

export function FilterSelect({ label, value, onChange, options, className }: FilterSelectProps) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-xs text-muted", className)}>
      <span className="sr-only">{label}</span>
      <span className="hidden font-semibold sm:inline">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="rounded-control border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-ink outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
