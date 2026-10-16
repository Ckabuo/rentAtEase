"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { api, toastApiError } from "@/lib/api";
import { IconBell, IconChart, IconHome, IconSearch } from "@/components/icons";
import { usePortalChrome } from "@/components/layout/portal-shell";
import { cn } from "@/lib/cn";

type Tone = "teal" | "amber" | "green" | "red";

const toneClass: Record<Tone, { value: string; wash: string }> = {
  teal: { value: "text-primary", wash: "bg-primary" },
  amber: { value: "text-amber", wash: "bg-amber" },
  green: { value: "text-success", wash: "bg-success" },
  red: { value: "text-danger", wash: "bg-danger" },
};

type TenantStatus = "paid" | "due" | "overdue" | "vacant" | "part";

type TenantRow = {
  id?: string;
  tenancyId?: string | null;
  initials: string;
  name: string;
  property: string;
  unit: string;
  rent: string;
  status: TenantStatus;
  statusLabel?: string;
  avatar?: string;
};

export type DashboardLive = {
  preview: boolean;
  subtitle: string;
  stats: { label: string; value: string; change: string; tone: Tone; changeTone?: "up" | "down" | "muted" }[];
  tenants: TenantRow[];
  months: { label: string; collected: number; expected: number; collectedLabel?: string; expectedLabel?: string }[];
  applicants: { id?: string; initials: string; name: string; detail: string; score: number; verdict: string; tone: "high" | "mid" | "low" }[];
  activity: { id?: string; title: string; detail: string; time: string; tone: string }[];
};

const statusLabel: Record<TenantStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-success-light text-success" },
  due: { label: "Due soon", className: "bg-amber-light text-amber" },
  overdue: { label: "Overdue", className: "bg-danger-light text-danger" },
  part: { label: "Part-paid", className: "bg-amber-light text-amber" },
  vacant: { label: "Vacant", className: "bg-teal-light text-primary" },
};

function relativeTime(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  const minutes = Math.round((Date.now() - parsed) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

function Panel({
  title,
  subtitle,
  action,
  scrollable,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
  /** Cap list height and scroll when content overflows. */
  scrollable?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[16px] border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-heading text-[0.9rem] font-bold text-ink">{title}</h2>
          {subtitle ? <p className="text-[0.72rem] text-muted">{subtitle}</p> : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 text-[0.78rem] font-semibold text-primary hover:underline"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {scrollable ? (
        <div className="max-h-[min(22rem,45vh)] overflow-y-auto overscroll-y-contain">{children}</div>
      ) : (
        children
      )}
    </section>
  );
}

const avatars = ["bg-teal-light text-primary", "bg-amber-light text-amber", "bg-success-light text-success", "bg-danger-light text-danger"];

export function LandlordDashboard({ live }: { live: DashboardLive }) {
  const router = useRouter();
  const { query, notify } = usePortalChrome();
  const [mobileQuery, setMobileQuery] = useState("");
  const statCards = live.stats;
  const tenantSource = live.tenants;
  const monthBars = live.months;
  const applicantRows = live.applicants;
  const activityRows = live.activity;
  const needle = (query || mobileQuery).trim().toLowerCase();

  const rows = useMemo(() => {
    if (!needle) return tenantSource;
    return tenantSource.filter((row) =>
      [row.name, row.property, row.unit, row.rent, row.statusLabel ?? statusLabel[row.status].label].join(" ").toLowerCase().includes(needle),
    );
  }, [needle, tenantSource]);

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 rounded-control border border-border bg-card px-3 py-2 text-muted sm:hidden">
        <IconSearch className="size-4" />
        <input
          value={mobileQuery}
          onChange={(event) => setMobileQuery(event.target.value)}
          placeholder="Search tenants, units..."
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <article
            key={stat.label}
            className="relative overflow-hidden rounded-[14px] border border-border bg-card p-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_8px_24px_rgba(26,107,90,0.08)]"
          >
            <span
              className={cn(
                "pointer-events-none absolute right-0 top-0 size-[60px] rounded-bl-[60px] rounded-tr-[14px] opacity-[0.06]",
                toneClass[stat.tone].wash,
              )}
            />
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted">{stat.label}</p>
            <p className={cn("mt-2.5 font-display text-[1.9rem] font-black leading-none tracking-[-0.04em]", toneClass[stat.tone].value)}>
              {stat.value}
            </p>
            <p
              className={cn(
                "mt-1.5 text-[0.72rem]",
                stat.changeTone === "down" && "text-danger",
                stat.changeTone === "up" && "text-primary",
                stat.changeTone === "muted" && "text-muted",
              )}
            >
              {stat.change}
            </p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Panel
          title="Active tenants"
          subtitle={live.subtitle}
          action={{ label: "+ Add tenant", href: "/tenants" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="bg-canvas text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted">
                  <th className="whitespace-nowrap px-5 py-2.5 font-bold">Tenant</th>
                  <th className="whitespace-nowrap px-5 py-2.5 font-bold">Unit</th>
                  <th className="whitespace-nowrap px-5 py-2.5 font-bold">Annual rent</th>
                  <th className="whitespace-nowrap px-5 py-2.5 font-bold">Status</th>
                  <th className="whitespace-nowrap px-5 py-2.5 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted">
                      {needle
                        ? `No tenants match “${needle}”.`
                        : "No tenants or units yet. Add a property, then add tenants or share an application link."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const status = statusLabel[row.status] ?? statusLabel.due;
                    const label = row.statusLabel ?? status.label;
                    return (
                      <tr key={`${row.name}-${row.unit}`} className="border-b border-border/50 last:border-0 hover:bg-canvas/60">
                        <td className="whitespace-nowrap px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold", row.avatar ?? avatars[rows.indexOf(row) % avatars.length])}>
                              {row.initials}
                            </span>
                            <span>
                              <span className="block text-[0.83rem] font-semibold">{row.name}</span>
                              <span className="block text-[0.7rem] text-muted">{row.property}</span>
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-[0.82rem]">{row.unit}</td>
                        <td className="whitespace-nowrap px-5 py-3 font-display text-[0.95rem] font-black tracking-[-0.03em]">{row.rent}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.04em]", status.className)}>
                            {label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <div className="flex gap-1.5">
                            {row.status === "vacant" ? (
                              <button
                                type="button"
                                className="rounded-md bg-teal-light px-2.5 py-1 text-[0.7rem] font-semibold text-primary hover:bg-primary hover:text-white"
                                onClick={() => router.push("/properties")}
                              >
                                Application link
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className={cn(
                                    "rounded-md px-2.5 py-1 text-[0.7rem] font-semibold",
                                    row.status === "paid"
                                      ? "bg-teal-light text-primary hover:bg-primary hover:text-white"
                                      : "bg-amber-light text-amber hover:bg-amber hover:text-white",
                                  )}
                                  onClick={() => {
                                    if (row.status === "paid" || !row.tenancyId) {
                                      router.push("/receipts");
                                      return;
                                    }
                                    void api<{ sent: boolean; reason?: string }>(`/messaging/tenancies/${row.tenancyId}/remind`, { method: "POST" })
                                      .then((result) => notify(result.sent ? `Reminder queued for ${row.name.split(" ")[0]}.` : result.reason ?? "Reminder was not sent."))
                                      .catch((error: unknown) => toastApiError(error, "Reminder was not sent."));
                                  }}
                                >
                                  {row.status === "paid" ? "Receipt" : "Remind"}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-border bg-canvas px-2.5 py-1 text-[0.7rem] font-semibold text-muted hover:border-ink hover:text-ink"
                                  onClick={() => router.push("/tenants")}
                                >
                                  View
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Monthly income">
            <div className="px-5 py-4">
              <div className="flex h-[120px] items-end gap-2">
                {monthBars.map((month) => (
                  <div key={month.label} className="flex h-full flex-1 items-end gap-0.5">
                    <div
                      className="flex-1 rounded-t-[5px] bg-primary"
                      style={{ height: `${month.collected}%` }}
                      title={month.collectedLabel ?? `Collected ${month.collected}`}
                    />
                    <div
                      className="flex-1 rounded-t-[5px] bg-teal-light"
                      style={{ height: `${month.expected}%` }}
                      title={month.expectedLabel ?? `Expected ${month.expected}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-2">
                {monthBars.map((month) => (
                  <span key={month.label} className="flex-1 text-center text-[0.62rem] text-muted">
                    {month.label}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-[0.7rem] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-primary" /> Collected
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-teal-light" /> Expected
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2.5 p-4">
              {[
                { label: "Applications", icon: IconSearch, className: "bg-teal-light text-primary hover:bg-primary hover:text-white", href: "/applications" },
                { label: "Bulk remind", icon: IconBell, className: "bg-amber-light text-amber hover:bg-amber hover:text-white", href: "/reminders" },
                { label: "Report", icon: IconChart, className: "border border-border bg-canvas text-ink hover:border-ink", href: "/reports" },
                { label: "Add property", icon: IconHome, className: "border border-border bg-canvas text-ink hover:border-ink", href: "/properties" },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => router.push(action.href)}
                  className={cn("flex flex-col items-center gap-1.5 rounded-[10px] px-3 py-3 text-[0.78rem] font-bold transition-colors", action.className)}
                >
                  <action.icon className="size-4" />
                  {action.label}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="Pending applicants"
          subtitle={`${applicantRows.length} awaiting your review`}
          action={{ label: "View all", href: "/applications" }}
          scrollable
        >
          <ul>
            {applicantRows.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-muted">No applications waiting for review.</li>
            ) : null}
            {applicantRows.map((applicant) => (
              <li key={applicant.name} className="border-b border-border/40 last:border-0">
                <button
                  type="button"
                  disabled={!applicant.id}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => applicant.id && router.push(`/applications/${applicant.id}`)}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      applicant.tone === "high" && "bg-primary",
                      applicant.tone === "mid" && "bg-amber",
                      applicant.tone === "low" && "bg-danger",
                    )}
                  >
                    {applicant.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{applicant.name}</span>
                    <span className="block truncate text-[0.72rem] text-muted">{applicant.detail}</span>
                  </span>
                  <span className="text-right">
                    <span
                      className={cn(
                        "block font-display text-lg font-black leading-none tracking-[-0.04em]",
                        applicant.tone === "high" && "text-success",
                        applicant.tone === "mid" && "text-amber",
                        applicant.tone === "low" && "text-danger",
                      )}
                    >
                      {applicant.score}
                    </span>
                    <span
                      className={cn(
                        "mt-1 inline-flex rounded px-1.5 py-0.5 text-[0.65rem] font-bold",
                        applicant.tone === "high" && "bg-success-light text-success",
                        applicant.tone === "mid" && "bg-amber-light text-amber",
                        applicant.tone === "low" && "bg-danger-light text-danger",
                      )}
                    >
                      {applicant.verdict}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent activity" subtitle="Latest events across your properties" scrollable>
          <ul>
            {activityRows.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-muted">No activity yet. Payments and applications will show up here.</li>
            ) : null}
            {activityRows.map((item) => (
              <li
                key={item.id ?? `${item.time}-${item.detail}`}
                className="flex items-start gap-3 border-b border-border/40 px-5 py-3 last:border-0 hover:bg-canvas"
              >
                <span className={cn("mt-0.5 size-2 shrink-0 rounded-full", item.tone)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.82rem] font-semibold">{item.title}</span>
                  <span className="block text-[0.72rem] text-muted">{item.detail}</span>
                </span>
                <span className="shrink-0 text-[0.68rem] text-muted">{relativeTime(item.time)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
