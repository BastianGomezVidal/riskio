import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../../auth/session-context";

export function PublicOnlyRoute() {
  const { user } = useSession();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
