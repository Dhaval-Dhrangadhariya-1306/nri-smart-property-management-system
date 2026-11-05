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
import { useAuth } from "../context/AuthContext";

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
      ["propertyId", "Property"],
      ["title", "Request Title"],
      ["category", "Category"],
      ["priority", "Priority"],
      ["description", "Description"],
      ["notes", "Additional Notes"],
    ],
    columns: [
      ["title", "Request"],
      ["category", "Category"],
      ["status", "Status"],
      ["priority", "Priority"],
      ["createdAt", "Created"],
    ],
    search: ["title", "description", "status", "priority", "category"],
  },

  inspections: {
    title: "Inspections",
    eyebrow: "PROPERTY OPERATIONS",
    description:
      "Review inspection activity and maintain property condition records.",
    endpoint: "/inspections/my",
    create: "/inspections",
    button: "New Inspection",
    empty: "Inspection records will appear here when available.",
    fields: [
      ["propertyId", "Property ID"],
      ["notes", "Inspection Notes"],
    ],
    columns: [
      ["property", "Property"],
      ["overallCondition", "Condition"],
      ["status", "Status"],
      ["createdAt", "Date"],
    ],
    search: ["property", "status", "notes", "overallCondition"],
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
      ["title", "Event Title"],
      ["eventType", "Event Type"],
      ["description", "Description"],
      ["severity", "Severity"],
    ],
    columns: [
      ["title", "Event Title"],
      ["eventType", "Event Type"],
      ["severity", "Severity"],
      ["status", "Status"],
      ["createdAt", "Date"],
    ],
    search: ["title", "eventType", "description", "severity", "status"],
  },

  caretakers: {
    title: "Caretakers",
    eyebrow: "PEOPLE & ASSIGNMENTS",
    description: "Coordinate trusted on-ground support for your properties.",
    endpoint: "/caretakers",
    create: "/caretakers/create",
    button: "Add Caretaker",
    empty: "Caretakers will appear here when available.",
    fields: [
      ["name", "Caretaker Name"],
      ["email", "Email Address"],
      ["phone", "Phone Number"],
      ["password", "Initial Password"],
    ],
    columns: [
      ["name", "Caretaker"],
      ["email", "Email"],
      ["phone", "Phone"],
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
    create: "/documents/upload",
    button: "Add Document",
    empty: "Your documents will appear here when available.",
    fields: [
      ["title", "Document Title"],
      ["category", "Document Category"],
      ["propertyId", "Property ID"],
      ["expiryDate", "Expiry Date"],
    ],
    columns: [
      ["title", "Document"],
      ["category", "Type"],
      ["expiryDate", "Expiry Date"],
      ["status", "Status"],
    ],
    search: ["title", "category", "documentType", "status"],
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

const CARETAKER_RESTRICTED_SECTIONS = [
  "caretakers",
  "vendors",
  "expenses",
  "documents",
  "monitoring",
  "activity",
  "insights",
];

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

function extractAssignedProperties(result) {
  const assignments = Array.isArray(result?.assignments)
    ? result.assignments
    : getArray(result);

  return assignments
    .map((assignment) => {
      const property = assignment?.property || assignment?.propertyId;

      if (property && typeof property === "object") {
        return property;
      }

      return null;
    })
    .filter(Boolean);
}

export default function ResourcePage({ type }) {
  const { user } = useAuth();

  const role = String(user?.role || "").toUpperCase();
  const isCaretaker = role === "CARETAKER";
  const isOwnerOrAdmin = ["NRI_OWNER", "ADMIN"].includes(role);

  const cfg = configs[type] || configs.properties;

  const accessDenied =
    isCaretaker && CARETAKER_RESTRICTED_SECTIONS.includes(type);

  const endpoint =
    isCaretaker && type === "properties"
      ? "/caretakers/my-properties"
      : isCaretaker && type === "maintenance"
        ? "/maintenance/caretaker/my"
        : cfg.endpoint;

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
  const [availableProperties, setAvailableProperties] = useState([]);

  const canCreate =
    Boolean(cfg.create) &&
    (isOwnerOrAdmin ||
      (isCaretaker && ["maintenance", "inspections"].includes(type)));

  const loadAvailableProperties = useCallback(async () => {
    try {
      if (isCaretaker) {
        const response = await api.get("/caretakers/my-properties");
        const result = unwrap(response);
        const list = extractAssignedProperties(result);
        setAvailableProperties(list);
      } else if (isOwnerOrAdmin) {
        const response = await api.get("/properties/my");
        const result = unwrap(response);
        const list = getArray(result).filter(
          (p) => p && p._id && p.status !== "ARCHIVED" && p.isActive !== false,
        );
        setAvailableProperties(list);
      }
    } catch {
      setAvailableProperties([]);
    }
  }, [isCaretaker, isOwnerOrAdmin]);

  useEffect(() => {
    if (
      canCreate &&
      ["maintenance", "inspections", "expenses", "documents", "monitoring"].includes(type)
    ) {
      loadAvailableProperties();
    }
  }, [canCreate, loadAvailableProperties, type]);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      if (accessDenied) {
        setItems([]);
        setError(
          "This section is restricted to property owners and administrators.",
        );
        return;
      }

      const response = await api.get(endpoint);
      const result = unwrap(response);

      if (isCaretaker && type === "properties") {
        setItems(extractAssignedProperties(result));
      } else {
        setItems(getArray(result));
      }
    } catch (err) {
      setItems([]);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, [accessDenied, endpoint, isCaretaker, type]);

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
    if (!canCreate) {
      setError("You do not have permission to create records in this section.");
      return;
    }

    if (
      ["maintenance", "inspections", "expenses", "documents", "monitoring"].includes(type) &&
      availableProperties.length === 0
    ) {
      loadAvailableProperties();
    }

    let initial = {};

    if (type === "maintenance") {
      initial = {
        propertyId: availableProperties.length === 1 ? (availableProperties[0]._id || availableProperties[0].id) : "",
        priority: "MEDIUM",
        category: "PLUMBING",
        title: "",
        description: "",
        notes: "",
      };
    } else if (type === "properties") {
      initial = {
        propertyType: "APARTMENT",
        country: "India",
      };
    } else if (type === "inspections") {
      initial = {
        overallCondition: "GOOD",
        securityStatus: "NORMAL",
        electricalStatus: "NORMAL",
        plumbingStatus: "NORMAL",
        cleanliness: "GOOD",
      };
    } else if (type === "monitoring") {
      initial = {
        severity: "MEDIUM",
        eventType: "SECURITY_INCIDENT",
      };
    } else if (type === "vendors") {
      initial = { category: "PLUMBING" };
    } else if (type === "expenses") {
      initial = { category: "MAINTENANCE" };
    } else if (type === "documents") {
      initial = { category: "PROPERTY_DEED" };
    }

    setForm(initial);
    setError("");
    setNotice("");
    setModal(true);
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!canCreate || !cfg.create) {
      setError("You do not have permission to create records in this section.");
      setModal(false);
      return;
    }

    setSaving(true);
    setError("");

    try {
      let payload;

      if (type === "maintenance") {
        const propertyId = String(form.propertyId || "").trim();
        if (!propertyId) {
          throw new Error("Please select a property.");
        }
        if (!form.title || !String(form.title).trim()) {
          throw new Error("Please enter a title.");
        }
        if (!form.description || !String(form.description).trim()) {
          throw new Error("Please enter a description.");
        }

        payload = {
          propertyId,
          title: String(form.title).trim(),
          description: String(form.description).trim(),
          category: String(form.category || "PLUMBING").toUpperCase(),
          priority: String(form.priority || "MEDIUM").toUpperCase(),
        };

        if (form.notes && String(form.notes).trim()) {
          payload.notes = String(form.notes).trim();
        }

        // Strictly do not send untrusted fields
        delete payload.reportedBy;
        delete payload.assignedCaretaker;
        delete payload.assignedVendor;
        delete payload.status;
      } else {
        payload = { ...form };

        if (payload.amount !== undefined && payload.amount !== "") {
          payload.amount = Number(payload.amount);
        }

        for (const key of [
          "propertyType",
          "priority",
          "severity",
          "category",
          "eventType",
          "overallCondition",
          "securityStatus",
          "electricalStatus",
          "plumbingStatus",
          "cleanliness",
        ]) {
          if (payload[key]) {
            payload[key] = String(payload[key]).toUpperCase();
          }
        }

        if (type === "properties") {
          payload.address = {
            addressLine1: payload.addressLine1,
            city: payload.city,
            state: payload.state,
            country: payload.country || "India",
            postalCode: payload.postalCode,
          };

          delete payload.addressLine1;
          delete payload.city;
          delete payload.state;
          delete payload.country;
          delete payload.postalCode;
        }

        if (type === "documents") {
          payload.fileUrl =
            payload.fileUrl ||
            "https://storage.estatepro.local/docs/" + Date.now();

          payload.originalFileName =
            payload.originalFileName || (payload.title || "document") + ".pdf";

          payload.fileType = payload.fileType || "application/pdf";

          payload.fileSize = payload.fileSize ? Number(payload.fileSize) : 102400;

          payload.category = (
            payload.category ||
            payload.documentType ||
            "OTHER"
          ).toUpperCase();
        }
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
          {canCreate && (
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
            <strong>
              {accessDenied
                ? "Access restricted"
                : "Couldn't load this section"}
            </strong>
            <span>{error}</span>
          </div>

          {!accessDenied && <button onClick={load}>Try again</button>}
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
              {accessDenied
                ? "Access Restricted"
                : search || statusFilter !== "all"
                  ? "No Matching Records"
                  : "Nothing to Show Just Yet"}
            </h3>

            <p>
              {accessDenied
                ? "This resource is available to property owners and administrators."
                : error
                  ? "The API could not return records. Check the error message above and verify the backend endpoint."
                  : search || statusFilter !== "all"
                    ? "Try changing the search term or status filter."
                    : cfg.empty}
            </p>

            {canCreate && (
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
              ? "Check the error message above."
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
              Enter the details below. Fields must satisfy the validation rules
              of the backend API.
            </p>

            {error && (
              <div className="error-banner" style={{ margin: "12px 0" }}>
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}

            <div className="modal-fields">
              {(cfg.fields || []).map(([key, label]) => (
                <label key={key}>
                  {label}

                  {key === "propertyId" ? (
                    availableProperties.length > 0 || isCaretaker || type === "maintenance" ? (
                      <select
                        value={form[key] || ""}
                        onChange={(event) => updateField(key, event.target.value)}
                        required
                      >
                        <option value="">
                          {availableProperties.length === 0
                            ? isCaretaker
                              ? "No properties assigned to you"
                              : "No active properties found"
                            : "Select a property..."}
                        </option>
                        {availableProperties.map((p) => {
                          const pid = String(p._id || p.id);
                          const title = p.title || p.name || pid;
                          const city = p.address?.city ? ` (${p.address.city})` : "";
                          return (
                            <option key={pid} value={pid}>
                              {title}{city}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form[key] || ""}
                        onChange={(event) => updateField(key, event.target.value)}
                        placeholder="Enter property ID"
                        required
                      />
                    )
                  ) : key === "priority" ? (
                    <select
                      value={form[key] || "MEDIUM"}
                      onChange={(event) => updateField(key, event.target.value)}
                      required
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  ) : key === "severity" ? (
                    <select
                      value={form[key] || "MEDIUM"}
                      onChange={(event) => updateField(key, event.target.value)}
                      required
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                      <option value="INFO">Info</option>
                    </select>
                  ) : key === "propertyType" ? (
                    <select
                      value={form[key] || "APARTMENT"}
                      onChange={(event) => updateField(key, event.target.value)}
                      required
                    >
                      <option value="APARTMENT">Apartment</option>
                      <option value="HOUSE">House</option>
                      <option value="VILLA">Villa</option>
                      <option value="PLOT">Plot</option>
                      <option value="COMMERCIAL">Commercial</option>
                      <option value="OFFICE">Office</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : key === "overallCondition" ? (
                    <select
                      value={form[key] || "GOOD"}
                      onChange={(event) => updateField(key, event.target.value)}
                      required
                    >
                      <option value="EXCELLENT">Excellent</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                      <option value="POOR">Poor</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  ) : [
                      "securityStatus",
                      "electricalStatus",
                      "plumbingStatus",
                      "cleanliness",
                    ].includes(key) ? (
                    <select
                      value={form[key] || "NORMAL"}
                      onChange={(event) => updateField(key, event.target.value)}
                      required
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                      <option value="POOR">Poor</option>
                      <option value="ISSUE_FOUND">Issue Found</option>
                      <option value="NEEDS_ATTENTION">Needs Attention</option>
                    </select>
                  ) : key === "eventType" ? (
                    <select
                      value={form[key] || "SECURITY_INCIDENT"}
                      onChange={(event) => updateField(key, event.target.value)}
                      required
                    >
                      <option value="SECURITY_INCIDENT">
                        Security Incident
                      </option>
                      <option value="UNAUTHORIZED_ACCESS">
                        Unauthorized Access
                      </option>
                      <option value="SUSPICIOUS_ACTIVITY">
                        Suspicious Activity
                      </option>
                      <option value="WATER_LEAK">Water Leak</option>
                      <option value="FIRE_ALERT">Fire Alert</option>
                      <option value="PROPERTY_DAMAGE">Property Damage</option>
                      <option value="ACCESS_ISSUE">Access Issue</option>
                      <option value="MAINTENANCE_ALERT">
                        Maintenance Alert
                      </option>
                      <option value="CARETAKER_ALERT">Caretaker Alert</option>
                      <option value="SYSTEM_WARNING">System Warning</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : key === "category" ? (
                    <select
                      value={
                        form[key] ||
                        (type === "maintenance"
                          ? "PLUMBING"
                          : type === "vendors"
                            ? "PLUMBING"
                            : type === "expenses"
                              ? "MAINTENANCE"
                              : "PROPERTY_DEED")
                      }
                      onChange={(event) => updateField(key, event.target.value)}
                      required
                    >
                      {type === "maintenance" && (
                        <>
                          <option value="PLUMBING">Plumbing</option>
                          <option value="ELECTRICAL">Electrical</option>
                          <option value="HVAC">HVAC</option>
                          <option value="CLEANING">Cleaning</option>
                          <option value="SECURITY">Security</option>
                          <option value="STRUCTURAL">Structural</option>
                          <option value="APPLIANCE">Appliance</option>
                          <option value="PEST_CONTROL">Pest Control</option>
                          <option value="OTHER">Other</option>
                        </>
                      )}

                      {type === "vendors" && (
                        <>
                          <option value="PLUMBING">Plumbing</option>
                          <option value="ELECTRICAL">Electrical</option>
                          <option value="CLEANING">Cleaning</option>
                          <option value="SECURITY">Security</option>
                          <option value="PAINTING">Painting</option>
                          <option value="CARPENTRY">Carpentry</option>
                          <option value="HVAC">HVAC</option>
                          <option value="PEST_CONTROL">Pest Control</option>
                          <option value="APPLIANCE">Appliance</option>
                          <option value="LANDSCAPING">Landscaping</option>
                          <option value="CONSTRUCTION">Construction</option>
                          <option value="LEGAL">Legal</option>
                          <option value="INSURANCE">Insurance</option>
                          <option value="OTHER">Other</option>
                        </>
                      )}

                      {type === "expenses" && (
                        <>
                          <option value="MAINTENANCE">Maintenance</option>
                          <option value="ELECTRICITY">Electricity</option>
                          <option value="WATER">Water</option>
                          <option value="PROPERTY_TAX">Property Tax</option>
                          <option value="INSURANCE">Insurance</option>
                          <option value="SECURITY">Security</option>
                          <option value="CLEANING">Cleaning</option>
                          <option value="REPAIR">Repair</option>
                          <option value="RENOVATION">Renovation</option>
                          <option value="UTILITY">Utility</option>
                          <option value="OTHER">Other</option>
                        </>
                      )}

                      {type === "documents" && (
                        <>
                          <option value="PROPERTY_DEED">Property Deed</option>
                          <option value="TAX_RECEIPT">Tax Receipt</option>
                          <option value="INSURANCE">Insurance</option>
                          <option value="ELECTRICITY_BILL">
                            Electricity Bill
                          </option>
                          <option value="WATER_BILL">Water Bill</option>
                          <option value="MAINTENANCE_INVOICE">
                            Maintenance Invoice
                          </option>
                          <option value="RENTAL_AGREEMENT">
                            Rental Agreement
                          </option>
                          <option value="LEGAL_DOCUMENT">Legal Document</option>
                          <option value="IDENTITY_DOCUMENT">
                            Identity Document
                          </option>
                          <option value="OTHER">Other</option>
                        </>
                      )}
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
                              : key === "password"
                                ? "password"
                                : "text"
                      }
                      value={form[key] || ""}
                      onChange={(event) => updateField(key, event.target.value)}
                      placeholder={`Enter ${label.toLowerCase()}`}
                      required={[
                        "name",
                        "title",
                        "amount",
                        "password",
                        "propertyId",
                      ].includes(key)}
                      minLength={key === "password" ? 8 : undefined}
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
