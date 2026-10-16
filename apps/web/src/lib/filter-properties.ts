import { haystackIncludes, normalizeSearchQuery } from "@/lib/list-search";

export type PropertyUnit = {
  id: string;
  label: string;
  status: string;
  type: string;
};

export type PropertyListItem = {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  description: string | null;
  units: PropertyUnit[];
};

export type PropertyListFilters = {
  state: string;
  unitStatus: "all" | "VACANT" | "OCCUPIED";
  vacantOnly: boolean;
};

export const defaultPropertyFilters: PropertyListFilters = {
  state: "all",
  unitStatus: "all",
  vacantOnly: false,
};

function propertyHaystack(property: PropertyListItem): string {
  return [property.name, property.addressLine, property.city, property.state, property.description ?? ""].join(" ");
}

function unitHaystack(unit: PropertyUnit): string {
  return [unit.label, unit.type, unit.status === "VACANT" ? "vacant" : "occupied"].join(" ");
}

export function activePropertyFilterCount(filters: PropertyListFilters): number {
  let count = 0;
  if (filters.state !== "all") count += 1;
  if (filters.unitStatus !== "all") count += 1;
  if (filters.vacantOnly) count += 1;
  return count;
}

export type FilteredProperty = PropertyListItem & { displayUnits: PropertyUnit[] };

export function filterProperties(
  properties: PropertyListItem[],
  searchQuery: string,
  filters: PropertyListFilters,
): FilteredProperty[] {
  const needle = normalizeSearchQuery(searchQuery);
  const result: FilteredProperty[] = [];

  for (const property of properties) {
    if (filters.state !== "all" && property.state !== filters.state) continue;
    if (filters.vacantOnly && !property.units.some((unit) => unit.status === "VACANT")) continue;

    const propertyMatches = haystackIncludes(propertyHaystack(property), needle);
    let displayUnits = property.units;

    if (filters.unitStatus !== "all") {
      displayUnits = displayUnits.filter((unit) => unit.status === filters.unitStatus);
    }
    if (filters.vacantOnly) {
      displayUnits = displayUnits.filter((unit) => unit.status === "VACANT");
    }

    if (needle) {
      if (!propertyMatches) {
        displayUnits = displayUnits.filter((unit) => haystackIncludes(unitHaystack(unit), needle));
        if (displayUnits.length === 0) continue;
      }
    }

    if (filters.unitStatus !== "all" && displayUnits.length === 0) continue;

    result.push({ ...property, displayUnits });
  }

  return result;
}

export function uniquePropertyStates(properties: PropertyListItem[]): string[] {
  const states = new Set(properties.map((property) => property.state).filter(Boolean));
  return [...states].sort((left, right) => left.localeCompare(right));
}
