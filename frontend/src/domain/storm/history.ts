import type { StormHistoryItem } from "@/domain/dashboard";

export type HistorySort = "newest" | "oldest" | "name-asc" | "name-desc";

export interface HistoryFilters {
  query: string;
  basins: string[];
  years: number[];
}

export function defaultFilters(): HistoryFilters {
  return { query: "", basins: [], years: [] };
}

export function applyHistoryView(
  items: StormHistoryItem[],
  filters: HistoryFilters,
  sort: HistorySort,
): StormHistoryItem[] {
  const needle = filters.query.trim().toLowerCase();

  const filtered = items.filter(({ storm }) => {
    if (needle) {
      const name = (storm.name ?? "").toLowerCase();
      const id = storm.atcfId.toLowerCase();
      if (!name.includes(needle) && !id.includes(needle)) return false;
    }
    if (filters.basins.length > 0 && !filters.basins.includes(storm.basin)) {
      return false;
    }
    if (filters.years.length > 0) {
      const year = extractYear(storm.atcfId);
      if (year == null || !filters.years.includes(year)) return false;
    }
    return true;
  });

  return [...filtered].sort(comparator(sort));
}

function comparator(sort: HistorySort) {
  return (a: StormHistoryItem, b: StormHistoryItem): number => {
    switch (sort) {
      case "newest":
        return dateValue(b.lastSeenInFeedAt) - dateValue(a.lastSeenInFeedAt);
      case "oldest":
        return dateValue(a.lastSeenInFeedAt) - dateValue(b.lastSeenInFeedAt);
      case "name-asc":
        return displayName(a).localeCompare(displayName(b));
      case "name-desc":
        return displayName(b).localeCompare(displayName(a));
    }
  };
}

function displayName(s: StormHistoryItem): string {
  return (s.storm.name ?? s.storm.atcfId).toLowerCase();
}

function dateValue(d: string | null): number {
  return d ? new Date(d).getTime() : 0;
}

export function extractYear(atcfId: string): number | null {
  const match = atcfId.match(/(\d{4})$/);
  return match ? Number(match[1]) : null;
}

export function availableYears(items: StormHistoryItem[]): number[] {
  const set = new Set<number>();
  for (const { storm } of items) {
    const y = extractYear(storm.atcfId);
    if (y != null) set.add(y);
  }
  return [...set].sort((a, b) => b - a);
}

export function availableBasins(items: StormHistoryItem[]): string[] {
  const set = new Set<string>();
  for (const { storm } of items) {
    if (storm.basin) set.add(storm.basin);
  }
  return [...set].sort();
}
