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
  assert.ok(result.body?.data?.token, "Login response should contain a token");

  return result.body.data.token;
};

const propertyPayload = () => ({
  title: `Risk Integration Test ${randomUUID().slice(0, 8)}`,
  propertyType: "APARTMENT",
  address: {
    addressLine1: "101 Risk Test Avenue",
    addressLine2: "",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    postalCode: "380001",
  },
  description: "Created by property risk integration tests",
  occupancy: "VACANT",
  condition: "GOOD",
});

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

let ownerToken;
let otherOwnerToken;
let propertyId;
let archivedPropertyId;

test("authenticate property risk test owners", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
  otherOwnerToken = await login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD);
});

test("property risk endpoint rejects unauthenticated requests", async () => {
  const result = await request(
    "/api/properties/507f1f77bcf86cd799439011/risk-score",
  );

  assert.equal(result.status, 401);
});

test("property risk endpoint rejects malformed property IDs", async () => {
  const result = await request("/api/properties/not-a-valid-id/risk-score", {
    headers: authHeaders(ownerToken),
  });

  assert.equal(result.status, 400);
});

test("property risk endpoint returns 404 for a nonexistent property", async () => {
  const result = await request(
    "/api/properties/507f1f77bcf86cd799439011/risk-score",
    { headers: authHeaders(ownerToken) },
  );

  assert.equal(result.status, 404);
});

test("owner can create a property for risk-score testing", async () => {
  const result = await request("/api/properties", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(
    result.status,
    201,
    `Property creation failed: ${JSON.stringify(result.body)}`,
  );

  propertyId = result.body?.data?.property?._id;
  assert.ok(propertyId, "Created property should contain an _id");
});

test("owner can retrieve a valid risk score for their property", async () => {
  const result = await request(`/api/properties/${propertyId}/risk-score`, {
    headers: authHeaders(ownerToken),
  });

  assert.equal(
    result.status,
    200,
    `Risk request failed: ${JSON.stringify(result.body)}`,
  );

  const risk = result.body?.data?.risk;

  assert.ok(risk, "Response should contain data.risk");
  assert.equal(risk.propertyId, propertyId);
  assert.equal(typeof risk.propertyTitle, "string");
  assert.equal(typeof risk.score, "number");
  assert.ok(risk.score >= 0 && risk.score <= 100);
  assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(risk.level));
  assert.ok(["LOW", "MEDIUM", "HIGH"].includes(risk.confidence));
  assert.equal(typeof risk.summary, "string");
  assert.ok(Array.isArray(risk.factors));
  assert.ok(risk.factors.length > 0);
  assert.ok(!Number.isNaN(Date.parse(risk.calculatedAt)));

  assert.ok(risk.dataSnapshot);
  assert.equal(typeof risk.dataSnapshot.unresolvedMaintenanceCount, "number");
  assert.equal(typeof risk.dataSnapshot.unresolvedMonitoringCount, "number");
  assert.equal(typeof risk.dataSnapshot.activeDocumentCount, "number");
  assert.equal(typeof risk.dataSnapshot.hasActiveCaretaker, "boolean");

  for (const factor of risk.factors) {
    assert.equal(typeof factor.category, "string");
    assert.equal(typeof factor.impact, "number");
    assert.equal(typeof factor.maxImpact, "number");
    assert.ok(factor.impact >= 0);
    assert.ok(factor.impact <= factor.maxImpact);
    assert.equal(typeof factor.severity, "string");
    assert.equal(typeof factor.reason, "string");
  }
});

test("owner cannot retrieve another owner's property risk score", async () => {
  const result = await request(`/api/properties/${propertyId}/risk-score`, {
    headers: authHeaders(otherOwnerToken),
  });

  assert.equal(result.status, 404);
});

test("owner can archive a property for risk endpoint testing", async () => {
  const createResult = await request("/api/properties", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(
    createResult.status,
    201,
    `Property creation failed: ${JSON.stringify(createResult.body)}`,
  );

  archivedPropertyId = createResult.body?.data?.property?._id;
  assert.ok(archivedPropertyId);

  const archiveResult = await request(`/api/properties/${archivedPropertyId}`, {
    method: "DELETE",
    headers: authHeaders(ownerToken),
  });

  assert.equal(
    archiveResult.status,
    200,
    `Property archive failed: ${JSON.stringify(archiveResult.body)}`,
  );
});

test("risk endpoint returns 404 for an archived property", async () => {
  const result = await request(
    `/api/properties/${archivedPropertyId}/risk-score`,
    { headers: authHeaders(ownerToken) },
  );

  assert.equal(result.status, 404);
});
