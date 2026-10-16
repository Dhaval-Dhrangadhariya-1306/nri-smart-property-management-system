const test = require("node:test");
const assert = require("node:assert/strict");

// ============================================================
// CONFIGURATION
// ============================================================

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL || "YOUR_OWNER_EMAIL";

const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD || "YOUR_OWNER_PASSWORD";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "YOUR_ADMIN_EMAIL";

const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "YOUR_ADMIN_PASSWORD";

const PROPERTY_ID = process.env.TEST_PROPERTY_ID || "6aa97840f532befd1c175245";

const OTHER_OWNER_PROPERTY_ID =
  process.env.TEST_OTHER_OWNER_PROPERTY_ID ||
  "REPLACE_WITH_OTHER_OWNER_PROPERTY_ID";

// ============================================================
// HELPERS
// ============================================================

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

const login = async (email, password) => {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  assert.equal(
    result.status,
    200,
    `Login failed: ${JSON.stringify(result.body)}`,
  );

  assert.equal(result.body.success, true);
  assert.ok(result.body.data);
  assert.ok(result.body.data.token);

  return result.body.data.token;
};

const getInsights = async (token, query = "") => {
  return request(`/api/expenses/insights${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// ============================================================
// AUTHENTICATION
// ============================================================

let ownerToken;
let adminToken;

// ============================================================
// LOGIN TESTS
// ============================================================

test("login should authenticate the test owner", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);

  assert.ok(ownerToken);
});

test("login should authenticate the test admin", async () => {
  adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  assert.ok(adminToken);
});

// ============================================================
// OWNER — 12 MONTHS
// ============================================================

test("owner should receive 12M expense insights", async () => {
  const result = await getInsights(ownerToken, "?period=12M");

  assert.equal(result.status, 200);

  assert.equal(result.body.success, true);
  assert.equal(result.body.message, "Expense insights generated successfully");

  assert.ok(result.body.data);
});

// ============================================================
// OWNER — 6 MONTHS
// ============================================================

test("owner should receive 6M expense insights", async () => {
  const result = await getInsights(ownerToken, "?period=6M");

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.ok(result.body.data);
});

// ============================================================
// OWNER — 3 MONTHS
// ============================================================

test("owner should receive 3M expense insights", async () => {
  const result = await getInsights(ownerToken, "?period=3M");

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.ok(result.body.data);
});

// ============================================================
// OWNER — PROPERTY FILTERING
// ============================================================

test("owner should receive insights for their specific property", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);

  const data = result.body.data;

  assert.ok(data);
  assert.equal(data.overview.totalExpenses, 9);
  assert.equal(data.overview.totalAmount, 98000);
});

// ============================================================
// OWNER — PROPERTY ISOLATION
// ============================================================

test("owner should not access another owner's property insights", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${OTHER_OWNER_PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 404);

  assert.equal(result.body.success, false);
  assert.equal(result.body.message, "Property not found");
});

// ============================================================
// INVALID PROPERTY ID
// ============================================================

test("invalid property ID should return 400", async () => {
  const result = await getInsights(
    ownerToken,
    "?propertyId=invalid-property-id&period=12M",
  );

  assert.equal(result.status, 400);

  assert.equal(result.body.success, false);
  assert.equal(result.body.message, "Invalid property ID");
});

// ============================================================
// INVALID PERIOD
// ============================================================

test("invalid period should return 400", async () => {
  const result = await getInsights(ownerToken, "?period=1M");

  assert.equal(result.status, 400);

  assert.equal(result.body.success, false);

  assert.equal(
    result.body.message,
    "Invalid period. Allowed values are 3M, 6M, and 12M.",
  );
});

// ============================================================
// UNAUTHENTICATED
// ============================================================

test("unauthenticated request should return 401", async () => {
  const result = await request("/api/expenses/insights?period=12M", {
    method: "GET",
  });

  assert.equal(result.status, 401);

  assert.equal(result.body.success, false);
  assert.equal(result.body.message, "Authentication token required");
});

// ============================================================
// RESPONSE STRUCTURE
// ============================================================

// ============================================================
// RESPONSE STRUCTURE
// ============================================================

test(
  "owner insights response should contain the complete analytics structure",
  async () => {
    const result = await getInsights(
      ownerToken,
      `?propertyId=${PROPERTY_ID}&period=12M`,
    );

    assert.equal(result.status, 200);

    const data = result.body.data;

    assert.ok(data.overview);
    assert.ok(data.trends);
    assert.ok(data.trends.monthly);
    assert.ok(data.categories);
    assert.ok(data.anomalies);
    assert.ok(data.recurringExpenses);
    assert.ok(data.maintenanceAnalysis);
    assert.ok(data.vendorAnalysis);
    assert.ok(data.healthScore);
    assert.ok(data.confidence);
    assert.ok(data.actionableInsights);
    assert.ok(data.dataQuality);
  },
);

// ============================================================
// DATA QUALITY
// ============================================================

test("owner insights should report sufficient data quality", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);

  const dataQuality = result.body.data.dataQuality;

  assert.equal(dataQuality.expenseCount, 9);
  assert.equal(dataQuality.hasSufficientData, true);
  assert.equal(dataQuality.hasSufficientAnomalyData, true);
  assert.equal(dataQuality.hasSufficientRecurringData, true);
});

// ============================================================
// ANOMALY INTEGRATION
// ============================================================

test("owner 12M insights should contain anomaly analysis", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);

  const anomalies = result.body.data.anomalies;

  assert.ok(anomalies);
  assert.equal(typeof anomalies, "object");

  const serialized = JSON.stringify(anomalies).toLowerCase();

  assert.ok(
    serialized.includes("45000") ||
      serialized.includes("emergency structural repair"),
  );
});

// ============================================================
// RECURRING EXPENSE INTEGRATION
// ============================================================

test("owner 12M insights should contain recurring expense analysis", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);

  const recurring = result.body.data.recurringExpenses;

  assert.ok(recurring);

  const serialized = JSON.stringify(recurring).toLowerCase();

  assert.ok(serialized.includes("electricity"));
});

// ============================================================
// MAINTENANCE INTEGRATION
// ============================================================

test("owner 12M insights should contain maintenance intelligence", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);

  const maintenance = result.body.data.maintenanceAnalysis;

  assert.ok(maintenance);

  const serialized = JSON.stringify(maintenance).toLowerCase();

  assert.ok(serialized.includes("28000"));
});

// ============================================================
// VENDOR INTEGRATION
// ============================================================

test("owner 12M insights should contain vendor intelligence", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);

  const vendor = result.body.data.vendorAnalysis;

  assert.ok(vendor);

  const serialized = JSON.stringify(vendor).toLowerCase();

  assert.ok(serialized.includes("28000"));
});

// ============================================================
// HEALTH SCORE
// ============================================================

test("owner 12M insights should contain a valid health score", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);

  const health = result.body.data.healthScore;

  assert.ok(health);

  assert.equal(typeof health.score, "number");
  assert.equal(typeof health.level, "string");

  assert.ok(health.score >= 0);
  assert.ok(health.score <= 100);
});

// ============================================================
// CONFIDENCE
// ============================================================

test("owner 12M insights should contain a valid confidence score", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);

  const confidence = result.body.data.confidence;

  assert.ok(confidence);

  assert.equal(typeof confidence.score, "number");

  assert.equal(typeof confidence.level, "string");

  assert.ok(confidence.score >= 0);
  assert.ok(confidence.score <= 100);
});

// ============================================================
// ACTIONABLE INSIGHTS
// ============================================================

test("owner 12M insights should contain actionable insights", async () => {
  const result = await getInsights(
    ownerToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);

  const actionable = result.body.data.actionableInsights;

  assert.ok(actionable);

  assert.equal(typeof actionable.count, "number");

  assert.ok(Array.isArray(actionable.insights));

  assert.equal(actionable.count, actionable.insights.length);
});

// ============================================================
// ADMIN — ALL PROPERTIES
// ============================================================

test("admin should receive all-property expense insights", async () => {
  const result = await getInsights(adminToken, "?period=12M");

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);

  const data = result.body.data;

  assert.ok(data);

  assert.equal(data.overview.totalExpenses, 10);
  assert.equal(data.overview.totalAmount, 101200);
});

// ============================================================
// ADMIN — SPECIFIC PROPERTY
// ============================================================

test("admin should receive insights for a specific property", async () => {
  const result = await getInsights(
    adminToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);

  const data = result.body.data;

  assert.equal(data.overview.totalExpenses, 9);
  assert.equal(data.overview.totalAmount, 98000);
});

// ============================================================
// ADMIN — CROSS PROPERTY ACCESS
// ============================================================

test("admin should be allowed to access property-specific insights", async () => {
  const result = await getInsights(
    adminToken,
    `?propertyId=${PROPERTY_ID}&period=12M`,
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

// ============================================================
// DEFAULT PERIOD
// ============================================================

test("owner should default to 12M when period is omitted", async () => {
  const result = await getInsights(ownerToken, `?propertyId=${PROPERTY_ID}`);

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);

  assert.equal(result.body.data.period.type, "12M");
  assert.equal(result.body.data.period.months, 12);
});
