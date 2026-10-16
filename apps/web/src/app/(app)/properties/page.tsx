"use client";

import { useEffect, useMemo, useState } from "react";
import { AddPropertyOffCanvas, type PropertyFormValues } from "@/components/properties/add-property-off-canvas";
import { ApplicationLinkDialog } from "@/components/properties/application-link-dialog";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { PortalShell, usePortalChrome } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FilterSelect, ListToolbar } from "@/components/ui/list-toolbar";
import { api, toastApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatNaira } from "@rae/domain";
import { cn } from "@/lib/cn";
import {
  activePropertyFilterCount,
  defaultPropertyFilters,
  filterProperties,
  type FilteredProperty,
  type PropertyListFilters,
  type PropertyListItem,
  uniquePropertyStates,
} from "@/lib/filter-properties";
import { normalizeSearchQuery } from "@/lib/list-search";

type PropertyUnit = PropertyListItem["units"][number] & {
  rentRates: { amountKobo: number; cycle: string }[];
};

type Property = Omit<PropertyListItem, "units"> & {
  units: PropertyUnit[];
};

function propertyCanDelete(property: Property): boolean {
  return property.units.length === 0 || property.units.every((unit) => unit.status === "VACANT");
}

export default function PropertiesPage() {
  return (
    <PortalShell title="Properties">
      <PropertiesPageContent />
    </PortalShell>
  );
}

function PropertiesPageContent() {
  const { query: portalQuery } = usePortalChrome();
  const [properties, setProperties] = useState<Property[]>([]);
  const [linkUnitPending, setLinkUnitPending] = useState<string | null>(null);
  const [applicationLink, setApplicationLink] = useState<{
    loading: boolean;
    url?: string;
    property?: string;
    unit?: string;
  } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editProperty, setEditProperty] = useState<PropertyFormValues | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [mobileQuery, setMobileQuery] = useState("");
  const [filters, setFilters] = useState<PropertyListFilters>(defaultPropertyFilters);

  const load = () => {
    void api<Property[]>("/properties")
      .then(setProperties)
      .catch((caught: unknown) => toastApiError(caught, "Something went wrong."));
  };
  useEffect(load, []);

  const searchQuery = portalQuery || mobileQuery;
  const filtered = useMemo(
    () => filterProperties(properties, searchQuery, filters),
    [properties, searchQuery, filters],
  );
  const stateOptions = useMemo(() => uniquePropertyStates(properties), [properties]);
  const filterCount = activePropertyFilterCount(filters);
  const hasListFilters =
    filterCount > 0 || normalizeSearchQuery(searchQuery).length > 0;

  const confirmDeleteProperty = () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    void api(`/properties/${deleteTarget.id}`, { method: "DELETE" })
      .then(() => {
        toast.success("Property deleted.");
        setDeleteTarget(null);
        load();
      })
      .catch((caught: unknown) => toastApiError(caught, "Something went wrong."))
      .finally(() => setDeleteBusy(false));
  };

  const formOpen = addOpen || editProperty != null;
  const closeForm = () => {
    setAddOpen(false);
    setEditProperty(null);
  };

  const clearFilters = () => {
    setFilters(defaultPropertyFilters);
    setMobileQuery("");
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar
            mobileSearch={{
              value: mobileQuery,
              onChange: setMobileQuery,
              placeholder: "Search properties or units…",
            }}
            resultSummary={
              properties.length
                ? `${filtered.length} of ${properties.length} properties`
                : "No properties yet"
            }
            activeFilterCount={filterCount + (normalizeSearchQuery(searchQuery) ? 1 : 0)}
            onClearFilters={clearFilters}
          >
            <FilterSelect
              label="State"
              value={filters.state}
              onChange={(value) => setFilters((current) => ({ ...current, state: value }))}
              options={[
                { value: "all", label: "All states" },
                ...stateOptions.map((state) => ({ value: state, label: state })),
              ]}
            />
            <FilterSelect
              label="Units"
              value={filters.unitStatus}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  unitStatus: value as PropertyListFilters["unitStatus"],
                }))
              }
              options={[
                { value: "all", label: "All units" },
                { value: "VACANT", label: "Vacant only" },
                { value: "OCCUPIED", label: "Occupied only" },
              ]}
            />
            <FilterSelect
              label="Vacancy"
              value={filters.vacantOnly ? "yes" : "all"}
              onChange={(value) => setFilters((current) => ({ ...current, vacantOnly: value === "yes" }))}
              options={[
                { value: "all", label: "Any property" },
                { value: "yes", label: "Has vacant unit" },
              ]}
            />
          </ListToolbar>
        </div>
        <Button
          type="button"
          className="shrink-0"
          onClick={() => {
            setEditProperty(null);
            setAddOpen(true);
          }}
        >
          <IconPlus className="size-4" />
          Add property
        </Button>
      </div>

      <div className="space-y-4">
        {filtered.map((property: FilteredProperty) => {
          const source = properties.find((item) => item.id === property.id);
          if (!source) return null;
          const canDelete = propertyCanDelete(source);
          return (
            <Card key={property.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle>{property.name}</CardTitle>
                  <CardDescription>
                    {property.addressLine}, {property.city}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="rounded-control p-2 text-muted transition-colors hover:bg-cream hover:text-ink"
                    aria-label={`Edit ${property.name}`}
                    onClick={() =>
                      setEditProperty({
                        id: property.id,
                        name: property.name,
                        addressLine: property.addressLine,
                        city: property.city,
                        state: property.state,
                        description: property.description,
                      })
                    }
                  >
                    <IconPencil className="size-5" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-control p-2 transition-colors",
                      canDelete
                        ? "text-danger hover:bg-danger/10"
                        : "cursor-not-allowed text-muted/40",
                    )}
                    aria-label={
                      canDelete
                        ? `Delete ${property.name}`
                        : `Cannot delete ${property.name} while a unit is occupied`
                    }
                    disabled={!canDelete || deleteBusy}
                    title={canDelete ? "Delete property" : "Move out tenants before deleting"}
                    onClick={() => {
                      if (!canDelete) return;
                      setDeleteTarget(source);
                    }}
                  >
                    <IconTrash className="size-5" />
                  </button>
                </div>
              </div>
              {property.description ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{property.description}</p>
              ) : null}
              <ul className="mt-4 divide-y divide-border">
                {property.displayUnits.length === 0 ? (
                  <li className="py-3 text-sm text-muted">
                    {property.units.length === 0
                      ? "No rentable units yet — whole-building or add units later."
                      : "No units match your filters."}
                  </li>
                ) : null}
                {property.displayUnits.map((unit) => {
                  const rentRates = source.units.find((item) => item.id === unit.id)?.rentRates ?? [];
                  return (
                    <li key={unit.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <span>
                        <span className="font-semibold">{unit.label}</span>
                        <span className="ml-2 text-muted">{unit.status === "VACANT" ? "Vacant" : "Occupied"}</span>
                      </span>
                      <span className="font-display font-black">{formatNaira(rentRates[0]?.amountKobo ?? 0)}</span>
                      {unit.status === "VACANT" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          loading={linkUnitPending === unit.id}
                          loadingLabel="Opening…"
                          onClick={() => {
                            setLinkUnitPending(unit.id);
                            setApplicationLink({ loading: true });
                            void api<{ url: string; property: string; unit: string }>(
                              `/properties/units/${unit.id}/application-link`,
                              { method: "POST" },
                            )
                              .then((result) =>
                                setApplicationLink({
                                  loading: false,
                                  url: result.url,
                                  property: result.property,
                                  unit: result.unit,
                                }),
                              )
                              .catch((caught: unknown) => {
                                setApplicationLink(null);
                                toastApiError(caught, "Something went wrong.");
                              })
                              .finally(() => setLinkUnitPending(null));
                          }}
                        >
                          Application link
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
        {properties.length === 0 ? <p className="text-sm text-muted">No properties yet. Add the first one.</p> : null}
        {properties.length > 0 && filtered.length === 0 && hasListFilters ? (
          <p className="text-sm text-muted">No properties match your search or filters.</p>
        ) : null}
      </div>

      <AddPropertyOffCanvas
        open={formOpen}
        property={editProperty}
        onClose={closeForm}
        onSaved={load}
      />

      <ApplicationLinkDialog
        open={applicationLink != null}
        loading={applicationLink?.loading}
        url={applicationLink?.url}
        propertyName={applicationLink?.property}
        unitLabel={applicationLink?.unit}
        onClose={() => setApplicationLink(null)}
      />

      <ActionDialog
        open={deleteTarget != null}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ""}
        description="This property and its vacant units will be removed. This cannot be undone."
        confirmLabel="Delete property"
        variant="danger"
        loading={deleteBusy}
        onClose={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
        onConfirm={() => confirmDeleteProperty()}
      />
    </>
  );
}

