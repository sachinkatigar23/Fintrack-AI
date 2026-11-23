import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

// Login / register pages: already signed-in users go straight to the dashboard
export default function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
