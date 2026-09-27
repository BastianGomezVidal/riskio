import { ApiError } from "@/api/client";

/**
 * Why a query failed, in the three shapes the UI actually renders
 * differently.
 *
 * This replaces `PreloadResult`, which encoded failures as *data* because the
 * old cache returned promises that never rejected. TanStack Query rejects on
 * error and keeps success in `data`, so the same three cases are derived from
 * the error object instead of being threaded through a union.
 */
export type QueryFailure =
  | { kind: "not-found" }
  | { kind: "offline" }
  | { kind: "error"; message: string };

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  );
}

export function classifyQueryError(error: unknown): QueryFailure {
  if (error instanceof ApiError) {
    if (error.status === 404) return { kind: "not-found" };
    return { kind: "error", message: error.message };
  }
  if (isNetworkError(error)) return { kind: "offline" };
  return { kind: "error", message: "Something went wrong." };
}
