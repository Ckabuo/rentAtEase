"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

type RadioCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string;
  icon?: ReactNode;
};

export function RadioCard({ name, value, checked, onChange, title, description, icon }: RadioCardProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-control border-[1.5px] px-3.5 py-3 transition-colors",
        checked ? "border-primary bg-teal-light" : "border-border bg-card hover:border-muted",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5 size-[18px] shrink-0 accent-primary"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-heading text-sm font-bold text-ink">
          {icon}
          {title}
        </span>
        {description ? <span className="mt-0.5 block text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
