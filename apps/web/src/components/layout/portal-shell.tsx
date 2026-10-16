"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import {
  IconBell,
  IconChart,
  IconGrid,
  IconHome,
  IconMenu,
  IconPanel,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconUsers,
  IconWallet,
  IconWrench,
} from "@/components/icons";
import { UserMenu } from "@/components/layout/user-menu";
import { useSignedInName } from "@/hooks/use-client-session";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type NavItem = {
  href: string;
  label: string;
  icon: typeof IconGrid;
  disabled?: boolean;
  badge?: number;
};

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: IconGrid },
      { href: "/properties", label: "Properties", icon: IconHome },
      { href: "/tenants", label: "Tenants", icon: IconUsers },
      { href: "/applications", label: "Applications", icon: IconSearch },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/payments", label: "Payments", icon: IconWallet },
      { href: "/receipts", label: "Receipts", icon: IconReceipt },
      { href: "/reports", label: "Reports", icon: IconChart },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/reminders", label: "Reminders", icon: IconBell },
      { href: "/maintenance", label: "Maintenance", icon: IconWrench, disabled: true },
      { href: "/settings", label: "Settings", icon: IconSettings },
    ],
  },
];

type PortalChrome = {
  query: string;
  notify: (message: string) => void;
};

const PortalChromeContext = createContext<PortalChrome | null>(null);

export function usePortalChrome(): PortalChrome {
  const chrome = useContext(PortalChromeContext);
  if (!chrome) {
    throw new Error("usePortalChrome must be used inside PortalShell");
  }
  return chrome;
}

type PortalShellProps = {
  children: ReactNode;
  title: string;
  userName?: string;
  planLabel?: string;
  notices?: string[];
};

export function PortalShell({
  children,
  title,
  userName,
  planLabel = "Starter",
  notices = [],
}: PortalShellProps) {
  const sessionName = useSignedInName();
  const displayName = userName ?? sessionName ?? "Landlord";
  const pathname = usePathname();
  const searchId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [readNoticeKey, setReadNoticeKey] = useState("");
  const noticesRef = useRef<HTMLDivElement>(null);
  const [menuPath, setMenuPath] = useState(pathname);
  const noticeKey = notices.join("\0");
  const hasUnreadNotices = notices.length > 0 && noticeKey !== readNoticeKey;
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setMenuOpen(false);
    setNoticesOpen(false);
    setQuery("");
  }

  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const notify = (message: string) => {
    toast.message(message);
    setNoticesOpen(false);
  };

  useEffect(() => {
    if (!noticesOpen) return;
    setReadNoticeKey(noticeKey);
    const onPointerDown = (event: MouseEvent) => {
      if (!noticesRef.current?.contains(event.target as Node)) setNoticesOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [noticesOpen, noticeKey]);

  return (
    <PortalChromeContext.Provider value={{ query, notify }}>
      <div className="min-h-screen bg-canvas text-ink [--portal-header-h:4rem]">
        {menuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-ink/70 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}

        <aside
          id="portal-sidebar"
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(280px,85vw)] flex-col overflow-hidden bg-ink text-white transition-[width,transform] duration-200 lg:translate-x-0",
            menuOpen ? "translate-x-0" : "-translate-x-full",
            collapsed ? "lg:w-[80px]" : "lg:w-[220px]",
          )}
        >
          <div className={cn("flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5", collapsed && "lg:flex-col lg:justify-center lg:px-3")}>
            <div className={cn(collapsed && "lg:hidden")}>
              <Logo href="/dashboard" inverted />
            </div>
            <span className={cn("hidden font-display text-lg font-black tracking-tight", collapsed && "lg:inline")}>
              R<span className="text-primary-hover">@</span>E
            </span>
            <button
              type="button"
              className="hidden size-8 items-center justify-center rounded-control text-white/50 hover:bg-white/10 hover:text-white lg:inline-flex"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <IconPanel className="size-4" />
            </button>
          </div>

          <div className={cn("flex items-center gap-3 border-b border-white/10 px-5 py-4", collapsed && "lg:justify-center lg:px-3")}>
            <span suppressHydrationWarning className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {initials}
            </span>
            <div className={cn("min-w-0", collapsed && "lg:hidden")}>
              <p suppressHydrationWarning className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-[0.65rem] text-white/40">{planLabel} plan</p>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto py-4" aria-label="Main">
            {navSections.map((section) => (
              <div key={section.title} className="mb-3">
                <p className={cn("px-5 pb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white/25", collapsed && "lg:sr-only")}>
                  {section.title}
                </p>
                <ul>
                  {section.items.map((item) => {
                    const active = !item.disabled && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                    const Icon = item.icon;
                    const className = cn(
                      "flex w-full items-center gap-2.5 border-l-[3px] py-2.5 pr-4 text-left text-[0.82rem] font-medium transition-colors",
                      collapsed ? "lg:justify-center lg:px-0" : "pl-[17px]",
                      active
                        ? "border-primary-hover bg-white/[0.07] text-white"
                        : "border-transparent text-white/55 hover:bg-white/[0.04] hover:text-white",
                      item.disabled && "cursor-default hover:bg-transparent hover:text-white/40",
                    );
                    const inner = (
                      <>
                        <Icon className="size-4 shrink-0" />
                        <span className={cn("truncate", collapsed && "lg:sr-only")}>{item.label}</span>
                        {item.badge ? (
                          <span
                            className={cn(
                              "ml-auto rounded-full bg-danger px-1.5 py-px text-[0.6rem] font-bold text-white",
                              collapsed && "lg:hidden",
                            )}
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </>
                    );

                    return (
                      <li key={item.href}>
                        {item.disabled ? (
                          <span className={className} title="Coming soon">
                            {inner}
                          </span>
                        ) : (
                          <Link href={item.href} className={className} onClick={() => setMenuOpen(false)}>
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className={cn("border-t border-white/10 p-4", collapsed && "lg:hidden")}>
            <div className="rounded-[10px] bg-gradient-to-br from-primary to-primary-hover p-3.5 text-center">
              <p className="text-[0.72rem] leading-relaxed text-white/80">
                Upgrade to <strong className="text-white">Pro</strong> for unlimited units and advanced reports.
              </p>
              <Link
                href="/settings"
                className="mt-2 block w-full rounded-md bg-white px-3 py-1.5 text-[0.72rem] font-bold text-primary"
              >
                View plans
              </Link>
            </div>
          </div>
        </aside>

        <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-[80px]" : "lg:pl-[220px]")}>
          <header className="sticky top-0 z-[60] flex h-[var(--portal-header-h)] min-h-[var(--portal-header-h)] items-center justify-between gap-3 border-b border-border bg-[rgba(250,247,242,0.94)] px-4 py-3.5 backdrop-blur-xl sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-control border border-border bg-card text-ink lg:hidden"
                onClick={() => setMenuOpen(true)}
                aria-expanded={menuOpen}
                aria-controls="portal-sidebar"
                aria-label="Open menu"
              >
                <IconMenu className="size-4" />
              </button>
              <h1 className="truncate font-heading text-base font-bold text-ink">{title}</h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <label htmlFor={searchId} className="hidden items-center gap-2 rounded-control border border-border bg-canvas px-3 py-2 text-muted sm:flex">
                <IconSearch className="size-4" />
                <input
                  id={searchId}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tenants, units..."
                  className="w-40 bg-transparent text-[0.82rem] text-ink outline-none placeholder:text-muted lg:w-44"
                />
              </label>

              <div ref={noticesRef} className="relative">
                <button
                  type="button"
                  className="relative inline-flex size-9 items-center justify-center rounded-control text-ink transition-colors hover:bg-canvas/90"
                  aria-label={hasUnreadNotices ? "Notifications, unread" : "Notifications"}
                  aria-expanded={noticesOpen}
                  onClick={() => setNoticesOpen((open) => !open)}
                >
                  <IconBell className="size-4" />
                  {hasUnreadNotices ? (
                    <span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-[rgba(250,247,242,0.94)]" />
                  ) : null}
                </button>
                {noticesOpen ? (
                  <div className="absolute right-0 top-11 w-80 rounded-[var(--radius-card)] border border-border bg-card p-2 shadow-[0_8px_24px_rgba(26,107,90,0.08)]">
                    <p className="px-2 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted">Notifications</p>
                    {notices.length ? (
                      notices.map((notice) => (
                        <button
                          key={notice}
                          type="button"
                          className="block w-full rounded-control px-2 py-2 text-left text-sm text-ink hover:bg-canvas"
                          onClick={() => notify(notice)}
                        >
                          {notice}
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-2 text-sm text-muted">You&apos;re up to date.</p>
                    )}
                  </div>
                ) : null}
              </div>

              <UserMenu displayName={displayName} initials={initials} />
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-7 sm:py-7">{children}</div>
        </div>

      </div>
    </PortalChromeContext.Provider>
  );
}
