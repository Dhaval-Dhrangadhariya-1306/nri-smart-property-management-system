const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5001";
const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL || "testnri@example.com";
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD || "Test@12345";
const OTHER_OWNER_EMAIL =
  process.env.TEST_OTHER_OWNER_EMAIL || "otherowner.test@example.com";
const OTHER_OWNER_PASSWORD =
  process.env.TEST_OTHER_OWNER_PASSWORD || "OtherOwner@123";

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

  return { status: response.status, body };
};

const login = async (email, password) => {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  assert.equal(
    result.status,
    200,
    `Login failed for ${email}: ${JSON.stringify(result.body)}`,
  );

  assert.ok(result.body?.data?.token);
  return result.body.data.token;
};

const propertyPayload = () => ({
  title: `Audit Timeline Test ${randomUUID().slice(0, 8)}`,
  propertyType: "APARTMENT",
  address: {
    addressLine1: "101 Audit Test Avenue",
    addressLine2: "",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    postalCode: "380001",
  },
  description: "Created by audit timeline integration tests",
  occupancy: "VACANT",
  condition: "GOOD",
});

let ownerToken;
let otherOwnerToken;
let propertyId;

test("authenticate audit-log test owners", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
  otherOwnerToken = await login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD);
});

test("audit-log endpoints reject unauthenticated requests", async () => {
  const result = await request("/api/audit-logs/my");

  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
});

test("prepare an owned property for timeline tests", async () => {
  const created = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(created.status, 201, JSON.stringify(created.body));

  propertyId = created.body.data.property._id;
  assert.ok(propertyId);
});

test("owner can retrieve their property activity timeline", async () => {
  const result = await request(
    `/api/audit-logs/timeline/property/${propertyId}`,
    { headers: { Authorization: `Bearer ${ownerToken}` } },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data));
  assert.equal(result.body.property._id, propertyId);
  assert.ok(result.body.count >= 0);
});

test("timeline rejects a malformed property ID", async () => {
  const result = await request(
    "/api/audit-logs/timeline/property/not-a-valid-id",
    { headers: { Authorization: `Bearer ${ownerToken}` } },
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("owner cannot view another owner's property timeline", async () => {
  const created = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${otherOwnerToken}` },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(created.status, 201, JSON.stringify(created.body));

  const otherPropertyId = created.body.data.property._id;

  const result = await request(
    `/api/audit-logs/timeline/property/${otherPropertyId}`,
    { headers: { Authorization: `Bearer ${ownerToken}` } },
  );

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
});

test("timeline response does not expose audit change snapshots", async () => {
  const result = await request(
    `/api/audit-logs/timeline/property/${propertyId}`,
    { headers: { Authorization: `Bearer ${ownerToken}` } },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));

  for (const entry of result.body.data) {
    assert.equal("oldValues" in entry, false);
    assert.equal("newValues" in entry, false);
    assert.equal("metadata" in entry, false);
  }
});

test("owner can retrieve their own audit logs", async () => {
  const result = await request("/api/audit-logs/my", {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data));
  assert.equal(result.body.count, result.body.data.length);
});

test("timeline supports pagination parameters", async () => {
  const result = await request(
    `/api/audit-logs/timeline/property/${propertyId}?page=1&limit=5`,
    { headers: { Authorization: `Bearer ${ownerToken}` } },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.pagination.page, 1);
  assert.equal(result.body.pagination.limit, 5);
  assert.ok(Number.isInteger(result.body.pagination.total));
  assert.ok(Number.isInteger(result.body.pagination.totalPages));
  assert.ok(result.body.data.length <= 5);
});

test("timeline rejects invalid pagination parameters", async () => {
  for (const query of ["page=0", "page=abc", "limit=0", "limit=101"]) {
    const result = await request(
      `/api/audit-logs/timeline/property/${propertyId}?${query}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );

    assert.equal(
      result.status,
      400,
      `${query}: ${JSON.stringify(result.body)}`,
    );
    assert.equal(result.body.success, false);
  }
});

test("timeline supports action and resource type filters", async () => {
  const result = await request(
    `/api/audit-logs/timeline/property/${propertyId}?action=CREATE&resourceType=PROPERTY`,
    { headers: { Authorization: `Bearer ${ownerToken}` } },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));

  for (const entry of result.body.data) {
    assert.equal(entry.action, "CREATE");
    assert.equal(entry.resourceType, "PROPERTY");
  }
});

test("timeline rejects invalid date filters", async () => {
  const result = await request(
    `/api/audit-logs/timeline/property/${propertyId}?from=not-a-date`,
    { headers: { Authorization: `Bearer ${ownerToken}` } },
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("timeline rejects a reversed date range", async () => {
  const result = await request(
    `/api/audit-logs/timeline/property/${propertyId}?from=2026-10-20&to=2026-10-01`,
    { headers: { Authorization: `Bearer ${ownerToken}` } },
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});
