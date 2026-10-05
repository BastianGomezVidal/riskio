import type { ReactNode } from "react";
import { lazy, Suspense } from "react";
import { ActionButton } from "@/components/shared/controls";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Loaded on demand, and only for the full-size variant.
 *
 * `ErrorEmpty` renders antd's `Empty`, and this file is imported by
 * `AuthLayout`, which is public. A static import here put antd in the entry
 * bundle and the sign-in page downloaded 182 KiB for a fallback it never showed.
 * The compact variant below is the one the public layout actually uses, and it
 * no longer needs antd; the full-size variant only renders inside `AppLayout`,
 * behind authentication, so pulling its chunk then costs a signed-in user
 * nothing they were not already paying.
 */
const ErrorEmpty = lazy(() =>
  import("../StatusEmpty/StatusEmpty").then((m) => ({ default: m.ErrorEmpty })),
);

interface RouteErrorBoundaryProps {
  children: ReactNode;
  /**
   * Compact alternative to the default `ErrorEmpty`, for surfaces as narrow as
   * the sign-in card where the full empty-state presentation does not fit.
   */
  compact?: boolean;
}

/**
 * The compact fallback, rebuilt without antd.
 *
 * This is the markup an antd `Alert type="error"` produced here: a bordered,
 * tinted box, the message, and the retry action on the right. `role="alert"` is
 * antd's own live-region behaviour and is kept on purpose, so an error that
 * appears is still announced rather than just appearing.
 */
function CompactError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-200/25 px-3 py-2"
    >
      <span className="text-sm text-red-600">{message}</span>
      <ActionButton onClick={onRetry}>Try again</ActionButton>
    </div>
  );
}

/**
 * Error Boundary scoped to a single route.
 *
 * Mounted inside the layout rather than at the root, so a render error in a
 * page takes down only that page: the header, the footer and the
 * session-expiry modal stay mounted, and the user keeps a way out.
 *
 * Fetch failures do not arrive here. `classifyQueryError` turns 404, offline
 * and API errors into the three states the pages render, so what reaches this
 * boundary is a genuine render fault — a thrown error or a rejected promise
 * surfaced through `use()` — with no cache to invalidate on retry.
 */
export function RouteErrorBoundary({
  children,
  compact = false,
}: RouteErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, retry) =>
        compact ? (
          <CompactError
            message={error.message || "Something went wrong."}
            onRetry={retry}
          />
        ) : (
          <Suspense fallback={null}>
            <ErrorEmpty message={error.message || undefined} onRetry={retry} />
          </Suspense>
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}
