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
    title: `Maintenance Test Property ${randomUUID().slice(0, 8)}`,
    propertyType: "APARTMENT",
    address: {
      addressLine1: "101 Maintenance Test Avenue",
      addressLine2: "",
      city: "Ahmedabad",
      state: "Gujarat",
      country: "India",
      postalCode: "380001",
    },
    description: "Property created by maintenance integration tests",
    occupancy: "VACANT",
    condition: "GOOD",
  };
}

function caretakerPayload() {
  return {
    name: `Maintenance Caretaker ${randomUUID().slice(0, 8)}`,
    email: `maintenance.caretaker.${randomUUID()}@example.com`,
    password: "Caretaker@Test123",
    phone: "9876543210",
  };
}

function maintenancePayload(propertyId, overrides = {}) {
  return {
    propertyId,
    title: `Repair Request ${randomUUID().slice(0, 8)}`,
    description: "Repair a damaged electrical switch",
    category: "ELECTRICAL",
    priority: "HIGH",
    estimatedCost: 1500,
    images: [],
    notes: "Created by maintenance integration tests",
    ...overrides,
  };
}

let ownerToken;
let otherOwnerToken;
let caretakerToken;
let secondCaretakerToken;

let propertyId;
let otherOwnerPropertyId;
let secondCaretakerPropertyId;
let caretakerId;
let secondCaretakerId;
let unauthorizedTestRequestId;

let maintenanceRequestId;
let cancellationRequestId;

test("authenticate maintenance test users", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
  otherOwnerToken = await login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD);
});

test("maintenance endpoints reject unauthenticated requests", async () => {
  const result = await request("/api/maintenance/my");

  assert.equal(result.status, 401, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("create property and caretaker fixtures for maintenance tests", async () => {
  const caretakerData = caretakerPayload();

  const caretakerResult = await request("/api/caretakers/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(caretakerData),
  });

  assert.equal(
    caretakerResult.status,
    201,
    JSON.stringify(caretakerResult.body),
  );

  caretakerId = caretakerResult.body.data.caretaker.id;
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

  const assignmentResult = await request("/api/caretakers/assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      propertyId,
      caretakerId,
      responsibilities: [
        "Handle maintenance requests",
        "Report property issues",
      ],
      notes: "Maintenance integration test assignment",
    }),
  });

  assert.equal(
    assignmentResult.status,
    201,
    JSON.stringify(assignmentResult.body),
  );
  assert.equal(assignmentResult.body.data.assignment.status, "ACTIVE");

  caretakerToken = await login(caretakerData.email, caretakerData.password);

  assert.ok(caretakerToken);
});

test("owner cannot create a maintenance request without required fields", async () => {
  const result = await request("/api/maintenance", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({}),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("maintenance creation rejects a malformed property ID", async () => {
  const result = await request("/api/maintenance", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(maintenancePayload("invalid-property-id")),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("maintenance creation rejects negative estimated cost", async () => {
  const result = await request("/api/maintenance", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(
      maintenancePayload(propertyId, { estimatedCost: -100 }),
    ),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("maintenance creation rejects invalid images", async () => {
  const result = await request("/api/maintenance", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(
      maintenancePayload(propertyId, { images: ["", "valid.jpg"] }),
    ),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner cannot create maintenance for another owner's property", async () => {
  const result = await request("/api/maintenance", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(maintenancePayload(otherOwnerPropertyId)),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner creates a request assigned to the active caretaker", async () => {
  const payload = maintenancePayload(propertyId);

  const result = await request("/api/maintenance", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, "Maintenance request created successfully");

  const maintenanceRequest = result.body.data.maintenanceRequest;

  maintenanceRequestId = maintenanceRequest._id;

  assert.ok(maintenanceRequestId);
  assert.equal(maintenanceRequest.title, payload.title);
  assert.equal(maintenanceRequest.description, payload.description);
  assert.equal(maintenanceRequest.category, "ELECTRICAL");
  assert.equal(maintenanceRequest.priority, "HIGH");
  assert.equal(maintenanceRequest.status, "ASSIGNED");
  assert.equal(maintenanceRequest.estimatedCost, 1500);
  assert.equal(maintenanceRequest.actualCost, 0);
  assert.equal(maintenanceRequest.assignedCaretaker._id, caretakerId);
  assert.equal(maintenanceRequest.property._id, propertyId);
  assert.equal(maintenanceRequest.reportedBy.role, "NRI_OWNER");
  assert.ok(maintenanceRequest.assignedAt);
});

test("owner can list their maintenance requests", async () => {
  const result = await request("/api/maintenance/my", {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.maintenanceRequests));

  assert.ok(
    result.body.data.maintenanceRequests.some(
      (item) => item._id === maintenanceRequestId,
    ),
    "Created maintenance request should appear in the owner's list",
  );
});

test("owner can list maintenance requests for their property", async () => {
  const result = await request(`/api/maintenance/property/${propertyId}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.maintenanceRequests));

  assert.ok(
    result.body.data.maintenanceRequests.some(
      (item) => item._id === maintenanceRequestId,
    ),
  );
});

test("owner cannot list another owner's property maintenance", async () => {
  const result = await request(
    `/api/maintenance/property/${otherOwnerPropertyId}`,
    {
      headers: { Authorization: `Bearer ${ownerToken}` },
    },
  );

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner can retrieve their maintenance request", async () => {
  const result = await request(`/api/maintenance/${maintenanceRequestId}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.maintenanceRequest._id, maintenanceRequestId);
});

test("another owner cannot retrieve the maintenance request by ID", async () => {
  const result = await request(`/api/maintenance/${maintenanceRequestId}`, {
    headers: { Authorization: `Bearer ${otherOwnerToken}` },
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("caretaker can list maintenance requests assigned to them", async () => {
  const result = await request("/api/maintenance/caretaker/my", {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.maintenanceRequests));

  assert.ok(
    result.body.data.maintenanceRequests.some(
      (item) => item._id === maintenanceRequestId,
    ),
  );
});

test("owner role cannot access caretaker-only status endpoint", async () => {
  const result = await request(
    `/api/maintenance/${maintenanceRequestId}/status`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    },
  );

  assert.equal(result.status, 403, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("caretaker can move assigned request to IN_PROGRESS", async () => {
  const result = await request(
    `/api/maintenance/${maintenanceRequestId}/status`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${caretakerToken}` },
      body: JSON.stringify({
        status: "IN_PROGRESS",
        notes: "Repair work started",
      }),
    },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, "Maintenance status updated successfully");

  const maintenanceRequest = result.body.data.maintenanceRequest;

  assert.equal(maintenanceRequest.status, "IN_PROGRESS");
  assert.ok(maintenanceRequest.startedAt);
  assert.equal(maintenanceRequest.notes, "Repair work started");
});

test("caretaker can complete the request and record actual cost", async () => {
  const result = await request(
    `/api/maintenance/${maintenanceRequestId}/status`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${caretakerToken}` },
      body: JSON.stringify({
        status: "COMPLETED",
        actualCost: 1350,
        notes: "Repair completed successfully",
      }),
    },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  const maintenanceRequest = result.body.data.maintenanceRequest;

  assert.equal(maintenanceRequest.status, "COMPLETED");
  assert.equal(maintenanceRequest.actualCost, 1350);
  assert.equal(maintenanceRequest.notes, "Repair completed successfully");
  assert.ok(maintenanceRequest.startedAt);
  assert.ok(maintenanceRequest.completedAt);
});

test("completed maintenance request cannot be updated again", async () => {
  const result = await request(
    `/api/maintenance/${maintenanceRequestId}/status`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${caretakerToken}` },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    },
  );

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("maintenance status update rejects negative actual cost", async () => {
  const createResult = await request("/api/maintenance", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(maintenancePayload(propertyId)),
  });

  assert.equal(createResult.status, 201, JSON.stringify(createResult.body));

  const requestId = createResult.body.data.maintenanceRequest._id;

  const result = await request(`/api/maintenance/${requestId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      status: "IN_PROGRESS",
      actualCost: -1,
    }),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("caretaker cannot update a maintenance request assigned to another caretaker", async () => {
  const secondCaretakerData = caretakerPayload();

  const caretakerResult = await request("/api/caretakers/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(secondCaretakerData),
  });

  assert.equal(
    caretakerResult.status,
    201,
    JSON.stringify(caretakerResult.body),
  );

  secondCaretakerId = caretakerResult.body.data.caretaker.id;
  assert.ok(secondCaretakerId);

  const propertyResult = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(propertyResult.status, 201, JSON.stringify(propertyResult.body));

  secondCaretakerPropertyId = propertyResult.body.data.property._id;
  assert.ok(secondCaretakerPropertyId);

  const assignmentResult = await request("/api/caretakers/assign", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      propertyId: secondCaretakerPropertyId,
      caretakerId: secondCaretakerId,
      responsibilities: ["Handle maintenance requests"],
      notes: "Second caretaker authorization test",
    }),
  });

  assert.equal(
    assignmentResult.status,
    201,
    JSON.stringify(assignmentResult.body),
  );

  secondCaretakerToken = await login(
    secondCaretakerData.email,
    secondCaretakerData.password,
  );

  assert.ok(secondCaretakerToken);

  const createResult = await request("/api/maintenance", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(maintenancePayload(secondCaretakerPropertyId)),
  });

  assert.equal(createResult.status, 201, JSON.stringify(createResult.body));

  const createdRequest = createResult.body.data.maintenanceRequest;
  unauthorizedTestRequestId = createdRequest._id;

  assert.equal(createdRequest.status, "ASSIGNED");
  assert.equal(createdRequest.assignedCaretaker._id, secondCaretakerId);

  const updateResult = await request(
    `/api/maintenance/${unauthorizedTestRequestId}/status`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${caretakerToken}` },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    },
  );

  assert.equal(updateResult.status, 404, JSON.stringify(updateResult.body));
  assert.equal(updateResult.body.success, false);

  const detailResult = await request(
    `/api/maintenance/${unauthorizedTestRequestId}`,
    {
      headers: { Authorization: `Bearer ${ownerToken}` },
    },
  );

  assert.equal(detailResult.status, 200, JSON.stringify(detailResult.body));
  assert.equal(detailResult.body.data.maintenanceRequest.status, "ASSIGNED");
  assert.equal(
    detailResult.body.data.maintenanceRequest.assignedCaretaker._id,
    secondCaretakerId,
  );
});

test("owner can cancel their own open maintenance request", async () => {
  const createResult = await request("/api/maintenance", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify(maintenancePayload(propertyId)),
  });

  assert.equal(createResult.status, 201, JSON.stringify(createResult.body));

  cancellationRequestId = createResult.body.data.maintenanceRequest._id;

  const result = await request(
    `/api/maintenance/${cancellationRequestId}/cancel`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({}),
    },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(
    result.body.message,
    "Maintenance request cancelled successfully",
  );
  assert.equal(result.body.data.maintenanceRequest.status, "CANCELLED");
});

test("another owner cannot cancel someone else's maintenance request", async () => {
  const result = await request(
    `/api/maintenance/${cancellationRequestId}/cancel`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${otherOwnerToken}` },
      body: JSON.stringify({}),
    },
  );

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("cancelled maintenance request cannot be cancelled again", async () => {
  const result = await request(
    `/api/maintenance/${cancellationRequestId}/cancel`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({}),
    },
  );

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("maintenance lookup rejects a malformed request ID", async () => {
  const result = await request("/api/maintenance/not-a-valid-id", {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("maintenance lookup returns 404 for an unknown valid ID", async () => {
  const result = await request("/api/maintenance/000000000000000000000000", {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});
