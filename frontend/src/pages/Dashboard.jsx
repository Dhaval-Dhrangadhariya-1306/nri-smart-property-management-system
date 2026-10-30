import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Building2,
  HeartPulse,
  RefreshCw,
  Wallet,
  Wrench,
} from "lucide-react";
import { api, errorMessage, getArray, unwrap } from "../lib/api";

const cards = [
  {
    key: "properties",
    title: "Total Properties",
    description: "Properties under management",
    icon: Building2,
    tone: "blue",
  },
  {
    key: "health",
    title: "Property Health",
    description: "Overall property condition",
    icon: HeartPulse,
    tone: "green",
  },
  {
    key: "maintenance",
    title: "Pending Maintenance",
    description: "Requests awaiting action",
    icon: Wrench,
    tone: "amber",
  },
  {
    key: "expenses",
    title: "Total Expenses",
    description: "Expense overview",
    icon: Wallet,
    tone: "violet",
  },
];

function firstValue(source, keys, fallback = null) {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value ?? "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
}

function dateLabel(value) {
  if (!value) return "Recently updated";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function RecordList({ items, kind }) {
  if (!items.length) {
    const details = {
      properties: [
        Building2,
        "No property data available",
        "Your property records will appear here when the API returns them.",
      ],
      notifications: [
        Bell,
        "You’re all caught up",
        "Recent notifications will appear here when available.",
      ],
      maintenance: [
        Wrench,
        "No maintenance requests available",
        "Requests and their current statuses will appear here.",
      ],
    }[kind];
    return (
      <EmptyState icon={details[0]} title={details[1]} text={details[2]} />
    );
  }

  return (
    <div className="dashboard-list">
      {items.slice(0, 5).map((item, index) => {
        const title =
          kind === "properties"
            ? firstValue(
                item,
                ["title", "name", "propertyName"],
                `Property ${index + 1}`,
              )
            : kind === "notifications"
              ? firstValue(
                  item,
                  ["title", "message", "description"],
                  "Notification",
                )
              : firstValue(
                  item,
                  ["title", "description", "issue"],
                  `Maintenance request ${index + 1}`,
                );
        const subtitle =
          kind === "properties"
            ? firstValue(
                item,
                ["address.city", "city", "address", "location"],
                "Address not provided",
              )
            : kind === "notifications"
              ? dateLabel(firstValue(item, ["createdAt", "date"]))
              : firstValue(
                  item,
                  ["propertyName", "property.name", "category", "priority"],
                  "Maintenance request",
                );
        const status = firstValue(item, ["status"], "");
        return (
          <div
            className="dashboard-list-item"
            key={item._id || item.id || `${kind}-${index}`}
          >
            <span className="dashboard-list-icon">
              {kind === "properties" ? (
                <Building2 size={18} />
              ) : kind === "notifications" ? (
                <Bell size={18} />
              ) : (
                <Wrench size={18} />
              )}
            </span>
            <div className="dashboard-list-copy">
              <strong>{String(title)}</strong>
              <span>{String(subtitle)}</span>
            </div>
            {status && (
              <span
                className={`status-tag ${String(status)
                  .toLowerCase()
                  .replace(/[_\s]+/g, "-")}`}
              >
                {String(status).replace(/[_-]/g, " ")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/dashboard/owner");
      setData(unwrap(response));
      setUpdatedAt(new Date());
    } catch (err) {
      setError(errorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const properties = getArray(
    firstValue(
      data,
      [
        "properties",
        "data.properties",
        "recentProperties",
        "data.recentProperties",
      ],
      [],
    ),
  );
  const notifications = getArray(
    firstValue(
      data,
      [
        "notifications",
        "data.notifications",
        "recentNotifications",
        "data.recentNotifications",
      ],
      [],
    ),
  );
  const maintenance = getArray(
    firstValue(
      data,
      [
        "maintenance",
        "data.maintenance",
        "maintenanceRequests",
        "data.maintenanceRequests",
        "recentMaintenance",
      ],
      [],
    ),
  );
  const propertyCount = firstValue(
    data,
    ["totalProperties", "stats.totalProperties", "summary.totalProperties"],
    properties.length || null,
  );
  const health = firstValue(data, [
    "propertyHealth",
    "stats.propertyHealth",
    "summary.propertyHealth",
    "healthScore",
  ]);
  const pending = firstValue(data, [
    "pendingMaintenance",
    "stats.pendingMaintenance",
    "summary.pendingMaintenance",
  ]);
  const expenses = firstValue(data, [
    "totalExpenses",
    "stats.totalExpenses",
    "summary.totalExpenses",
  ]);
  const values = {
    properties: propertyCount,
    health:
      health == null
        ? null
        : typeof health === "number" && health <= 100
          ? `${health}%`
          : health,
    maintenance: pending,
    expenses: expenses == null ? null : money(expenses),
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">ESTATEPRO / OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back! Here’s an overview of your property portfolio.
          </p>
        </div>
        <button
          className="dashboard-refresh"
          type="button"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} />{" "}
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <Activity size={17} />
          <div>
            <strong>Dashboard data unavailable</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={refresh}>
            Retry
          </button>
        </div>
      )}
      <section className="dashboard-stats">
        {cards.map(({ key, title, description, icon: Icon, tone }) => (
          <article className="stat-card" key={key}>
            <div className="stat-card-top">
              <span className={`stat-icon ${tone}`}>
                <Icon size={21} />
              </span>
              <span className="stat-indicator">
                {loading ? "Loading" : data ? "Live data" : "Overview"}
              </span>
            </div>
            <h3>{title}</h3>
            <p className="stat-value">
              {loading ? "…" : values[key] == null ? "—" : values[key]}
            </p>
            <p className="stat-description">{description}</p>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Property Overview</h2>
              <p>Your managed properties and their details.</p>
            </div>
            <span className="panel-icon">
              <Building2 size={20} />
            </span>
          </div>
          {loading ? (
            <EmptyState
              icon={Building2}
              title="Loading properties"
              text="Retrieving your property information."
            />
          ) : (
            <RecordList items={properties} kind="properties" />
          )}
        </article>
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Notifications</h2>
              <p>Important updates and alerts.</p>
            </div>
            <span className="panel-icon">
              <Bell size={20} />
            </span>
          </div>
          {loading ? (
            <EmptyState
              icon={Bell}
              title="Loading notifications"
              text="Checking for recent updates."
            />
          ) : (
            <RecordList items={notifications} kind="notifications" />
          )}
        </article>
        <article className="dashboard-panel dashboard-wide">
          <div className="panel-heading">
            <div>
              <h2>Maintenance Activity</h2>
              <p>Track requests and their progress.</p>
            </div>
            <span className="panel-icon">
              <Wrench size={20} />
            </span>
          </div>
          {loading ? (
            <EmptyState
              icon={Wrench}
              title="Loading maintenance"
              text="Retrieving maintenance activity."
            />
          ) : (
            <RecordList items={maintenance} kind="maintenance" />
          )}
        </article>
      </section>
      <div className="dashboard-last-updated">
        {updatedAt
          ? `Last refreshed ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
          : "Dashboard overview"}
      </div>
    </div>
  );
}
