import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  FileText,
  Filter,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { api, errorMessage, getArray, unwrap } from "../lib/api";

const configs = {
  properties: {
    title: "My Properties",
    eyebrow: "YOUR REAL ESTATE PORTFOLIO",
    description:
      "Manage your homes, track their condition and keep important details in one place.",
    endpoint: "/properties/my",
    create: "/properties",
    button: "Add Property",
    empty: "Your properties will appear here once you add them.",
    fields: [
      ["title", "Property Name"],
      ["propertyType", "Property Type"],
      ["addressLine1", "Address Line 1"],
      ["city", "City"],
      ["state", "State"],
      ["country", "Country"],
      ["postalCode", "Postal Code"],
    ],
    columns: [
      ["title", "Property"],
      ["address.city", "City"],
      ["propertyType", "Type"],
      ["status", "Status"],
    ],
    search: ["title", "address", "city"],
  },

  maintenance: {
    title: "Maintenance",
    eyebrow: "PROPERTY OPERATIONS",
    description:
      "Track service requests, monitor priorities and keep every property in good condition.",
    endpoint: "/maintenance/my",
    create: "/maintenance",
    button: "New Request",
    empty: "No maintenance requests found. Create a request to get started.",
    fields: [
      ["title", "Request Title"],
      ["description", "Description"],
      ["propertyId", "Property ID"],
      ["priority", "Priority"],
    ],
    columns: [
      ["title", "Request"],
      ["status", "Status"],
      ["priority", "Priority"],
      ["createdAt", "Created"],
    ],
    search: ["title", "description", "status", "priority"],
  },

  inspections: {
    title: "Inspections",
    eyebrow: "PROPERTY OPERATIONS",
    description:
      "Review inspection activity and maintain property condition records.",
    endpoint: "/inspections/my",
    button: "New Inspection",
    empty: "Inspection records will appear here when available.",
    fields: [
      ["propertyId", "Property ID"],
      ["notes", "Inspection Notes"],
    ],
    columns: [
      ["property", "Property"],
      ["status", "Status"],
      ["createdAt", "Date"],
    ],
    search: ["property", "status", "notes"],
  },

  monitoring: {
    title: "Security & Monitoring",
    eyebrow: "PROPERTY SAFETY",
    description: "Review monitoring events and incidents that need attention.",
    endpoint: "/monitoring/my",
    create: "/monitoring",
    button: "Log an Event",
    empty: "No monitoring events found.",
    fields: [
      ["propertyId", "Property ID"],
      ["eventType", "Event Type"],
      ["description", "Description"],
      ["severity", "Severity"],
    ],
    columns: [
      ["eventType", "Event"],
      ["description", "Description"],
      ["severity", "Severity"],
      ["createdAt", "Date"],
    ],
    search: ["eventType", "description", "severity", "status"],
  },

  caretakers: {
    title: "Caretakers",
    eyebrow: "PEOPLE & ASSIGNMENTS",
    description: "Coordinate trusted on-ground support for your properties.",
    endpoint: "/caretakers",
    button: "Add Caretaker",
    empty: "Caretaker assignments will appear here when available.",
    fields: [
      ["name", "Caretaker Name"],
      ["email", "Email Address"],
      ["phone", "Phone Number"],
    ],
    columns: [
      ["name", "Caretaker"],
      ["email", "Email"],
      ["status", "Status"],
    ],
    search: ["name", "email", "phone"],
  },

  vendors: {
    title: "Service Partners",
    eyebrow: "YOUR SERVICE NETWORK",
    description:
      "Keep your maintenance vendors and trusted service partners organized.",
    endpoint: "/vendors/my",
    create: "/vendors",
    button: "Add Partner",
    empty: "No service partners found. Add your first vendor to get started.",
    fields: [
      ["name", "Business / Vendor Name"],
      ["category", "Service Category"],
      ["phone", "Phone Number"],
      ["email", "Email Address"],
    ],
    columns: [
      ["name", "Partner"],
      ["category", "Category"],
      ["phone", "Phone"],
      ["status", "Status"],
    ],
    search: ["name", "category", "phone", "email"],
  },

  expenses: {
    title: "Expenses & Finance",
    eyebrow: "FINANCIAL OVERVIEW",
    description:
      "Review property expenses and track spending across your portfolio.",
    endpoint: "/expenses/my",
    create: "/expenses",
    button: "Add Expense",
    empty: "No expense records found.",
    fields: [
      ["title", "Expense Title"],
      ["amount", "Amount (INR)"],
      ["category", "Category"],
      ["propertyId", "Property ID"],
      ["description", "Notes"],
    ],
    columns: [
      ["title", "Expense"],
      ["amount", "Amount"],
      ["category", "Category"],
      ["createdAt", "Date"],
    ],
    search: ["title", "category", "description"],
  },

  documents: {
    title: "Documents",
    eyebrow: "PROPERTY RECORDS",
    description: "Keep property documents organized and monitor expiry dates.",
    endpoint: "/documents/my",
    create: "/documents",
    button: "Add Document",
    empty: "Your documents will appear here when available.",
    fields: [
      ["title", "Document Title"],
      ["documentType", "Document Type"],
      ["propertyId", "Property ID"],
      ["expiryDate", "Expiry Date"],
    ],
    columns: [
      ["title", "Document"],
      ["documentType", "Type"],
      ["expiryDate", "Expiry Date"],
      ["status", "Status"],
    ],
    search: ["title", "documentType", "status"],
  },

  notifications: {
    title: "Notifications",
    eyebrow: "YOUR UPDATES",
    description: "Important property updates and reminders, all in one place.",
    endpoint: "/notifications/my",
    button: "Mark All Read",
    empty: "You are all caught up. No notifications were returned.",
    columns: [
      ["title", "Notification"],
      ["message", "Details"],
      ["createdAt", "Date"],
    ],
    search: ["title", "message", "type"],
  },

  activity: {
    title: "Activity Log",
    eyebrow: "ACCOUNT ACTIVITY",
    description: "Review the activity recorded for your account.",
    endpoint: "/audit-logs/my",
    button: "Refresh Activity",
    empty: "No activity records were returned.",
    columns: [
      ["action", "Activity"],
      ["entityType", "Area"],
      ["createdAt", "Date"],
      ["status", "Status"],
    ],
    search: ["action", "entityType", "description"],
  },

  insights: {
    title: "AI Property Insights",
    eyebrow: "PROPERTY INTELLIGENCE",
    description:
      "Review expense patterns and property insights returned by the API.",
    endpoint: "/expenses/insights",
    button: "Refresh Insights",
    empty: "Insights will appear when the backend returns analysis.",
    columns: [
      ["title", "Insight"],
      ["category", "Category"],
      ["severity", "Priority"],
      ["createdAt", "Generated"],
    ],
    search: ["title", "description", "category"],
  },
};

function human(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return value.name || value.title || value._id || JSON.stringify(value);
  }

  return String(value).replace(/_/g, " ");
}

function formatDate(value) {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return human(value);
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function rowValue(item, key) {
  return (
    key.split(".").reduce((value, part) => value?.[part], item) ??
    item?.[key] ??
    item?.[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)]
  );
}

function statusClass(value) {
  return String(value || "pending")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

export default function ResourcePage({ type }) {
  const cfg = configs[type] || configs.properties;

  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      const response = await api.get(cfg.endpoint);
      setItems(getArray(unwrap(response)));
    } catch (err) {
      setItems([]);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [cfg.endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((item) => {
    const searchableFields = cfg.search || cfg.columns.map(([key]) => key);

    const matchesSearch = searchableFields.some((key) =>
      String(rowValue(item, key) ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()),
    );

    const itemStatus = String(rowValue(item, "status") || "").toLowerCase();

    const matchesStatus =
      statusFilter === "all" || itemStatus === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const statuses = [
    ...new Set(
      items.map((item) => String(item.status || "").trim()).filter(Boolean),
    ),
  ];

  const updateField = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const openCreateModal = () => {
    setForm(type === "maintenance" ? { priority: "Medium" } : {});
    setError("");
    setModal(true);
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!cfg.create) {
      setNotice("Creating records is not available for this section.");
      setModal(false);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = { ...form };

      if (payload.amount !== undefined && payload.amount !== "") {
        payload.amount = Number(payload.amount);
      }

      if (type === "properties") {
        payload.address = {
          addressLine1: payload.addressLine1,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          postalCode: payload.postalCode,
        };

        delete payload.addressLine1;
        delete payload.city;
        delete payload.state;
        delete payload.country;
        delete payload.postalCode;
      }

      await api.post(cfg.create, payload);

      setModal(false);
      setForm({});
      setNotice("Record saved successfully.");

      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const markAll = async () => {
    if (type === "notifications") {
      try {
        await api.patch("/notifications/read-all");
        setNotice("All notifications marked as read.");
        await load();
      } catch (err) {
        setError(errorMessage(err));
      }

      return;
    }

    setRefreshing(true);
    await load();
  };

  const PageIcon =
    type === "insights" ? Sparkles : type === "notifications" ? Bell : FileText;

  return (
    <div className="resource-page">
      <div className="resource-heading">
        <div>
          <div className="eyebrow">
            <PageIcon size={14} />
            {cfg.eyebrow}
          </div>

          <h1>{cfg.title}</h1>

          <p className="page-subtitle">{cfg.description}</p>
        </div>

        <div className="resource-actions">
          {cfg.create && (
            <button className="primary-btn" onClick={openCreateModal}>
              <Plus size={17} />
              {cfg.button}
            </button>
          )}

          <button
            className="secondary-btn"
            onClick={() => {
              setRefreshing(true);
              load();
            }}
            disabled={busy}
          >
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className="success-banner">
          <Check size={16} />
          <span>{notice}</span>

          <button onClick={() => setNotice("")} aria-label="Dismiss notice">
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={17} />

          <div>
            <strong>Couldn't load this section</strong>
            <span>{error}</span>
          </div>

          <button onClick={load}>Try again</button>
        </div>
      )}

      {type === "insights" && (
        <div className="insight-intro panel">
          <div className="insight-spark">
            <Sparkles size={22} />
          </div>

          <div>
            <strong>Explainable property intelligence</strong>
            <p>
              This page connects to the existing expense-insights API.
              Recommendations and confidence scores will be displayed when
              supplied by the backend; no scores are fabricated.
            </p>
          </div>
        </div>
      )}

      {type === "documents" && (
        <div className="notice-card">
          <div className="notice-icon">
            <FileText size={18} />
          </div>

          <div>
            <strong>Document expiry tracking</strong>
            <p>
              Expiry dates are shown when the API includes them. File upload and
              download behavior depends on the document API contract.
            </p>
          </div>
        </div>
      )}

      <div className="resource-stats">
        <div className="resource-stat">
          <span>Records Loaded</span>
          <strong>{busy ? "—" : String(items.length).padStart(2, "0")}</strong>
        </div>

        <div className="resource-stat">
          <span>Current View</span>
          <strong>
            {type === "maintenance"
              ? "Requests"
              : type === "notifications"
                ? "Updates"
                : type === "insights"
                  ? "Intelligence"
                  : "All Records"}
          </strong>
        </div>

        <div className="resource-stat">
          <span>Connection</span>

          <strong className={error ? "stat-offline" : "stat-online"}>
            <i />
            {error ? "Needs Attention" : busy ? "Loading" : "API Ready"}
          </strong>
        </div>
      </div>

      <section className="panel resource-table-panel">
        <div className="table-toolbar">
          <div>
            <h2>
              {type === "notifications"
                ? "All Updates"
                : type === "activity"
                  ? "Recent Activity"
                  : type === "maintenance"
                    ? "Maintenance Requests"
                    : `All ${cfg.title}`}
            </h2>

            <span>
              {filtered.length} {filtered.length === 1 ? "record" : "records"}
            </span>
          </div>

          <div className="table-tools">
            <label className="table-search">
              <Search size={15} />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search records..."
              />
            </label>

            {type === "maintenance" && (
              <label className="table-search">
                <Filter size={15} />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filter maintenance requests by status"
                >
                  <option value="all">All Statuses</option>

                  {statuses.map((status) => (
                    <option key={status} value={status.toLowerCase()}>
                      {human(status)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              className="secondary-btn compact"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              <Filter size={15} />
              Clear
            </button>

            {type === "notifications" && (
              <button className="secondary-btn compact" onClick={markAll}>
                <CheckCheck size={15} />
                Read All
              </button>
            )}
          </div>
        </div>

        {busy ? (
          <div className="resource-loading">
            <LoaderCircle className="spin" size={24} />
            <span>Loading your records...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <PageIcon size={23} />
            </div>

            <h3>
              {search || statusFilter !== "all"
                ? "No Matching Records"
                : "Nothing to Show Just Yet"}
            </h3>

            <p>
              {error
                ? "The API could not be reached. Records will load when the backend is available."
                : search || statusFilter !== "all"
                  ? "Try changing the search term or status filter."
                  : cfg.empty}
            </p>

            {cfg.create && (
              <button className="secondary-btn" onClick={openCreateModal}>
                <Plus size={16} />
                {cfg.button}
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {cfg.columns.map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}

                  <th />
                </tr>
              </thead>

              <tbody>
                {filtered.map((item, index) => (
                  <tr key={item._id || item.id || index}>
                    {cfg.columns.map(([key]) => {
                      const value = rowValue(item, key);

                      const isDate =
                        key.toLowerCase().includes("date") ||
                        key === "createdAt";

                      const isStatus = [
                        "status",
                        "severity",
                        "priority",
                      ].includes(key);

                      return (
                        <td key={key}>
                          {isDate ? (
                            formatDate(value)
                          ) : isStatus ? (
                            <span
                              className={`status-tag ${statusClass(value)}`}
                            >
                              {human(value)}
                            </span>
                          ) : (
                            <span
                              className={
                                ["title", "name", "action"].includes(key)
                                  ? "table-primary"
                                  : ""
                              }
                            >
                              {key === "amount" && value !== undefined
                                ? `₹${Number(value).toLocaleString("en-IN")}`
                                : human(value)}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    <td>
                      <button
                        className="icon-btn"
                        title="View record details"
                        onClick={() =>
                          setNotice(
                            `${cfg.title} record: ${JSON.stringify(
                              item,
                              null,
                              2,
                            )}`,
                          )
                        }
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          <span>
            {error
              ? "Backend connection is unavailable."
              : "Data shown is returned by your connected backend."}
          </span>

          <button
            className="table-refresh"
            onClick={() => {
              setRefreshing(true);
              load();
            }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </section>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModal(false);
            }
          }}
        >
          <form className="modal-card" onSubmit={submit}>
            <div className="modal-heading">
              <div>
                <p className="section-kicker">NEW RECORD</p>
                <h2>{cfg.button}</h2>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setModal(false)}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <p className="modal-description">
              Enter the details below. The fields are based on the current
              frontend configuration and may need to match backend validation.
            </p>

            <div className="modal-fields">
              {(cfg.fields || []).map(([key, label]) => (
                <label key={key}>
                  {label}

                  {key === "priority" ? (
                    <select
                      value={form[key] || "Medium"}
                      onChange={(event) => updateField(key, event.target.value)}
                      required
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  ) : key === "severity" ? (
                    <select
                      value={form[key] || "Medium"}
                      onChange={(event) => updateField(key, event.target.value)}
                      required
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  ) : key === "description" || key === "notes" ? (
                    <textarea
                      value={form[key] || ""}
                      onChange={(event) => updateField(key, event.target.value)}
                      placeholder={`Enter ${label.toLowerCase()}`}
                      rows="3"
                    />
                  ) : (
                    <input
                      type={
                        key === "amount"
                          ? "number"
                          : key === "expiryDate"
                            ? "date"
                            : key === "email"
                              ? "email"
                              : "text"
                      }
                      value={form[key] || ""}
                      onChange={(event) => updateField(key, event.target.value)}
                      placeholder={`Enter ${label.toLowerCase()}`}
                      required={[
                        "name",
                        "title",
                        "amount",
                        "propertyId",
                      ].includes(key)}
                      min={key === "amount" ? "0" : undefined}
                      step={key === "amount" ? "0.01" : undefined}
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>

              <button className="primary-btn" disabled={saving}>
                {saving
                  ? "Saving..."
                  : `Save ${type === "properties" ? "Property" : "Record"}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
