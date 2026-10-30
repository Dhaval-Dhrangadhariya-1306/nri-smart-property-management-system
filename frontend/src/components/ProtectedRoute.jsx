import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="app-loading">Loading EstatePro…</div>;
  const hasToken = Boolean(localStorage.getItem("nri_token"));
  if (!hasToken || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
