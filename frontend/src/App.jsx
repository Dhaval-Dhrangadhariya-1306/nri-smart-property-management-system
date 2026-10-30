import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ResourcePage from "./pages/ResourcePage";
import "./styles.css";

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading">Loading EstatePro…</div>;
  const hasToken = Boolean(localStorage.getItem("nri_token"));
  return <Navigate to={hasToken && user ? "/dashboard" : "/login"} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/properties"
            element={<ResourcePage type="properties" />}
          />
          <Route
            path="/maintenance"
            element={<ResourcePage type="maintenance" />}
          />
          <Route
            path="/inspections"
            element={<ResourcePage type="inspections" />}
          />
          <Route
            path="/monitoring"
            element={<ResourcePage type="monitoring" />}
          />
          <Route
            path="/caretakers"
            element={<ResourcePage type="caretakers" />}
          />
          <Route path="/vendors" element={<ResourcePage type="vendors" />} />
          <Route path="/expenses" element={<ResourcePage type="expenses" />} />
          <Route
            path="/documents"
            element={<ResourcePage type="documents" />}
          />
          <Route path="/insights" element={<ResourcePage type="insights" />} />
          <Route
            path="/notifications"
            element={<ResourcePage type="notifications" />}
          />
          <Route path="/activity" element={<ResourcePage type="activity" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
