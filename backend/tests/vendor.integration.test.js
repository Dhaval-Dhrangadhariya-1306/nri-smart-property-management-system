const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5001";

// ============================================================
// HELPERS
// ============================================================

const uniqueEmail = () => `vendor-test-${randomUUID()}@example.com`;

const request = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    status: response.status,
    body,
  };
};

const registerOwner = async () => {
  const payload = {
    name: "Vendor Integration Test Owner",
    email: uniqueEmail(),
    password: "SecureTest@123",
  };

  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  assert.equal(
    result.status,
    201,
    `Owner registration failed: ${JSON.stringify(result.body)}`,
  );

  assert.equal(result.body.success, true);
  assert.ok(result.body.data.token);

  return {
    token: result.body.data.token,
    user: result.body.data.user,
  };
};

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

const vendorPayload = (overrides = {}) => ({
  name: `Test Vendor ${randomUUID().slice(0, 8)}`,
  companyName: "Test Property Services",
  category: "PLUMBING",
  phone: "+91-9876543210",
  email: `vendor-${randomUUID()}@example.com`,
  address: {
    addressLine1: "101 Test Avenue",
    addressLine2: "",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    postalCode: "380001",
  },
  services: ["Pipe repair", "Leak detection"],
  notes: "Created by automated vendor integration tests",
  status: "ACTIVE",
  rating: 4,
  ...overrides,
});

// ============================================================
// SHARED TEST STATE
// ============================================================

let ownerToken;
let otherOwnerToken;

let vendorId;
let otherOwnerVendorId;

// ============================================================
// AUTHENTICATION
// ============================================================

test("vendor API rejects unauthenticated requests", async () => {
  const endpoints = [
    { path: "/api/vendors/my", method: "GET" },
    { path: "/api/vendors/stats", method: "GET" },
    { path: "/api/vendors", method: "POST", body: vendorPayload() },
  ];

  for (const endpoint of endpoints) {
    const result = await request(endpoint.path, {
      method: endpoint.method,
      ...(endpoint.body ? { body: JSON.stringify(endpoint.body) } : {}),
    });

    assert.equal(
      result.status,
      401,
      `${endpoint.method} ${endpoint.path}: ${JSON.stringify(result.body)}`,
    );

    assert.equal(result.body.success, false);
  }
});

test("register two independent vendor test owners", async () => {
  const owner = await registerOwner();
  const otherOwner = await registerOwner();

  ownerToken = owner.token;
  otherOwnerToken = otherOwner.token;

  assert.ok(ownerToken);
  assert.ok(otherOwnerToken);
  assert.notEqual(ownerToken, otherOwnerToken);
});

// ============================================================
// CREATE
// ============================================================

test("owner can create a vendor", async () => {
  const payload = vendorPayload();

  const result = await request("/api/vendors", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, "Vendor created successfully");

  assert.ok(result.body.vendor?._id, "Vendor ID should be returned");

  vendorId = result.body.vendor._id;

  assert.equal(result.body.vendor.name, payload.name);
  assert.equal(result.body.vendor.category, payload.category);
  assert.equal(result.body.vendor.status, payload.status);
  assert.equal(result.body.vendor.rating, payload.rating);
  assert.equal(result.body.vendor.email, payload.email.toLowerCase());
  assert.equal(
    String(result.body.vendor.owner._id),
    String(result.body.vendor.owner._id),
  );
  assert.equal(result.body.vendor.isActive, true);
});

test("vendor creation rejects a missing name", async () => {
  const payload = vendorPayload({ name: " " });

  const result = await request("/api/vendors", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("vendor creation rejects a missing category", async () => {
  const payload = vendorPayload({ category: "" });

  const result = await request("/api/vendors", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("vendor creation rejects an invalid category", async () => {
  const payload = vendorPayload({ category: "INVALID_CATEGORY" });

  const result = await request("/api/vendors", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("vendor creation rejects an invalid email", async () => {
  const payload = vendorPayload({ email: "not-an-email" });

  const result = await request("/api/vendors", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("vendor creation rejects a rating above five", async () => {
  const payload = vendorPayload({ rating: 6 });

  const result = await request("/api/vendors", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

// ============================================================
// LIST AND FILTER
// ============================================================

test("owner can list their vendors", async () => {
  assert.ok(vendorId, "Create test vendor before listing");

  const result = await request("/api/vendors/my", {
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.vendors));

  assert.ok(
    result.body.vendors.some(
      (vendor) => String(vendor._id) === String(vendorId),
    ),
    "Created vendor should appear in the owner's vendor list",
  );
});

test("owner can filter vendors by category", async () => {
  const result = await request("/api/vendors/my?category=PLUMBING", {
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  assert.ok(
    result.body.vendors.every((vendor) => vendor.category === "PLUMBING"),
    "All returned vendors should match the requested category",
  );
});

test("owner can search vendors by name", async () => {
  assert.ok(vendorId, "Create test vendor before searching");

  const result = await request(
    `/api/vendors/my?search=${encodeURIComponent("Test Vendor")}`,
    {
      headers: authHeaders(ownerToken),
    },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.vendors));
});

test("vendor lists are isolated by owner", async () => {
  const result = await request("/api/vendors/my", {
    headers: authHeaders(otherOwnerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  assert.ok(
    !result.body.vendors.some(
      (vendor) => String(vendor._id) === String(vendorId),
    ),
    "Another owner must not see this vendor",
  );
});

// ============================================================
// GET BY ID
// ============================================================

test("owner can retrieve a vendor by ID", async () => {
  assert.ok(vendorId, "Vendor ID must exist");

  const result = await request(`/api/vendors/${vendorId}`, {
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(String(result.body.vendor._id), String(vendorId));
});

test("owner cannot retrieve another owner's vendor", async () => {
  assert.ok(vendorId, "Vendor ID must exist");

  const result = await request(`/api/vendors/${vendorId}`, {
    headers: authHeaders(otherOwnerToken),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("vendor retrieval rejects a malformed ID", async () => {
  const result = await request("/api/vendors/not-a-valid-id", {
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

// ============================================================
// UPDATE
// ============================================================

test("owner can update a vendor", async () => {
  assert.ok(vendorId, "Vendor ID must exist");

  const updatedName = `Updated Vendor ${randomUUID().slice(0, 8)}`;

  const result = await request(`/api/vendors/${vendorId}`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: JSON.stringify({
      name: updatedName,
      rating: 4.5,
      notes: "Updated by integration test",
    }),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.vendor.name, updatedName);
  assert.equal(result.body.vendor.rating, 4.5);
  assert.equal(result.body.vendor.notes, "Updated by integration test");
});

test("vendor update rejects an empty name", async () => {
  assert.ok(vendorId, "Vendor ID must exist");

  const result = await request(`/api/vendors/${vendorId}`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: JSON.stringify({ name: " " }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("vendor update rejects a rating above five", async () => {
  assert.ok(vendorId, "Vendor ID must exist");

  const result = await request(`/api/vendors/${vendorId}`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: JSON.stringify({ rating: 5.5 }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("vendor update rejects non-array services", async () => {
  assert.ok(vendorId, "Vendor ID must exist");

  const result = await request(`/api/vendors/${vendorId}`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: JSON.stringify({ services: "Pipe repair" }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner cannot update another owner's vendor", async () => {
  assert.ok(vendorId, "Vendor ID must exist");

  const result = await request(`/api/vendors/${vendorId}`, {
    method: "PUT",
    headers: authHeaders(otherOwnerToken),
    body: JSON.stringify({ name: "Unauthorized update" }),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("vendor update rejects a malformed ID", async () => {
  const result = await request("/api/vendors/not-a-valid-id", {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: JSON.stringify({ name: "Updated name" }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

// ============================================================
// STATISTICS
// ============================================================

test("owner can retrieve vendor statistics", async () => {
  const result = await request("/api/vendors/stats", {
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  const stats = result.body.stats;

  assert.equal(typeof stats.totalVendors, "number");
  assert.equal(typeof stats.activeVendors, "number");
  assert.equal(typeof stats.inactiveVendors, "number");
  assert.equal(typeof stats.suspendedVendors, "number");
  assert.equal(typeof stats.averageRating, "number");
  assert.equal(typeof stats.totalJobs, "number");
  assert.equal(typeof stats.completedJobs, "number");
  assert.ok(Array.isArray(stats.byCategory));
});

test("vendor statistics are isolated by owner", async () => {
  const result = await request("/api/vendors/stats", {
    headers: authHeaders(otherOwnerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  assert.equal(result.body.stats.totalVendors, 0);
  assert.equal(result.body.stats.activeVendors, 0);
});

// ============================================================
// ARCHIVE
// ============================================================

test("owner can create a separate vendor for archive tests", async () => {
  const result = await request("/api/vendors", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: JSON.stringify(vendorPayload()),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.ok(result.body.vendor?._id);

  otherOwnerVendorId = result.body.vendor._id;
});

test("owner can archive a vendor", async () => {
  assert.ok(otherOwnerVendorId, "Archive-test vendor must exist");

  const result = await request(`/api/vendors/${otherOwnerVendorId}`, {
    method: "DELETE",
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
});

test("archived vendor is no longer retrievable", async () => {
  assert.ok(otherOwnerVendorId, "Archive-test vendor ID must exist");

  const result = await request(`/api/vendors/${otherOwnerVendorId}`, {
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("archived vendor is excluded from the owner's vendor list", async () => {
  assert.ok(otherOwnerVendorId, "Archive-test vendor ID must exist");

  const result = await request("/api/vendors/my", {
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));

  assert.ok(
    !result.body.vendors.some(
      (vendor) => String(vendor._id) === String(otherOwnerVendorId),
    ),
    "Archived vendors should not appear in the active vendor list",
  );
});

test("archived vendor cannot be archived a second time", async () => {
  assert.ok(otherOwnerVendorId, "Archive-test vendor ID must exist");

  const result = await request(`/api/vendors/${otherOwnerVendorId}`, {
    method: "DELETE",
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});
