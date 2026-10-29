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

// ============================================================
// HTTP REQUEST HELPER
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

// ============================================================
// AUTHENTICATION HELPER
// ============================================================

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

  assert.ok(
    result.body?.data?.token,
    `Authentication token missing for ${email}`,
  );

  return result.body.data.token;
};

// ============================================================
// PROPERTY TEST PAYLOAD
// ============================================================

const propertyPayload = () => ({
  title: `Document Test Property ${randomUUID().slice(0, 8)}`,
  propertyType: "APARTMENT",
  address: {
    addressLine1: "101 Test Avenue",
    addressLine2: "",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    postalCode: "380001",
  },
  description: "Property created for document integration tests",
  occupancy: "VACANT",
  condition: "GOOD",
});

// ============================================================
// DOCUMENT TEST PAYLOAD
// ============================================================

const documentPayload = (overrides = {}) => ({
  propertyId,
  title: `Test Property Document ${randomUUID().slice(0, 8)}`,
  category: "PROPERTY_DEED",
  description: "Created by automated document integration tests",
  fileUrl: "https://example.com/test-property-document.pdf",
  originalFileName: "property-document.pdf",
  fileType: "PDF",
  fileSize: 1024,
  documentNumber: `DOC-${randomUUID().slice(0, 8)}`,
  issuedBy: "Test Authority",
  issueDate: "2025-01-15",
  expiryDate: "2035-01-15",
  isSensitive: false,
  ...overrides,
});

// ============================================================
// SHARED TEST DATA
// ============================================================

let ownerToken;
let otherOwnerToken;

let propertyId;
let otherOwnerPropertyId;
let documentId;

// ============================================================
// ENSURE SECOND OWNER PROPERTY EXISTS
// ============================================================

// This helper makes tests independent of the property-setup test.
// If the property has not been created, it creates one on demand.

const ensureOtherOwnerProperty = async () => {
  if (otherOwnerPropertyId) {
    return otherOwnerPropertyId;
  }

  assert.ok(
    otherOwnerToken,
    "Second owner must be authenticated before creating a property",
  );

  const result = await request("/api/properties", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${otherOwnerToken}`,
    },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(
    result.status,
    201,
    `Failed to create second owner's property: ${JSON.stringify(result.body)}`,
  );

  assert.equal(result.body.success, true);

  otherOwnerPropertyId = result.body?.data?.property?._id;

  assert.ok(
    otherOwnerPropertyId,
    `Second owner's property ID missing: ${JSON.stringify(result.body)}`,
  );

  return otherOwnerPropertyId;
};

// ============================================================
// AUTHENTICATION AND TEST DATA SETUP
// ============================================================

test("authenticate document test owners", async () => {
  ownerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
  otherOwnerToken = await login(OTHER_OWNER_EMAIL, OTHER_OWNER_PASSWORD);
});

test("document endpoints reject unauthenticated requests", async () => {
  const endpoints = ["/api/documents/my", "/api/documents/stats"];

  for (const endpoint of endpoints) {
    const result = await request(endpoint);

    assert.equal(
      result.status,
      401,
      `${endpoint}: ${JSON.stringify(result.body)}`,
    );

    assert.equal(result.body.success, false);
  }
});

test("create a property for the document owner", async () => {
  const result = await request("/api/properties", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  propertyId = result.body?.data?.property?._id;

  assert.ok(propertyId, `Property ID missing: ${JSON.stringify(result.body)}`);
});

test("create a property for the second owner", async () => {
  await ensureOtherOwnerProperty();
});

// ============================================================
// DOCUMENT CREATION
// ============================================================

test("owner can create a document for their own property", async () => {
  assert.ok(propertyId, "Owner property must exist before creating a document");

  const payload = documentPayload();

  const result = await request("/api/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  documentId = result.body?.document?._id;

  assert.ok(documentId, `Document ID missing: ${JSON.stringify(result.body)}`);

  assert.equal(result.body.document.title, payload.title);
  assert.equal(result.body.document.category, payload.category);

  const returnedPropertyId =
    result.body.document.property?._id ?? result.body.document.property;

  assert.equal(
    String(returnedPropertyId),
    String(propertyId),
    "Created document should belong to the owner's property",
  );
});

test("document creation rejects missing required fields", async () => {
  const result = await request("/api/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({}),
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("owner cannot create a document for another owner's property", async () => {
  await ensureOtherOwnerProperty();

  const payload = documentPayload({
    propertyId: otherOwnerPropertyId,
  });

  const result = await request("/api/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

// ============================================================
// DOCUMENT RETRIEVAL
// ============================================================

test("owner can list their documents", async () => {
  assert.ok(documentId, "Document must exist before listing documents");

  const result = await request("/api/documents/my", {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.documents));

  assert.ok(
    result.body.documents.some(
      (document) => String(document._id) === String(documentId),
    ),
    "The newly created document should appear in the owner's list",
  );
});

test("owner can retrieve documents for their property", async () => {
  assert.ok(propertyId, "Owner property must exist");

  const result = await request(`/api/documents/property/${propertyId}`, {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.documents));

  assert.ok(
    result.body.documents.some(
      (document) => String(document._id) === String(documentId),
    ),
    "The created document should appear in the property's documents",
  );
});

test("owner can retrieve their document by ID", async () => {
  assert.ok(documentId, "Document ID must exist");

  const result = await request(`/api/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  assert.equal(String(result.body.document._id), String(documentId));
});

test("owner cannot retrieve another owner's document", async () => {
  assert.ok(documentId, "Document ID must exist");

  const result = await request(`/api/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${otherOwnerToken}`,
    },
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("document endpoint rejects a malformed document ID", async () => {
  const result = await request("/api/documents/not-a-valid-id", {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

// ============================================================
// DOCUMENT STATISTICS
// ============================================================

test("owner can retrieve document statistics", async () => {
  const result = await request("/api/documents/stats", {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  assert.equal(typeof result.body.stats.totalDocuments, "number");

  assert.equal(typeof result.body.stats.sensitiveDocuments, "number");

  assert.equal(typeof result.body.stats.expiringSoon, "number");

  assert.ok(Array.isArray(result.body.stats.byCategory));
  assert.ok(Array.isArray(result.body.stats.byStatus));
});

test("owner can retrieve document statistics for their property", async () => {
  assert.ok(propertyId, "Owner property ID must exist");

  const result = await request(
    `/api/documents/stats?propertyId=${propertyId}`,
    {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  assert.equal(typeof result.body.stats.totalDocuments, "number");
});

test("owner cannot retrieve statistics for another owner's property", async () => {
  await ensureOtherOwnerProperty();

  const result = await request(
    `/api/documents/stats?propertyId=${otherOwnerPropertyId}`,
    {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

// ============================================================
// DOCUMENT UPDATE
// ============================================================

test("owner can update their document", async () => {
  assert.ok(documentId, "Document ID must exist before updating");

  const updatedTitle = `Updated Document ${randomUUID().slice(0, 8)}`;

  const result = await request(`/api/documents/${documentId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      title: updatedTitle,
      description: "Updated by automated document integration tests",
    }),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.document.title, updatedTitle);

  assert.equal(
    result.body.document.description,
    "Updated by automated document integration tests",
  );
});

test("owner cannot update another owner's document", async () => {
  assert.ok(documentId, "Document ID must exist");

  const result = await request(`/api/documents/${documentId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${otherOwnerToken}`,
    },
    body: JSON.stringify({
      title: "Unauthorized document update",
    }),
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

// ============================================================
// DOCUMENT ARCHIVING
// ============================================================

test("owner can archive their document", async () => {
  assert.ok(documentId, "Document ID must exist before archiving");

  const result = await request(`/api/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
});

test("archived document is no longer accessible by ID", async () => {
  assert.ok(documentId, "Document ID must exist");

  const result = await request(`/api/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
  });

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});
