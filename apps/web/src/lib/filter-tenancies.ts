import { haystackIncludes, normalizeSearchQuery, phoneDigits } from "@/lib/list-search";

export type TenancyRentStatus = "PAID" | "DUE_SOON" | "OVERDUE" | "PART_PAID";

export type TenancyRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  phone: string;
  whatsappConsent: boolean;
  whatsappOptedOutAt: string | null;
  property: string;
  propertyId: string;
  unit: string;
  rentAmountKobo: number;
  paidThrough: string | null;
  cycle: string;
  endDate: string | null;
  rentStatus: TenancyRentStatus | null;
  outstandingKobo: number;
};

export type TenancyListFilters = {
  tenancyStatus: "all" | "active" | "ended";
  propertyId: string;
  rentStatus: "all" | TenancyRentStatus;
  whatsapp: "all" | "consent" | "no_consent" | "opted_out";
};

export const defaultTenancyFilters: TenancyListFilters = {
  tenancyStatus: "all",
  propertyId: "all",
  rentStatus: "all",
  whatsapp: "all",
};

export function activeTenancyFilterCount(filters: TenancyListFilters): number {
  let count = 0;
  if (filters.tenancyStatus !== "all") count += 1;
  if (filters.propertyId !== "all") count += 1;
  if (filters.rentStatus !== "all") count += 1;
  if (filters.whatsapp !== "all") count += 1;
  return count;
}

function tenancyHaystack(row: TenancyRow): string {
  return [row.tenantName, row.phone, phoneDigits(row.phone), row.property, row.unit, row.cycle].join(" ");
}

export function filterTenancies(
  rows: TenancyRow[],
  searchQuery: string,
  filters: TenancyListFilters,
): TenancyRow[] {
  const needle = normalizeSearchQuery(searchQuery);

  return rows.filter((row) => {
    const active = !row.endDate;
    if (filters.tenancyStatus === "active" && !active) return false;
    if (filters.tenancyStatus === "ended" && active) return false;
    if (filters.propertyId !== "all" && row.propertyId !== filters.propertyId) return false;
    if (filters.rentStatus !== "all") {
      if (!active || row.rentStatus !== filters.rentStatus) return false;
    }
    if (filters.whatsapp === "consent" && (!row.whatsappConsent || row.whatsappOptedOutAt)) return false;
    if (filters.whatsapp === "no_consent" && (row.whatsappConsent || row.whatsappOptedOutAt)) return false;
    if (filters.whatsapp === "opted_out" && !row.whatsappOptedOutAt) return false;
    if (!haystackIncludes(tenancyHaystack(row), needle)) return false;
    return true;
  });
}

export function sortTenancies(rows: TenancyRow[]): TenancyRow[] {
  return [...rows].sort((left, right) => {
    const leftActive = !left.endDate;
    const rightActive = !right.endDate;
    if (leftActive !== rightActive) return leftActive ? -1 : 1;
    return left.tenantName.localeCompare(right.tenantName);
  });
}

export function uniqueTenancyProperties(rows: TenancyRow[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.propertyId, row.property);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
