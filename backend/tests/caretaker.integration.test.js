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
  title: `Caretaker Test Property ${randomUUID().slice(0, 8)}`,
  propertyType: "APARTMENT",
  address: {
    addressLine1: "101 Test Avenue",
    addressLine2: "",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    postalCode: "380001",
  },
  description: "Created by caretaker integration tests",
  occupancy: "VACANT",
  condition: "GOOD",
});

const caretakerPayload = () => ({
  name: `Test Caretaker ${randomUUID().slice(0, 8)}`,
  email: `caretaker.${randomUUID()}@example.com`,
  password: "Caretaker@Test123",
  phone: "9876543210",
});

let ownerToken;
let otherOwnerToken;
let caretakerToken;
let caretakerId;
let caretakerEmail;
let propertyId;
let otherOwnerPropertyId;
let assignmentId;

test("authenticate the test owners", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
  otherOwnerToken = await login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD);
});

test("caretaker endpoints reject unauthenticated requests", async () => {
  const result = await request("/api/caretakers/my-properties");

  assert.equal(result.status, 401, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner can create a caretaker without exposing the password", async () => {
  const payload = caretakerPayload();
  caretakerEmail = payload.email;

  const result = await request("/api/caretakers/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  const caretaker = result.body.data.caretaker;

  assert.ok(caretaker.id);
  assert.equal(caretaker.name, payload.name);
  assert.equal(caretaker.email, payload.email);
  assert.equal(caretaker.role, "CARETAKER");
  assert.equal(caretaker.isActive, true);
  assert.equal(
    Object.hasOwn(caretaker, "password"),
    false,
    "Caretaker response must not include a password",
  );

  caretakerId = caretaker.id;
});

test("caretaker creation rejects missing required fields", async () => {
  const result = await request("/api/caretakers/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ name: "Incomplete Caretaker" }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("caretaker creation rejects an invalid email", async () => {
  const payload = caretakerPayload();
  payload.email = "not-an-email";

  const result = await request("/api/caretakers/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("caretaker creation rejects a duplicate email", async () => {
  const payload = caretakerPayload();
  payload.email = caretakerEmail;

  const result = await request("/api/caretakers/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 409, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner creates a property for caretaker assignment", async () => {
  const result = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));

  propertyId = result.body.data.property._id;
  assert.ok(propertyId);
});

test("another owner creates a separate property", async () => {
  const result = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${otherOwnerToken}` },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));

  otherOwnerPropertyId = result.body.data.property._id;
  assert.ok(otherOwnerPropertyId);
});

test("new caretaker can log in with the created credentials", async () => {
  caretakerToken = await login(caretakerEmail, "Caretaker@Test123");
});

test("caretaker role cannot create another caretaker", async () => {
  const result = await request("/api/caretakers/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify(caretakerPayload()),
  });

  assert.equal(result.status, 403, JSON.stringify(result.body));
});

test("owner can assign the caretaker to their property", async () => {
  const payload = {
    propertyId,
    caretakerId,
    responsibilities: [
      "Inspect the property weekly",
      "Report maintenance issues",
    ],
    notes: "Automated integration test assignment",
  };

  const result = await request("/api/caretakers/assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  const assignment = result.body.data.assignment;

  assert.ok(assignment._id);
  assert.equal(assignment.status, "ACTIVE");
  assert.deepEqual(assignment.responsibilities, payload.responsibilities);
  assert.equal(assignment.notes, payload.notes);
  assert.equal(assignment.caretaker._id, caretakerId);
  assert.equal(assignment.property._id, propertyId);

  assignmentId = assignment._id;
});

test("assignment rejects malformed IDs", async () => {
  const result = await request("/api/caretakers/assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      propertyId: "invalid-property-id",
      caretakerId,
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
});

test("assignment rejects an unknown caretaker", async () => {
  const result = await request("/api/caretakers/assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      propertyId,
      caretakerId: "000000000000000000000000",
    }),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
});

test("assignment rejects a caretaker assigned to another owner's property", async () => {
  const result = await request("/api/caretakers/assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      propertyId: otherOwnerPropertyId,
      caretakerId,
    }),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
});

test("assignment rejects invalid responsibilities", async () => {
  const result = await request("/api/caretakers/assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      propertyId,
      caretakerId,
      responsibilities: ["Inspect property", ""],
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
});

test("property cannot have a second active caretaker assignment", async () => {
  const result = await request("/api/caretakers/assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      propertyId,
      caretakerId,
    }),
  });

  assert.equal(result.status, 409, JSON.stringify(result.body));
});

test("owner can retrieve the current caretaker", async () => {
  const result = await request(
    `/api/caretakers/property/${propertyId}/current`,
    {
      headers: { Authorization: `Bearer ${ownerToken}` },
    },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.assignment.caretaker._id, caretakerId);
  assert.equal(result.body.data.assignment.status, "ACTIVE");
});

test("owner can retrieve property caretaker assignment history", async () => {
  const result = await request(`/api/caretakers/property/${propertyId}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.assignments));
  assert.ok(
    result.body.data.assignments.some(
      (assignment) => assignment._id === assignmentId,
    ),
  );
});

test("owner can retrieve caretaker assignment history", async () => {
  const result = await request(`/api/caretakers/${caretakerId}/history`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.assignments));
  assert.ok(
    result.body.data.assignments.some(
      (assignment) => assignment._id === assignmentId,
    ),
  );
});

test("caretaker can list assigned properties", async () => {
  const result = await request("/api/caretakers/my-properties", {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.assignments));
  assert.ok(
    result.body.data.assignments.some(
      (assignment) => assignment.property?._id === propertyId,
    ),
  );
});

test("caretaker can retrieve assigned property details", async () => {
  const result = await request(`/api/caretakers/my-properties/${propertyId}`, {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.property._id, propertyId);
  assert.equal(result.body.data.assignment.status, "ACTIVE");
});

test("caretaker cannot access a property they are not assigned to", async () => {
  const result = await request(
    `/api/caretakers/my-properties/${otherOwnerPropertyId}`,
    {
      headers: { Authorization: `Bearer ${caretakerToken}` },
    },
  );

  assert.equal(result.status, 403, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner cannot inspect another owner's property assignments", async () => {
  const result = await request(
    `/api/caretakers/property/${otherOwnerPropertyId}`,
    {
      headers: { Authorization: `Bearer ${ownerToken}` },
    },
  );

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner can end an active caretaker assignment", async () => {
  const result = await request(`/api/caretakers/property/${propertyId}/end`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.assignment.status, "COMPLETED");
  assert.ok(result.body.data.assignment.endDate);
});

test("ending the assignment clears the property's current caretaker", async () => {
  const result = await request(
    `/api/caretakers/property/${propertyId}/current`,
    {
      headers: { Authorization: `Bearer ${ownerToken}` },
    },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.assignment, null);
});

test("caretaker cannot access the property after assignment ends", async () => {
  const result = await request(`/api/caretakers/my-properties/${propertyId}`, {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  assert.equal(result.status, 403, JSON.stringify(result.body));
});

test("ending an already-ended assignment returns not found", async () => {
  const result = await request(`/api/caretakers/property/${propertyId}/end`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
});
