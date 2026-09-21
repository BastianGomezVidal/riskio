import { ApiError } from "@/api/client";

export type PreloadResult<T> =
  | { status: "ok"; data: T }
  | { status: "not-found" }
  | { status: "offline" }
  | { status: "error"; message: string };

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  );
}

export async function toPreloadResult<T>(
  fetch: () => Promise<T>,
): Promise<PreloadResult<T>> {
  try {
    const data = await fetch();
    return { status: "ok", data };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) return { status: "not-found" };
      return { status: "error", message: err.message };
    }
    if (isNetworkError(err)) {
      return { status: "offline" };
    }
    return { status: "error", message: "Something went wrong." };
  }
}
