import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Location } from "react-router-dom";
import { useSession } from "@/components/providers/session-context";

/**
 * Guards routes that require authentication.
 *
 * When the user is not signed in, redirects to the login page and stores
 * the current location in `state.from`. The login flow reads that state
 * and returns the user to the page they originally tried to visit.
 *
 * `replace` prevents the login page from being added to the history stack
 * — otherwise pressing back from the login would loop through the guard.
 */
export function ProtectedRoute() {
  const { user } = useSession();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/**
 * Guards routes that must be inaccessible once the user is signed in.
 *
 * When a signed-in user lands on a public route (login, signup, forgot),
 * redirects to `state.from` if present (set by ProtectedRoute on the
 * prior redirect), otherwise to the dashboard.
 *
 * This is what makes deep links work end-to-end: a signed-out user who
 * opens /storms/EP122026 is sent to login with state.from set; after
 * signing in, this guard sends them back to /storms/EP122026.
 */
export function PublicOnlyRoute() {
  const { user } = useSession();
  const location = useLocation();

  if (user) {
    const from = (location.state as { from?: Location } | null)?.from;
    const target = from
      ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
      : "/dashboard";
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
