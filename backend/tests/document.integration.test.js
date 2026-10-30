const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const documentStorage = require("../src/services/documentStorage");

const STORAGE_DIRECTORY =
  documentStorage.STORAGE_DIRECTORY ||
  path.resolve(__dirname, "../uploads/documents");

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
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
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
    response,
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

let uploadedDocumentId;
let uploadedPdfBuffer;

// ============================================================
// ENSURE SECOND OWNER PROPERTY EXISTS
// ============================================================

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
// FILE UPLOAD AND DOWNLOAD TESTS
// ============================================================

test("owner can upload a valid PDF to their own property", async () => {
  assert.ok(propertyId, "Owner property must exist before uploading");

  // Minimal PDF signature and content for file-type validation.
  uploadedPdfBuffer = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
    "utf8",
  );

  const form = new FormData();

  form.append("propertyId", propertyId);
  form.append("title", `Uploaded Test Document ${randomUUID().slice(0, 8)}`);
  form.append("category", "PROPERTY_DEED");
  form.append("description", "Uploaded by document integration tests");
  form.append("isSensitive", "false");

  form.append(
    "file",
    new Blob([uploadedPdfBuffer], { type: "application/pdf" }),
    "integration-test.pdf",
  );

  const result = await request("/api/documents/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: form,
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  const document = result.body.document || result.body.data?.document;

  assert.ok(document, "Uploaded document must be returned");

  uploadedDocumentId = document._id;

  assert.ok(uploadedDocumentId, "Uploaded document ID must exist");
  assert.equal(document.originalFileName, "integration-test.pdf");
  assert.equal(document.fileType, "PDF");
  assert.equal(document.fileSize, uploadedPdfBuffer.length);
  assert.ok(document.storageKey, "Storage key must exist");
  assert.equal(document.storageProvider, "LOCAL");
});

test("owner can download their uploaded PDF", async () => {
  assert.ok(uploadedDocumentId, "Upload a document before testing download");

  const response = await fetch(
    `${BASE_URL}/api/documents/${uploadedDocumentId}/download`,
    {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  );

  assert.equal(
    response.status,
    200,
    `Download failed with status ${response.status}`,
  );

  const downloadedBuffer = Buffer.from(await response.arrayBuffer());

  assert.deepEqual(
    downloadedBuffer,
    uploadedPdfBuffer,
    "Downloaded PDF should match the uploaded file",
  );
});

test("another owner cannot download the uploaded PDF", async () => {
  assert.ok(uploadedDocumentId, "Uploaded document ID must exist");

  const result = await request(
    `/api/documents/${uploadedDocumentId}/download`,
    {
      headers: {
        Authorization: `Bearer ${otherOwnerToken}`,
      },
    },
  );

  assert.equal(result.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("unauthenticated users cannot upload documents", async () => {
  const form = new FormData();

  form.append("propertyId", propertyId);
  form.append("title", "Unauthenticated Upload");
  form.append("category", "PROPERTY_DEED");

  form.append(
    "file",
    new Blob([uploadedPdfBuffer || Buffer.from("%PDF-1.4\n")], {
      type: "application/pdf",
    }),
    "unauthenticated.pdf",
  );

  const result = await request("/api/documents/upload", {
    method: "POST",
    body: form,
  });

  assert.equal(result.status, 401, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

test("unauthenticated users cannot download documents", async () => {
  assert.ok(uploadedDocumentId, "Uploaded document ID must exist");

  const result = await request(`/api/documents/${uploadedDocumentId}/download`);

  assert.equal(result.status, 401, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
});

// ============================================================
// FILE UPLOAD SECURITY TESTS
// ============================================================

test("upload rejects invalid PDF contents and cleans up the uploaded file", async () => {
  await documentStorage.ensureStorageDirectory();

  const filesBefore = (await fs.readdir(STORAGE_DIRECTORY)).sort();

  const form = new FormData();

  form.append("propertyId", propertyId);
  form.append("title", "Invalid PDF Test");
  form.append("category", "PROPERTY_DEED");

  form.append(
    "file",
    new Blob(["This is not a PDF file"], { type: "application/pdf" }),
    "invalid.pdf",
  );

  const result = await request("/api/documents/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: form,
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /contents do not match/i);

  const filesAfter = (await fs.readdir(STORAGE_DIRECTORY)).sort();

  assert.deepEqual(
    filesAfter,
    filesBefore,
    "Rejected PDF upload must not leave a file in document storage",
  );
});

test("upload rejects oversized files and cleans up any partial upload", async () => {
  await documentStorage.ensureStorageDirectory();

  const filesBefore = (await fs.readdir(STORAGE_DIRECTORY)).sort();

  const form = new FormData();

  form.append("propertyId", propertyId);
  form.append("title", "Oversized PDF Test");
  form.append("category", "PROPERTY_DEED");

  // Middleware limit is expected to be 10 MB.
  const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41);

  form.append(
    "file",
    new Blob([oversizedBuffer], { type: "application/pdf" }),
    "oversized.pdf",
  );

  const result = await request("/api/documents/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: form,
  });

  assert.equal(result.status, 413, JSON.stringify(result.body));
  assert.equal(result.body.success, false);

  const filesAfter = (await fs.readdir(STORAGE_DIRECTORY)).sort();

  assert.deepEqual(
    filesAfter,
    filesBefore,
    "Rejected oversized upload must not leave a partial file in document storage",
  );
});

test("upload rejects unsupported file extensions without storing a file", async () => {
  await documentStorage.ensureStorageDirectory();

  const filesBefore = (await fs.readdir(STORAGE_DIRECTORY)).sort();

  const form = new FormData();

  form.append("propertyId", propertyId);
  form.append("title", "Unsupported File Test");
  form.append("category", "PROPERTY_DEED");

  form.append(
    "file",
    new Blob(["not an allowed document"], {
      type: "application/octet-stream",
    }),
    "unsupported.exe",
  );

  const result = await request("/api/documents/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
    },
    body: form,
  });

  assert.equal(result.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.success, false);

  const filesAfter = (await fs.readdir(STORAGE_DIRECTORY)).sort();

  assert.deepEqual(
    filesAfter,
    filesBefore,
    "Unsupported upload must not leave a file in document storage",
  );
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
