import { queryOptions } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { StormsQuery } from "@/domain/storm";

/**
 * Query key factory.
 *
 * Keys are nested arrays so a mutation can invalidate a whole family with
 * `queryClient.invalidateQueries({ queryKey: queryKeys.me.all })` and still
 * target a single entry with `queryKeys.storms.list(query)`.
 */
export const queryKeys = {
  me: {
    all: ["users", "me"] as const,
  },
  dashboard: {
    summary: ["dashboard", "summary"] as const,
  },
  storms: {
    all: ["storms"] as const,
    list: (query: StormsQuery) => ["storms", "list", query] as const,
  },
  stormAdvisory: {
    all: ["storms", "advisory"] as const,
    detail: (atcfId: string, advisoryNumber: string) =>
      ["storms", "advisory", atcfId, advisoryNumber] as const,
  },
};

/**
 * The current profile.
 *
 * Reads the full row rather than rehydrating from JWT claims, which is what
 * the query cache now replaces. Seeded on sign-in so a fresh login does not
 * refetch, and revalidated on window focus like any other server state.
 */
export const meQuery = queryOptions({
  queryKey: queryKeys.me.all,
  queryFn: () => api.me(),
  staleTime: 5 * 60_000,
});

export const dashboardSummaryQuery = queryOptions({
  queryKey: queryKeys.dashboard.summary,
  queryFn: () => api.dashboardSummary(),
  staleTime: 2 * 60_000,
});

export function stormsListQuery(query: StormsQuery) {
  return queryOptions({
    queryKey: queryKeys.storms.list(query),
    queryFn: () => api.storms(query),
    staleTime: 2 * 60_000,
  });
}

/**
 * The account's machine tokens.
 *
 * Short staleTime because revoking a credential is the one thing here a user
 * wants to see take effect immediately, and a stale list showing a token that
 * was just revoked is the kind of wrong that erodes trust in the screen.

/**
 * Advisories are immutable once issued, so this one never goes stale.
 * The previous hand-rolled cache expressed the same idea with
 * `Number.POSITIVE_INFINITY` as the TTL.
 */
export function stormAdvisoryQuery(atcfId: string, advisoryNumber: string) {
  return queryOptions({
    queryKey: queryKeys.stormAdvisory.detail(atcfId, advisoryNumber),
    queryFn: () => api.stormAdvisory(atcfId, advisoryNumber),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
