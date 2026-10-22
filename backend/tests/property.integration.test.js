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
  title: `Automated Test Property ${randomUUID().slice(0, 8)}`,
  propertyType: "APARTMENT",
  address: {
    addressLine1: "101 Test Avenue",
    addressLine2: "",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    postalCode: "380001",
  },
  description: "Created by automated property integration tests",
  occupancy: "VACANT",
  condition: "GOOD",
});

let ownerToken;
let otherOwnerToken;

test("authenticate property test owners", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
  otherOwnerToken = await login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD);
});

test("property endpoints reject unauthenticated requests", async () => {
  const result = await request("/api/properties/my");
  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
});

test("owner can create a property with valid data", async () => {
  const payload = propertyPayload();

  const result = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.property.title, payload.title);
  assert.equal(result.body.data.property.propertyType, "APARTMENT");
  assert.equal(result.body.data.property.status, "ACTIVE");
  assert.equal(result.body.data.property.isActive, true);
  assert.ok(result.body.data.property._id);
});

test("property creation rejects missing required fields", async () => {
  const result = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({}),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("property creation rejects an invalid property type", async () => {
  const payload = propertyPayload();
  payload.propertyType = "SPACESHIP";

  const result = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("owner can list their active properties", async () => {
  const result = await request("/api/properties/my", {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.properties));
});

test("owner can retrieve their own property", async () => {
  const payload = propertyPayload();
  const created = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.property._id;

  const result = await request(`/api/properties/${id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.data.property._id, id);
});

test("owner cannot retrieve another owner's property", async () => {
  const payload = propertyPayload();
  const created = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${otherOwnerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(created.status, 201, JSON.stringify(created.body));
  const otherOwnerPropertyId = created.body.data.property._id;

  const result = await request(`/api/properties/${otherOwnerPropertyId}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
});

test("property endpoint rejects a malformed property ID", async () => {
  const result = await request("/api/properties/not-a-valid-id", {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("owner can update their property", async () => {
  const created = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.property._id;

  const result = await request(`/api/properties/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ title: "Updated Automated Property Title" }),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(
    result.body.data.property.title,
    "Updated Automated Property Title",
  );
});

test("owner can archive and restore their property", async () => {
  const created = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(created.status, 201, JSON.stringify(created.body));
  const id = created.body.data.property._id;

  const archived = await request(`/api/properties/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(archived.status, 200, JSON.stringify(archived.body));
  assert.equal(archived.body.success, true);

  const archivedLookup = await request(`/api/properties/${id}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(archivedLookup.status, 404);

  const restored = await request(`/api/properties/${id}/restore`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  assert.equal(restored.body.data.property.status, "ACTIVE");
  assert.equal(restored.body.data.property.isActive, true);
});
