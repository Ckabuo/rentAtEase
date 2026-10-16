"use client";

import { REMINDER_SCHEDULE } from "@rae/domain";
import { type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/datatable/data-table";
import { TableToolbar } from "@/components/datatable/table-toolbar";
import { PortalShell } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api, toastApiError } from "@/lib/api";
import { displayDate } from "@/lib/display-date";
import { toast } from "@/lib/toast";

type MessageRow = {
  id: string;
  to: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
  templateKey: string | null;
};

type Overview = {
  lastSweepAt: string | null;
  messages: MessageRow[];
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "SENT", label: "Sent" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "QUEUED", label: "Queued" },
  { value: "FAILED", label: "Failed" },
  { value: "SKIPPED", label: "Skipped" },
];

const TEMPLATE_FILTER_ALL = "ALL";

function formatTemplateLabel(key: string | null): string {
  if (!key) return "—";
  const labels: Record<string, string> = {
    rae_rent_reminder: "Rent reminder",
    rae_rent_overdue: "Rent overdue",
    rae_owner_overdue: "Owner overdue",
    rae_rent_receipt: "Rent receipt",
    rae_application_received: "Application received",
    rae_application_decision: "Application decision",
    rae_tenant_welcome: "Tenant welcome",
    rae_caretaker_invite: "Caretaker invite",
    rae_otp: "OTP",
  };
  return labels[key] ?? key;
}

function statusTone(status: string): string {
  switch (status) {
    case "SENT":
    case "DELIVERED":
      return "bg-success/15 text-success";
    case "QUEUED":
      return "bg-amber/15 text-amber";
    case "FAILED":
      return "bg-danger/15 text-danger";
    case "SKIPPED":
      return "bg-muted/15 text-muted";
    default:
      return "bg-canvas text-muted";
  }
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${displayDate(iso.slice(0, 10))} · ${date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function RemindersPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweepBusy, setSweepBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [templateFilter, setTemplateFilter] = useState(TEMPLATE_FILTER_ALL);

  const load = useCallback(() => {
    setLoading(true);
    void api<Overview>("/messaging")
      .then(setOverview)
      .catch((caught: unknown) => toastApiError(caught, "Could not load reminders."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const templateOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const message of overview?.messages ?? []) {
      if (message.templateKey) keys.add(message.templateKey);
    }
    return [
      { value: TEMPLATE_FILTER_ALL, label: "All types" },
      ...[...keys].sort().map((key) => ({ value: key, label: formatTemplateLabel(key) })),
    ];
  }, [overview?.messages]);

  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (overview?.messages ?? []).filter((message) => {
      if (statusFilter !== "ALL" && message.status !== statusFilter) return false;
      if (templateFilter !== TEMPLATE_FILTER_ALL && message.templateKey !== templateFilter) return false;
      if (!query) return true;
      const haystack = [
        message.templateKey,
        formatTemplateLabel(message.templateKey),
        message.to,
        message.status,
        message.failureReason,
        message.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [overview?.messages, search, statusFilter, templateFilter]);

  const columns = useMemo<ColumnDef<MessageRow, unknown>[]>(
    () => [
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Sent",
        enableSorting: true,
        cell: ({ row }) => <span className="whitespace-nowrap text-muted">{formatDateTime(row.original.createdAt)}</span>,
        sortingFn: (left, right) => left.original.createdAt.localeCompare(right.original.createdAt),
      },
      {
        id: "templateKey",
        accessorFn: (row) => row.templateKey ?? "",
        header: "Types",
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{formatTemplateLabel(row.original.templateKey)}</span>
            {row.original.templateKey ? (
              <span className="mt-0.5 block text-xs text-muted">{row.original.templateKey}</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "to",
        header: "Recipient",
        enableSorting: true,
        cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(String(getValue()))}`}>
            {String(getValue())}
          </span>
        ),
      },
      {
        accessorKey: "failureReason",
        header: "Details",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.failureReason ? (
            <span className="max-w-md text-danger">{row.original.failureReason}</span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
    ],
    [],
  );

  const annualSchedule = REMINDER_SCHEDULE.ANNUAL;

  const runSweep = () => {
    setSweepBusy(true);
    void api<{ queued: number }>("/messaging/reminders/run", { method: "POST" })
      .then((result) => {
        toast.success(`Queued ${result.queued} message${result.queued === 1 ? "" : "s"}.`);
        load();
      })
      .catch((caught: unknown) => toastApiError(caught, "The sweep did not run."))
      .finally(() => setSweepBusy(false));
  };

  return (
    <PortalShell title="Reminders">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>WhatsApp schedule</CardTitle>
              <CardDescription className="mt-1">
                Annual rent is reminded 30 days before it is due, then at 3, 7 and 14 days overdue. The landlord is told at
                30 days overdue. Monthly and bi-annual cycles are not messaged automatically yet. A sweep runs daily at
                08:00 Africa/Lagos when Redis is configured.
              </CardDescription>
              <ul className="mt-4 space-y-1 text-sm text-muted">
                {annualSchedule.map((item) => (
                  <li key={`${item.templateKey}-${item.daysFromDue}`}>
                    <span className="font-medium text-ink">{formatTemplateLabel(item.templateKey)}</span>
                    {" · "}
                    {item.daysFromDue < 0
                      ? `${Math.abs(item.daysFromDue)} days before due`
                      : `${item.daysFromDue} days after due`}
                    {" · "}
                    {item.audience === "tenant" ? "Tenant" : "Landlord"}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted">
                Last sweep:{" "}
                {overview?.lastSweepAt ? formatDateTime(overview.lastSweepAt) : loading ? "…" : "Not run yet"}
              </p>
            </div>
            <Button type="button" className="shrink-0" loading={sweepBusy} onClick={runSweep}>
              Run reminder check
            </Button>
          </div>
        </Card>

        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <CardTitle>Message log</CardTitle>
            <CardDescription>Recent WhatsApp messages for this account (last 40).</CardDescription>
          </div>
          <TableToolbar
            searchPlaceholder="Search type, recipient, status…"
            searchValue={search}
            onSearchChange={setSearch}
            filters={[
              {
                id: "status",
                label: "Status",
                value: statusFilter,
                options: STATUS_OPTIONS,
                onChange: setStatusFilter,
              },
              {
                id: "template",
                label: "Types",
                value: templateFilter,
                options: templateOptions,
                onChange: setTemplateFilter,
              },
            ]}
          />
          <DataTable
            columns={columns}
            data={filteredMessages}
            loading={loading}
            emptyMessage={search || statusFilter !== "ALL" || templateFilter !== TEMPLATE_FILTER_ALL
              ? "No messages match your filters."
              : "No messages yet. Run a reminder check or record activity that sends WhatsApp."}
            initialSorting={[{ id: "createdAt", desc: true }]}
            initialPageSize={10}
          />
        </Card>
      </div>
    </PortalShell>
  );
}
