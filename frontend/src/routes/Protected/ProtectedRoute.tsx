import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../../auth/session-context";

export function ProtectedRoute() {
  const { user } = useSession();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
