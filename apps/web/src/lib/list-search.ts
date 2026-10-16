export function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function haystackIncludes(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle);
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}
