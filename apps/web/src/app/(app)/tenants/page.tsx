"use client";

import { useEffect, useMemo, useState } from "react";
import { AddTenantOffCanvas, type TenantEditValues } from "@/components/tenants/add-tenant-off-canvas";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { PortalShell, usePortalChrome } from "@/components/layout/portal-shell";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FilterSelect, ListToolbar } from "@/components/ui/list-toolbar";
import { api, toastApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  activeTenancyFilterCount,
  defaultTenancyFilters,
  filterTenancies,
  sortTenancies,
  type TenancyListFilters,
  type TenancyRow,
  uniqueTenancyProperties,
} from "@/lib/filter-tenancies";
import { normalizeSearchQuery } from "@/lib/list-search";
import { toast } from "@/lib/toast";
import { displayDate } from "@/lib/display-date";
import { formatNaira } from "@rae/domain";

type Directory = {
  tenancies: TenancyRow[];
  tenants: { id: string; fullName: string; phone: string; whatsappConsent: boolean }[];
  units: { id: string; label: string; property: string; status: string; rentAmountKobo: number; cycle: string }[];
};

type TenantDialog =
  | { type: "move-out"; tenancyId: string; tenantName: string }
  | { type: "delete"; tenantId: string; tenantName: string }
  | null;

const rentStatusBadge: Record<
  NonNullable<TenancyRow["rentStatus"]>,
  { label: string; className: string }
> = {
  PAID: { label: "Paid up", className: "bg-success-light text-success" },
  DUE_SOON: { label: "Due soon", className: "bg-amber-light text-amber" },
  OVERDUE: { label: "Overdue", className: "bg-danger-light text-danger" },
  PART_PAID: { label: "Part-paid", className: "bg-amber-light text-amber" },
};

export default function TenantsPage() {
  return (
    <PortalShell title="Tenants">
      <TenantsPageContent />
    </PortalShell>
  );
}

function TenantsPageContent() {
  const { query: portalQuery } = usePortalChrome();
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantEditValues | null>(null);
  const [dialog, setDialog] = useState<TenantDialog>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [mobileQuery, setMobileQuery] = useState("");
  const [filters, setFilters] = useState<TenancyListFilters>(defaultTenancyFilters);

  const load = () => {
    void api<Directory>("/tenancies")
      .then(setDirectory)
      .catch((caught: unknown) =>
        toastApiError(caught, "Could not load tenants."),
      );
  };
  useEffect(load, []);

  const searchQuery = portalQuery || mobileQuery;
  const allTenancies = directory?.tenancies ?? [];
  const filtered = useMemo(
    () => sortTenancies(filterTenancies(allTenancies, searchQuery, filters)),
    [allTenancies, searchQuery, filters],
  );
  const propertyOptions = useMemo(() => uniqueTenancyProperties(allTenancies), [allTenancies]);
  const filterCount = activeTenancyFilterCount(filters);
  const hasListFilters =
    filterCount > 0 || normalizeSearchQuery(searchQuery).length > 0;

  const vacantUnits = useMemo(
    () => (directory?.units ?? []).filter((unit) => unit.status === "VACANT"),
    [directory],
  );

  const formOpen = addOpen || editTenant != null;
  const closeForm = () => {
    setAddOpen(false);
    setEditTenant(null);
  };

  const clearFilters = () => {
    setFilters(defaultTenancyFilters);
    setMobileQuery("");
  };

  const confirmMoveOut = (endDate: string) => {
    if (dialog?.type !== "move-out") return;
    setDialogBusy(true);
    void api(`/tenancies/${dialog.tenancyId}/move-out`, { method: "POST", body: JSON.stringify({ endDate }) })
      .then(() => {
        toast.success("Move-out recorded. Unit is vacant again.");
        setDialog(null);
        load();
      })
      .catch((caught: unknown) => toastApiError(caught, "Move-out failed."))
      .finally(() => setDialogBusy(false));
  };

  const confirmDeleteTenant = () => {
    if (dialog?.type !== "delete") return;
    setDialogBusy(true);
    void api(`/tenancies/tenants/${dialog.tenantId}`, { method: "DELETE" })
      .then(() => {
        toast.success("Tenant removed.");
        setDialog(null);
        load();
      })
      .catch((caught: unknown) => toastApiError(caught, "Could not remove tenant."))
      .finally(() => setDialogBusy(false));
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar
            mobileSearch={{
              value: mobileQuery,
              onChange: setMobileQuery,
              placeholder: "Search name, phone, property…",
            }}
            resultSummary={
              directory
                ? `${filtered.length} of ${allTenancies.length} tenancies`
                : "Loading…"
            }
            activeFilterCount={filterCount + (normalizeSearchQuery(searchQuery) ? 1 : 0)}
            onClearFilters={clearFilters}
          >
            <FilterSelect
              label="Status"
              value={filters.tenancyStatus}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  tenancyStatus: value as TenancyListFilters["tenancyStatus"],
                }))
              }
              options={[
                { value: "all", label: "All tenancies" },
                { value: "active", label: "Active" },
                { value: "ended", label: "Ended" },
              ]}
            />
            <FilterSelect
              label="Property"
              value={filters.propertyId}
              onChange={(value) => setFilters((current) => ({ ...current, propertyId: value }))}
              options={[
                { value: "all", label: "All properties" },
                ...propertyOptions.map((property) => ({ value: property.id, label: property.name })),
              ]}
            />
            <FilterSelect
              label="Rent"
              value={filters.rentStatus}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  rentStatus: value as TenancyListFilters["rentStatus"],
                }))
              }
              options={[
                { value: "all", label: "Any rent status" },
                { value: "PAID", label: "Paid up" },
                { value: "DUE_SOON", label: "Due soon" },
                { value: "OVERDUE", label: "Overdue" },
                { value: "PART_PAID", label: "Part-paid" },
              ]}
            />
            <FilterSelect
              label="WhatsApp"
              value={filters.whatsapp}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  whatsapp: value as TenancyListFilters["whatsapp"],
                }))
              }
              options={[
                { value: "all", label: "Any WhatsApp" },
                { value: "consent", label: "Consent on" },
                { value: "no_consent", label: "No consent" },
                { value: "opted_out", label: "Opted out" },
              ]}
            />
          </ListToolbar>
        </div>
        <Button
          type="button"
          className="shrink-0"
          onClick={() => {
            setEditTenant(null);
            setAddOpen(true);
          }}
        >
          <IconPlus className="size-4" />
          Add tenant
        </Button>
      </div>

      <Card padding="none">
        <div className="border-b border-border px-5 py-4">
          <CardTitle>Tenancies</CardTitle>
          <CardDescription>Record move-out before removing a tenant. Delete is available after they have left.</CardDescription>
        </div>
        <ul className="divide-y divide-border">
          {filtered.map((tenancy) => {
            const active = !tenancy.endDate;
            const tenant = directory?.tenants.find((item) => item.id === tenancy.tenantId);
            const canDelete = !active;
            const rentBadge = active && tenancy.rentStatus ? rentStatusBadge[tenancy.rentStatus] : null;
            return (
              <li key={tenancy.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{tenancy.tenantName}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide",
                        active ? "bg-teal-light text-primary" : "bg-cream text-muted",
                      )}
                    >
                      {active ? "Active" : `Ended ${displayDate(tenancy.endDate)}`}
                    </span>
                    {rentBadge ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide",
                          rentBadge.className,
                        )}
                      >
                        {rentBadge.label}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted">{tenancy.property} · {tenancy.unit}</span>
                </span>
                <span className="text-right">
                  <span className="block font-display font-black">{formatNaira(tenancy.rentAmountKobo)}</span>
                  <span className="text-xs text-muted">
                    {tenancy.outstandingKobo > 0
                      ? `${formatNaira(tenancy.outstandingKobo)} outstanding`
                      : tenancy.paidThrough
                        ? `Paid through ${displayDate(tenancy.paidThrough)}`
                        : tenancy.cycle}
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {active ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setDialog({ type: "move-out", tenancyId: tenancy.id, tenantName: tenancy.tenantName })
                      }
                    >
                      Move out
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-control p-2 text-muted transition-colors hover:bg-cream hover:text-ink"
                    aria-label={`Edit ${tenancy.tenantName}`}
                    onClick={() =>
                      setEditTenant({
                        id: tenancy.tenantId,
                        fullName: tenant?.fullName ?? tenancy.tenantName,
                        phone: tenant?.phone ?? tenancy.phone,
                        whatsappConsent: tenant?.whatsappConsent ?? tenancy.whatsappConsent,
                      })
                    }
                  >
                    <IconPencil className="size-5" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-control p-2 transition-colors",
                      canDelete ? "text-danger hover:bg-danger/10" : "cursor-not-allowed text-muted/40",
                    )}
                    aria-label={
                      canDelete
                        ? `Remove ${tenancy.tenantName}`
                        : `Cannot remove ${tenancy.tenantName} until move-out is recorded`
                    }
                    title={canDelete ? "Remove tenant record" : "Record move-out first"}
                    disabled={!canDelete}
                    onClick={() => {
                      if (!canDelete) return;
                      setDialog({ type: "delete", tenantId: tenancy.tenantId, tenantName: tenancy.tenantName });
                    }}
                  >
                    <IconTrash className="size-5" />
                  </button>
                </div>
              </li>
            );
          })}
          {directory && allTenancies.length === 0 ? (
            <li className="px-5 py-6 text-sm text-muted">No tenants yet.</li>
          ) : null}
          {directory && allTenancies.length > 0 && filtered.length === 0 && hasListFilters ? (
            <li className="px-5 py-6 text-sm text-muted">No tenancies match your search or filters.</li>
          ) : null}
        </ul>
      </Card>

      <ActionDialog
        open={dialog?.type === "move-out"}
        title={dialog?.type === "move-out" ? `Move out ${dialog.tenantName}` : ""}
        description="The unit will show as vacant. You can remove the tenant record after this."
        field={{ type: "date", label: "Move-out date", required: true }}
        confirmLabel="Record move-out"
        loading={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setDialog(null);
        }}
        onConfirm={confirmMoveOut}
      />

      <ActionDialog
        open={dialog?.type === "delete"}
        title={dialog?.type === "delete" ? `Remove ${dialog.tenantName}?` : ""}
        description="Their past tenancy history stays in the ledger. This cannot be undone."
        confirmLabel="Remove tenant"
        variant="danger"
        loading={dialogBusy}
        onClose={() => {
          if (!dialogBusy) setDialog(null);
        }}
        onConfirm={() => confirmDeleteTenant()}
      />

      <AddTenantOffCanvas
        open={formOpen}
        tenant={editTenant}
        onClose={closeForm}
        onSaved={load}
        vacantUnits={vacantUnits}
      />
    </>
  );
}
