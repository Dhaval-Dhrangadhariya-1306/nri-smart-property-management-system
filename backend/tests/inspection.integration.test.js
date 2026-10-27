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
    body = null;
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

  assert.ok(result.body?.data?.token);
  return result.body.data.token;
}

function propertyPayload() {
  return {
    title: `Inspection Test Property ${randomUUID().slice(0, 8)}`,
    propertyType: "APARTMENT",
    address: {
      addressLine1: "101 Inspection Test Avenue",
      addressLine2: "",
      city: "Ahmedabad",
      state: "Gujarat",
      country: "India",
      postalCode: "380001",
    },
    description: "Property created by inspection integration tests",
    occupancy: "VACANT",
    condition: "GOOD",
  };
}

function caretakerPayload() {
  return {
    name: `Inspection Caretaker ${randomUUID().slice(0, 8)}`,
    email: `inspection.caretaker.${randomUUID()}@example.com`,
    password: "Caretaker@Test123",
    phone: "9876543210",
  };
}

function inspectionPayload(propertyId) {
  return {
    propertyId,
    overallCondition: "GOOD",
    securityStatus: "NORMAL",
    electricalStatus: "NORMAL",
    plumbingStatus: "NORMAL",
    cleanliness: "GOOD",
    issuesFound: ["Minor paint damage"],
    notes: "Automated inspection integration test",
    images: [],
  };
}

let ownerToken;
let otherOwnerToken;
let caretakerToken;
let caretakerId;
let propertyId;
let otherOwnerPropertyId;
let inspectionId;

test("authenticate inspection test users", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
  otherOwnerToken = await login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD);
});

test("inspection endpoints reject unauthenticated requests", async () => {
  const result = await request("/api/inspections/my");

  assert.equal(result.status, 401, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("create the property owner and caretaker test fixtures", async () => {
  const caretakerResult = await request("/api/caretakers/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(caretakerPayload()),
  });

  assert.equal(
    caretakerResult.status,
    201,
    JSON.stringify(caretakerResult.body),
  );

  caretakerId = caretakerResult.body.data.caretaker.id;
  const caretakerEmail = caretakerResult.body.data.caretaker.email;

  assert.ok(caretakerId);

  const propertyResult = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(propertyResult.status, 201, JSON.stringify(propertyResult.body));

  propertyId = propertyResult.body.data.property._id;
  assert.ok(propertyId);

  const otherPropertyResult = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${otherOwnerToken}` },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(
    otherPropertyResult.status,
    201,
    JSON.stringify(otherPropertyResult.body),
  );

  otherOwnerPropertyId = otherPropertyResult.body.data.property._id;
  assert.ok(otherOwnerPropertyId);

  const caretakerLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: caretakerEmail,
      password: "Caretaker@Test123",
    }),
  });

  assert.equal(caretakerLogin.status, 200, JSON.stringify(caretakerLogin.body));

  caretakerToken = caretakerLogin.body.data.token;
  assert.ok(caretakerToken);
});

test("owner assigns caretaker to the inspection test property", async () => {
  const result = await request("/api/caretakers/assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      propertyId,
      caretakerId,
      responsibilities: ["Inspect property", "Report maintenance issues"],
      notes: "Inspection integration test assignment",
    }),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.data.assignment.status, "ACTIVE");
});

test("non-caretaker role cannot create an inspection", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(inspectionPayload(propertyId)),
  });

  assert.equal(result.status, 403, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("inspection creation rejects missing required fields", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({}),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("inspection creation rejects an invalid property ID", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify(inspectionPayload("invalid-property-id")),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
});

test("inspection creation rejects a future inspection date", async () => {
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      ...inspectionPayload(propertyId),
      inspectedAt: futureDate,
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
});

test("inspection creation rejects a missing security status", async () => {
  const payload = inspectionPayload(propertyId);
  delete payload.securityStatus;

  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("inspection creation rejects an empty issue description", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      ...inspectionPayload(propertyId),
      issuesFound: ["   "],
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("inspection creation rejects an issue description exceeding 500 characters", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      ...inspectionPayload(propertyId),
      issuesFound: ["A".repeat(501)],
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("inspection creation rejects notes exceeding 2000 characters", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      ...inspectionPayload(propertyId),
      notes: "A".repeat(2001),
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("inspection creation rejects a non-string notes value", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      ...inspectionPayload(propertyId),
      notes: 12345,
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("inspection creation rejects an empty image path", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      ...inspectionPayload(propertyId),
      images: ["   "],
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("inspection creation rejects an image path exceeding 2000 characters", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      ...inspectionPayload(propertyId),
      images: ["A".repeat(2001)],
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("caretaker cannot inspect a property without an active assignment", async () => {
  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify(inspectionPayload(otherOwnerPropertyId)),
  });

  assert.equal(result.status, 403, JSON.stringify(result.body));
});

test("caretaker can create an inspection and update property health", async () => {
  const payload = inspectionPayload(propertyId);

  const result = await request("/api/inspections", {
    method: "POST",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, "Inspection created successfully");

  const inspection = result.body.data.inspection;

  inspectionId = inspection._id;

  assert.ok(inspectionId);
  assert.equal(inspection.overallCondition, "GOOD");
  assert.equal(inspection.securityStatus, "NORMAL");
  assert.equal(inspection.electricalStatus, "NORMAL");
  assert.equal(inspection.plumbingStatus, "NORMAL");
  assert.equal(inspection.cleanliness, "GOOD");
  assert.deepEqual(inspection.issuesFound, payload.issuesFound);
  assert.equal(inspection.notes, payload.notes);
  assert.equal(inspection.status, "COMPLETED");
  assert.equal(inspection.caretaker._id, caretakerId);
  assert.equal(inspection.property._id, propertyId);

  const propertyResult = await request(`/api/properties/${propertyId}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(propertyResult.status, 200, JSON.stringify(propertyResult.body));

  const property = propertyResult.body.data.property;

  assert.equal(property.condition, "GOOD");
  assert.equal(property.health.score, 93);
  assert.ok(property.lastInspectionAt);
});

test("caretaker can list their inspections", async () => {
  const result = await request("/api/inspections/my", {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.inspections));

  assert.ok(
    result.body.data.inspections.some(
      (inspection) => inspection._id === inspectionId,
    ),
    "The newly created inspection should appear in the caretaker's list",
  );
});

test("caretaker can retrieve inspections for their assigned property", async () => {
  const result = await request(`/api/inspections/property/${propertyId}`, {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.property._id, propertyId);

  assert.ok(
    result.body.data.inspections.some(
      (inspection) => inspection._id === inspectionId,
    ),
  );
});

test("caretaker cannot list inspections for an unassigned property", async () => {
  const result = await request(
    `/api/inspections/property/${otherOwnerPropertyId}`,
    {
      headers: { Authorization: `Bearer ${caretakerToken}` },
    },
  );

  assert.equal(result.status, 403, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("inspection lookup rejects a malformed inspection ID", async () => {
  const result = await request("/api/inspections/not-a-valid-id", {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("caretaker can retrieve their inspection by ID", async () => {
  const result = await request(`/api/inspections/${inspectionId}`, {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.inspection._id, inspectionId);
});

test("inspection lookup returns 404 for an unknown valid ID", async () => {
  const unknownId = "000000000000000000000000";

  const result = await request(`/api/inspections/${unknownId}`, {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});
