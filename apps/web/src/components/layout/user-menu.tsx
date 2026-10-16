"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { signOut } from "@/lib/sign-out";

type UserMenuProps = {
  displayName: string;
  initials: string;
};

export function UserMenu({ displayName, initials }: UserMenuProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white ring-2 ring-transparent transition-shadow",
          open && "ring-primary/30",
        )}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span suppressHydrationWarning>{initials}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 min-w-[11rem] rounded-[var(--radius-card)] border border-border bg-card py-1 shadow-[0_8px_24px_rgba(26,107,90,0.08)]"
        >
          <p className="truncate px-3 py-2 text-xs font-semibold text-ink" suppressHydrationWarning>
            {displayName}
          </p>
          <div className="my-1 border-t border-border" />
          <Link
            role="menuitem"
            href="/profile"
            className="block px-3 py-2 text-sm font-medium text-ink hover:bg-canvas"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            className="block w-full px-3 py-2 text-left text-sm font-medium text-danger hover:bg-canvas"
            onClick={() => {
              setOpen(false);
              void signOut().then(() => router.push("/sign-in"));
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
