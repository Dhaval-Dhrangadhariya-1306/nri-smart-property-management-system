const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5001";

const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL || "testnri@example.com";
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD || "Test@12345";

const OTHER_OWNER_EMAIL =
  process.env.TEST_OTHER_OWNER_EMAIL || "otherowner.test@example.com";
const OTHER_OWNER_PASSWORD =
  process.env.TEST_OTHER_OWNER_PASSWORD || "OtherOwner@123";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

async function request(path, options = {}) {
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
    // Keep body null if the response is not JSON.
  }

  return { status: response.status, body };
}

async function login(email, password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  assert.equal(
    result.status,
    200,
    `Login failed for ${email}: ${JSON.stringify(result.body)}`,
  );

  assert.ok(result.body?.data?.token, "Expected a JWT token");
  return result.body.data.token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function propertyPayload(label) {
  return {
    title: `Expense Test ${label} ${randomUUID().slice(0, 8)}`,
    propertyType: "APARTMENT",
    address: {
      addressLine1: "101 Expense Test Avenue",
      addressLine2: "",
      city: "Ahmedabad",
      state: "Gujarat",
      country: "India",
      postalCode: "380001",
    },
    description: "Property created by expense integration tests",
    occupancy: "VACANT",
    condition: "GOOD",
  };
}

function expensePayload(propertyId, overrides = {}) {
  return {
    propertyId,
    title: `Integration Test Expense ${randomUUID().slice(0, 8)}`,
    description: "Created by expense integration tests",
    category: "MAINTENANCE",
    amount: 1250,
    expenseDate: "2026-10-20",
    paymentStatus: "PENDING",
    paidBy: "OWNER",
    paymentMethod: "BANK_TRANSFER",
    notes: "Expense integration test",
    ...overrides,
  };
}

function getExpenseId(result) {
  const data = result.body?.data;

  return (
    data?.expense?._id ||
    data?._id ||
    result.body?.expense?._id ||
    result.body?.expense?.id ||
    null
  );
}

function getPropertyId(result) {
  return (
    result.body?.data?.property?._id ||
    result.body?.data?._id ||
    result.body?.property?._id ||
    null
  );
}

function getExpenses(result) {
  const data = result.body?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.expenses)) return data.expenses;
  if (Array.isArray(result.body?.expenses)) return result.body.expenses;

  return [];
}

let ownerToken;
let otherOwnerToken;
let adminToken;

let ownerPropertyId;
let otherOwnerPropertyId;

let ownerExpenseId;
let otherOwnerExpenseId;
let adminCreatedExpenseId;

// Track every successfully created expense so teardown can clean it up,
// including when a later assertion fails.
const createdExpenses = [];

function trackExpense(id, token, label) {
  if (id && token) {
    createdExpenses.push({ id: String(id), token, label });
  }
}

// Cleanup uses the application's soft-delete endpoint.
// It never deletes seeded analytics fixtures or performs broad database
// operations. HTTP 404 is acceptable if an expense was already deleted.
after(async () => {
  const failures = [];

  for (const item of [...createdExpenses].reverse()) {
    try {
      const result = await request(`/api/expenses/${item.id}`, {
        method: "DELETE",
        headers: auth(item.token),
      });

      if (![200, 404].includes(result.status)) {
        failures.push(
          `${item.label} (${item.id}): HTTP ${result.status} - ` +
            JSON.stringify(result.body),
        );
      }
    } catch (error) {
      failures.push(`${item.label} (${item.id}): ${error.message}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      "\nExpense integration-test cleanup encountered errors:\n" +
        failures.map((failure) => `- ${failure}`).join("\n"),
    );
  }
});

test("authenticate expense test users", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
  otherOwnerToken = await login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD);

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  }
});

test("expense endpoints reject unauthenticated requests", async () => {
  const result = await request("/api/expenses/my");

  assert.equal(result.status, 401, JSON.stringify(result.body));
  assert.equal(result.body?.success, false);
});

test("prepare properties for both owners", async () => {
  const ownerProperty = await request("/api/properties", {
    method: "POST",
    headers: auth(ownerToken),
    body: JSON.stringify(propertyPayload("Owner")),
  });

  assert.equal(ownerProperty.status, 201, JSON.stringify(ownerProperty.body));

  ownerPropertyId = getPropertyId(ownerProperty);
  assert.ok(ownerPropertyId, "Owner property ID was not returned");

  const otherProperty = await request("/api/properties", {
    method: "POST",
    headers: auth(otherOwnerToken),
    body: JSON.stringify(propertyPayload("Other Owner")),
  });

  assert.equal(otherProperty.status, 201, JSON.stringify(otherProperty.body));

  otherOwnerPropertyId = getPropertyId(otherProperty);
  assert.ok(otherOwnerPropertyId, "Other owner's property ID was not returned");
});

test("owner creates an expense for their own property", async () => {
  const result = await request("/api/expenses", {
    method: "POST",
    headers: auth(ownerToken),
    body: JSON.stringify(expensePayload(ownerPropertyId)),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body?.success, true);

  ownerExpenseId = getExpenseId(result);
  trackExpense(ownerExpenseId, ownerToken, "Owner expense");

  assert.ok(ownerExpenseId, "Created expense ID was not returned");
});

test("another owner cannot create an expense for someone else's property", async () => {
  const result = await request("/api/expenses", {
    method: "POST",
    headers: auth(otherOwnerToken),
    body: JSON.stringify(expensePayload(ownerPropertyId)),
  });

  assert.ok(
    [403, 404].includes(result.status),
    `Expected 403 or 404, got ${result.status}: ${JSON.stringify(result.body)}`,
  );
});

test("owner can retrieve their own expense", async () => {
  const result = await request(`/api/expenses/${ownerExpenseId}`, {
    headers: auth(ownerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body?.success, true);
});

test("owner cannot retrieve another owner's expense", async () => {
  const created = await request("/api/expenses", {
    method: "POST",
    headers: auth(otherOwnerToken),
    body: JSON.stringify(expensePayload(otherOwnerPropertyId)),
  });

  assert.equal(created.status, 201, JSON.stringify(created.body));

  otherOwnerExpenseId = getExpenseId(created);
  trackExpense(otherOwnerExpenseId, otherOwnerToken, "Other owner's expense");

  assert.ok(otherOwnerExpenseId, "Other owner's expense ID was not returned");

  const result = await request(`/api/expenses/${otherOwnerExpenseId}`, {
    headers: auth(ownerToken),
  });

  assert.ok(
    [403, 404].includes(result.status),
    `Unexpected status ${result.status}: ${JSON.stringify(result.body)}`,
  );
});

test("owner expense list contains their own expense", async () => {
  const result = await request("/api/expenses/my", {
    headers: auth(ownerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));

  const expenses = getExpenses(result);

  assert.ok(
    expenses.some((expense) => String(expense._id) === ownerExpenseId),
    "Owner's expense was not found in their expense list",
  );

  assert.ok(
    !expenses.some((expense) => String(expense._id) === otherOwnerExpenseId),
    "Owner's expense list exposed another owner's expense",
  );
});

test("owner cannot access another owner's property expenses", async () => {
  const result = await request(
    `/api/expenses/property/${otherOwnerPropertyId}`,
    { headers: auth(ownerToken) },
  );

  assert.ok(
    [403, 404].includes(result.status),
    `Unexpected status ${result.status}: ${JSON.stringify(result.body)}`,
  );
});

test("owner can update their own expense", async () => {
  const result = await request(`/api/expenses/${ownerExpenseId}`, {
    method: "PUT",
    headers: auth(ownerToken),
    body: JSON.stringify({ notes: "Updated by owner integration test" }),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body?.success, true);
});

test("updating an expense with a null title returns a validation error without changing it", async () => {
  const before = await request(`/api/expenses/${ownerExpenseId}`, {
    headers: auth(ownerToken),
  });

  assert.equal(before.status, 200, JSON.stringify(before.body));

  const originalTitle =
    before.body?.data?.expense?.title ?? before.body?.data?.title;

  assert.equal(
    typeof originalTitle,
    "string",
    "Original expense title was not returned",
  );

  const result = await request(`/api/expenses/${ownerExpenseId}`, {
    method: "PUT",
    headers: auth(ownerToken),
    body: JSON.stringify({ title: null }),
  });

  assert.ok(
    [400, 422].includes(result.status),
    `Expected a validation error, got ${result.status}: ${JSON.stringify(result.body)}`,
  );

  const after = await request(`/api/expenses/${ownerExpenseId}`, {
    headers: auth(ownerToken),
  });

  assert.equal(after.status, 200, JSON.stringify(after.body));

  const updatedTitle =
    after.body?.data?.expense?.title ?? after.body?.data?.title;

  assert.equal(
    updatedTitle,
    originalTitle,
    "Expense title changed after invalid update",
  );
});

test("updating an expense with a null date returns a validation error without changing it", async () => {
  const before = await request(`/api/expenses/${ownerExpenseId}`, {
    headers: auth(ownerToken),
  });

  assert.equal(before.status, 200, JSON.stringify(before.body));

  const originalDate =
    before.body?.data?.expense?.expenseDate ?? before.body?.data?.expenseDate;

  assert.ok(originalDate, "Original expense date was not returned");

  const result = await request(`/api/expenses/${ownerExpenseId}`, {
    method: "PUT",
    headers: auth(ownerToken),
    body: JSON.stringify({ expenseDate: null }),
  });

  assert.ok(
    [400, 422].includes(result.status),
    `Expected a validation error, got ${result.status}: ${JSON.stringify(result.body)}`,
  );

  const after = await request(`/api/expenses/${ownerExpenseId}`, {
    headers: auth(ownerToken),
  });

  assert.equal(after.status, 200, JSON.stringify(after.body));

  const updatedDate =
    after.body?.data?.expense?.expenseDate ?? after.body?.data?.expenseDate;

  assert.equal(
    new Date(updatedDate).getTime(),
    new Date(originalDate).getTime(),
    "Expense date changed after invalid update",
  );
});

test("owner cannot update another owner's expense", async () => {
  const result = await request(`/api/expenses/${otherOwnerExpenseId}`, {
    method: "PUT",
    headers: auth(ownerToken),
    body: JSON.stringify({ notes: "Unauthorized update attempt" }),
  });

  assert.ok(
    [403, 404].includes(result.status),
    `Unexpected status ${result.status}: ${JSON.stringify(result.body)}`,
  );
});

test("invalid expense amounts are rejected", async () => {
  for (const amount of [-1, "not-a-number"]) {
    const result = await request("/api/expenses", {
      method: "POST",
      headers: auth(ownerToken),
      body: JSON.stringify(expensePayload(ownerPropertyId, { amount })),
    });

    assert.ok(
      [400, 422].includes(result.status),
      `Amount ${JSON.stringify(amount)} returned ${result.status}: ` +
        JSON.stringify(result.body),
    );
  }
});

test("invalid expense categories are rejected", async () => {
  const result = await request("/api/expenses", {
    method: "POST",
    headers: auth(ownerToken),
    body: JSON.stringify(
      expensePayload(ownerPropertyId, { category: "INVALID_CATEGORY" }),
    ),
  });

  assert.ok(
    [400, 422].includes(result.status),
    `Unexpected status ${result.status}: ${JSON.stringify(result.body)}`,
  );
});

test("future expense dates are rejected", async () => {
  const result = await request("/api/expenses", {
    method: "POST",
    headers: auth(ownerToken),
    body: JSON.stringify(
      expensePayload(ownerPropertyId, { expenseDate: "2099-12-31" }),
    ),
  });

  assert.ok(
    [400, 422].includes(result.status),
    `Unexpected status ${result.status}: ${JSON.stringify(result.body)}`,
  );
});

test("owner can delete their own expense", async () => {
  const result = await request(`/api/expenses/${ownerExpenseId}`, {
    method: "DELETE",
    headers: auth(ownerToken),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body?.success, true);
});

test("owner cannot delete another owner's expense", async () => {
  const result = await request(`/api/expenses/${otherOwnerExpenseId}`, {
    method: "DELETE",
    headers: auth(ownerToken),
  });

  assert.ok(
    [403, 404].includes(result.status),
    `Unexpected status ${result.status}: ${JSON.stringify(result.body)}`,
  );
});

test("admin can manage expenses across property owners", async (t) => {
  if (!adminToken) {
    t.skip(
      "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to an existing test admin account",
    );
    return;
  }

  const createResult = await request("/api/expenses", {
    method: "POST",
    headers: auth(adminToken),
    body: JSON.stringify(
      expensePayload(otherOwnerPropertyId, {
        title: `Admin Expense ${randomUUID().slice(0, 8)}`,
        amount: 2750,
      }),
    ),
  });

  assert.equal(createResult.status, 201, JSON.stringify(createResult.body));

  adminCreatedExpenseId = getExpenseId(createResult);
  trackExpense(adminCreatedExpenseId, adminToken, "Admin-created expense");

  assert.ok(adminCreatedExpenseId, "Admin-created expense ID was not returned");

  const listResult = await request("/api/expenses/my", {
    headers: auth(adminToken),
  });

  assert.equal(listResult.status, 200, JSON.stringify(listResult.body));

  const adminExpenses = getExpenses(listResult);

  assert.ok(
    adminExpenses.some(
      (expense) => String(expense._id) === adminCreatedExpenseId,
    ),
    "Admin could not see the expense created for another owner's property",
  );

  const detailResult = await request(`/api/expenses/${adminCreatedExpenseId}`, {
    headers: auth(adminToken),
  });

  assert.equal(detailResult.status, 200, JSON.stringify(detailResult.body));

  const propertyResult = await request(
    `/api/expenses/property/${otherOwnerPropertyId}`,
    { headers: auth(adminToken) },
  );

  assert.equal(propertyResult.status, 200, JSON.stringify(propertyResult.body));

  const propertyExpenses = getExpenses(propertyResult);

  assert.ok(
    propertyExpenses.some(
      (expense) => String(expense._id) === adminCreatedExpenseId,
    ),
    "Admin could not list expenses for another owner's property",
  );

  const updateResult = await request(`/api/expenses/${adminCreatedExpenseId}`, {
    method: "PUT",
    headers: auth(adminToken),
    body: JSON.stringify({ notes: "Updated by platform admin" }),
  });

  assert.equal(updateResult.status, 200, JSON.stringify(updateResult.body));

  const statsResult = await request("/api/expenses/stats", {
    headers: auth(adminToken),
  });

  assert.equal(statsResult.status, 200, JSON.stringify(statsResult.body));

  const deleteResult = await request(`/api/expenses/${adminCreatedExpenseId}`, {
    method: "DELETE",
    headers: auth(adminToken),
  });

  assert.equal(deleteResult.status, 200, JSON.stringify(deleteResult.body));
});

test("caretaker role is forbidden from owner/admin expense endpoints", async (t) => {
  const caretakerEmail = process.env.TEST_CARETAKER_EMAIL;
  const caretakerPassword = process.env.TEST_CARETAKER_PASSWORD;

  if (!caretakerEmail || !caretakerPassword) {
    t.skip(
      "Set TEST_CARETAKER_EMAIL and TEST_CARETAKER_PASSWORD to an existing test caretaker account",
    );
    return;
  }

  const caretakerToken = await login(caretakerEmail, caretakerPassword);

  for (const path of [
    "/api/expenses",
    "/api/expenses/my",
    "/api/expenses/stats",
  ]) {
    const result = await request(path, {
      headers: auth(caretakerToken),
    });

    assert.equal(
      result.status,
      403,
      `${path} should reject caretakers: ${JSON.stringify(result.body)}`,
    );
  }
});
