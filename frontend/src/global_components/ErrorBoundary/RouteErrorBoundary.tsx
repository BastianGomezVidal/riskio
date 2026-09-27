import type { ReactNode } from "react";
import { Alert, Button } from "antd";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorEmpty } from "../StatusEmpty/StatusEmpty";

interface RouteErrorBoundaryProps {
  children: ReactNode;
  /**
   * Compact alternative to the default `ErrorEmpty`, for surfaces as narrow as
   * the sign-in card where the full empty-state presentation does not fit.
   */
  compact?: boolean;
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
          <Alert
            type="error"
            showIcon
            message={error.message || "Something went wrong."}
            action={
              <Button size="small" onClick={retry}>
                Try again
              </Button>
            }
          />
        ) : (
          <ErrorEmpty message={error.message || undefined} onRetry={retry} />
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}
