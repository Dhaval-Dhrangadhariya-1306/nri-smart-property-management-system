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
    `Login failed for ${email}: ${JSON.stringify(result.body)}`,
  );

  assert.ok(result.body?.data?.token);

  return result.body.data.token;
};

const propertyPayload = () => ({
  title: `Monitoring Test Property ${randomUUID().slice(0, 8)}`,
  propertyType: "APARTMENT",
  address: {
    addressLine1: "101 Monitoring Test Avenue",
    addressLine2: "",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    postalCode: "380001",
  },
  description: "Created by monitoring integration tests",
  occupancy: "VACANT",
  condition: "GOOD",
});

const createProperty = async (token) => {
  const result = await request("/api/properties", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(
    result.status,
    201,
    `Property creation failed: ${JSON.stringify(result.body)}`,
  );

  assert.ok(result.body?.data?.property?._id);

  return result.body.data.property._id;
};

const eventPayload = (propertyId, overrides = {}) => ({
  propertyId,
  eventType: "WATER_LEAK",
  severity: "INFO",
  title: `Monitoring Event ${randomUUID().slice(0, 8)}`,
  description: "Created by automated monitoring integration tests",
  ...overrides,
});

let ownerToken;
let otherOwnerToken;
let caretakerToken;
let ownerPropertyId;
let otherOwnerPropertyId;
let createdEventId;
let resolutionEventId;

test("authenticate monitoring test owners and create test properties", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);

  otherOwnerToken = await login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD);

  ownerPropertyId = await createProperty(ownerToken);

  otherOwnerPropertyId = await createProperty(otherOwnerToken);

  const caretakerPassword = "Caretaker@Test123";

  const caretakerPayload = {
    name: `Monitoring Test Caretaker ${randomUUID().slice(0, 8)}`,
    email: `monitoring.caretaker.${randomUUID()}@example.com`,
    password: caretakerPassword,
    phone: "9876543210",
  };

  const caretakerResult = await request("/api/caretakers/create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(caretakerPayload),
  });

  assert.equal(
    caretakerResult.status,
    201,
    `Caretaker creation failed: ${JSON.stringify(caretakerResult.body)}`,
  );

  caretakerToken = await login(caretakerPayload.email, caretakerPassword);
});

test("monitoring endpoints reject unauthenticated requests", async () => {
  const results = await Promise.all([
    request("/api/monitoring/my"),

    request(`/api/monitoring/property/${ownerPropertyId}`),

    request("/api/monitoring", {
      method: "POST",
      body: JSON.stringify(eventPayload(ownerPropertyId)),
    }),
  ]);

  for (const result of results) {
    assert.equal(result.status, 401, JSON.stringify(result.body));
    assert.equal(result.body.success, false);
  }
});

test("owner can create a monitoring event", async () => {
  const payload = eventPayload(ownerPropertyId);

  const result = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  const event = result.body.data.event;

  assert.equal(event.title, payload.title);
  assert.equal(event.eventType, payload.eventType);
  assert.equal(event.severity, "INFO");
  assert.equal(event.source, "OWNER");
  assert.equal(event.isAcknowledged, false);
  assert.equal(event.isResolved, false);
  assert.ok(event._id);

  createdEventId = event._id;
});

test("event creation rejects missing required fields", async () => {
  const result = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({}),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /required/i);
});

test("event creation rejects an invalid property ID", async () => {
  const result = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(eventPayload("not-a-valid-object-id")),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /invalid property id/i);
});

test("owner cannot create an event for another owner's property", async () => {
  const result = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(eventPayload(otherOwnerPropertyId)),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("event creation rejects an invalid event type", async () => {
  const result = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(
      eventPayload(ownerPropertyId, {
        eventType: "INVALID_EVENT_TYPE",
      }),
    ),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("event creation rejects a title shorter than three characters", async () => {
  const result = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(
      eventPayload(ownerPropertyId, {
        title: "No",
      }),
    ),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /at least 3 characters/i);
});

test("event creation rejects a future occurrence date", async () => {
  const futureDate = new Date(Date.now() + 60_000).toISOString();

  const result = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(
      eventPayload(ownerPropertyId, {
        occurredAt: futureDate,
      }),
    ),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /cannot be in the future/i);
});

test("event creation rejects an invalid occurrence date", async () => {
  const result = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(
      eventPayload(ownerPropertyId, {
        occurredAt: "not-a-date",
      }),
    ),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /invalid occurredAt date/i);
});

test("owner cannot spoof the monitoring event source", async () => {
  const result = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(
      eventPayload(ownerPropertyId, {
        source: "SYSTEM",
      }),
    ),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.data.event.source, "OWNER");
});

test("owner can retrieve their monitoring events", async () => {
  const result = await request("/api/monitoring/my", {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.events));

  assert.ok(
    result.body.data.events.some((event) => event._id === createdEventId),
  );
});

test("owner can retrieve events for their own property", async () => {
  const result = await request(`/api/monitoring/property/${ownerPropertyId}`, {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data.events));

  assert.ok(
    result.body.data.events.some((event) => event._id === createdEventId),
  );
});

test("owner cannot retrieve another owner's property events", async () => {
  const result = await request(
    `/api/monitoring/property/${otherOwnerPropertyId}`,
    {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("property event endpoint rejects an invalid property ID", async () => {
  const result = await request("/api/monitoring/property/not-a-valid-id", {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /invalid property id/i);
});

test("owner cannot acknowledge another owner's monitoring event", async () => {
  const otherEvent = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${otherOwnerToken}`,
    },
    body: JSON.stringify(eventPayload(otherOwnerPropertyId)),
  });

  assert.equal(otherEvent.status, 201, JSON.stringify(otherEvent.body));

  const otherEventId = otherEvent.body.data.event._id;

  const result = await request(`/api/monitoring/${otherEventId}/acknowledge`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner can acknowledge a monitoring event", async () => {
  const result = await request(
    `/api/monitoring/${createdEventId}/acknowledge`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.event.isAcknowledged, true);
  assert.ok(result.body.data.event.acknowledgedAt);
});

test("an event cannot be acknowledged twice", async () => {
  const result = await request(
    `/api/monitoring/${createdEventId}/acknowledge`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /already acknowledged/i);
});

test("an event cannot be resolved before acknowledgment", async () => {
  const created = await request("/api/monitoring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(
      eventPayload(ownerPropertyId, {
        title: `Resolution Test ${randomUUID().slice(0, 8)}`,
      }),
    ),
  });

  assert.equal(created.status, 201, JSON.stringify(created.body));

  resolutionEventId = created.body.data.event._id;

  const result = await request(`/api/monitoring/${resolutionEventId}/resolve`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /must be acknowledged before/i);
});

test("an acknowledged event can be resolved", async () => {
  const acknowledged = await request(
    `/api/monitoring/${resolutionEventId}/acknowledge`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));

  const resolved = await request(
    `/api/monitoring/${resolutionEventId}/resolve`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  assert.equal(resolved.body.success, true);
  assert.equal(resolved.body.data.event.isAcknowledged, true);
  assert.equal(resolved.body.data.event.isResolved, true);
  assert.ok(resolved.body.data.event.resolvedAt);
});

test("an event cannot be resolved twice", async () => {
  const result = await request(`/api/monitoring/${resolutionEventId}/resolve`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /already resolved/i);
});

test("acknowledge and resolve reject invalid event IDs", async () => {
  const acknowledge = await request("/api/monitoring/not-valid/acknowledge", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  const resolve = await request("/api/monitoring/not-valid/resolve", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  for (const result of [acknowledge, resolve]) {
    assert.equal(result.status, 400, JSON.stringify(result.body));
    assert.equal(result.body.success, false);
    assert.match(result.body.message, /invalid event id/i);
  }
});

test("caretaker cannot access owner-only monitoring routes", async () => {
  assert.ok(caretakerToken, "Caretaker token should be available");

  const result = await request("/api/monitoring/my", {
    headers: {
      Authorization: `Bearer ${caretakerToken}`,
    },
  });

  assert.equal(result.status, 403, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});
