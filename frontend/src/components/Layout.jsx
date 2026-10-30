import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Users,
  Wrench,
  X,
  MapPinned,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
const groups = [
  {
    label: "WORKSPACE",
    links: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
      {
        to: "/properties",
        label: "My properties",
        icon: Building2,
        badge: "04",
      },
      { to: "/maintenance", label: "Maintenance", icon: Wrench },
      { to: "/inspections", label: "Inspections", icon: ClipboardCheck },
      { to: "/monitoring", label: "Security & monitoring", icon: ShieldAlert },
    ],
  },
  {
    label: "MANAGE",
    links: [
      { to: "/caretakers", label: "Caretakers", icon: Users },
      { to: "/vendors", label: "Service partners", icon: MapPinned },
      { to: "/expenses", label: "Expenses & finance", icon: CreditCard },
      { to: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "INTELLIGENCE",
    links: [
      { to: "/insights", label: "AI insights", icon: Sparkles, accent: true },
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/activity", label: "Activity log", icon: Activity },
    ],
  },
];
const titles = {
  "/dashboard": "Overview",
  "/properties": "My properties",
  "/maintenance": "Maintenance",
  "/inspections": "Inspections",
  "/monitoring": "Security & monitoring",
  "/caretakers": "Caretakers",
  "/vendors": "Service partners",
  "/expenses": "Expenses & finance",
  "/documents": "Documents",
  "/insights": "AI property insights",
  "/notifications": "Notifications",
  "/activity": "Activity log",
};
export default function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("nri_theme") === "dark",
  );
  const title = useMemo(
    () => titles[loc.pathname] || "Property workspace",
    [loc.pathname],
  );
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("nri_theme", next ? "dark" : "light");
    document.documentElement.dataset.theme = next ? "dark" : "light";
  };
  return (
    <div className="app-shell" data-theme={dark ? "dark" : "light"}>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Building2 size={22} />
          </div>
          <div>
            <strong>
              Estate<span>Pro</span>
            </strong>
            <small>PROPERTY INTELLIGENCE</small>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">NP</div>
          <div className="workspace-copy">
            <strong>My portfolio</strong>
            <span>Personal workspace</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav className="side-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.links.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/dashboard"}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active" : ""} ${item.accent ? "nav-accent" : ""}`
                    }
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <small className="nav-badge">{item.badge}</small>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <CircleHelp size={17} />
            </div>
            <strong>Need a hand?</strong>
            <p>Our property team is here to help.</p>
            <button
              onClick={() =>
                (window.location.href = "mailto:support@example.com")
              }
            >
              Contact support <span>↗</span>
            </button>
          </div>
          <button className="nav-link" onClick={toggleTheme}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            <span>{dark ? "Light appearance" : "Dark appearance"}</span>
          </button>
          <button className="nav-link" onClick={logout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumbs">
              <span>Workspace</span>
              <span className="crumb-slash">/</span>
              <strong>{title}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                placeholder="Search anything..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") window.location.href = "/properties";
                }}
              />
              <kbd>⌘ K</kbd>
            </label>
            <NavLink
              to="/notifications"
              className="top-icon"
              aria-label="Notifications"
            >
              <Bell size={19} />
              <i />
            </NavLink>
            <div className="top-divider" />
            <button className="profile-button" onClick={() => {}}>
              <div className="profile-avatar">
                {(user?.name || user?.fullName || "NO")
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="profile-copy">
                <strong>
                  {user?.name || user?.fullName || "Property Owner"}
                </strong>
                <span>{(user?.role || "NRI_OWNER").replace("_", " ")}</span>
              </div>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
        <footer className="app-footer">
          <span>© 2026 EstatePro</span>
          <span>Built for peace of mind, wherever you are.</span>
          <span className="status-dot">
            <i /> System ready
          </span>
        </footer>
      </main>
    </div>
  );
}
