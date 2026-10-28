const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const dns = require("node:dns");
const { randomUUID } = require("node:crypto");
const { DateTime } = require("luxon");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5001";
const OWNER_EMAIL = process.env.TEST_OWNER_EMAIL || "testnri@example.com";
const OWNER_PASSWORD = process.env.TEST_OWNER_PASSWORD || "Test@12345";
const TIMEZONE = process.env.JOB_TIMEZONE || "Asia/Kolkata";

const Document = require("../src/models/Document");
const Property = require("../src/models/Property");
const User = require("../src/models/User");
const Notification = require("../src/models/Notification");
const { runDocumentExpiryJob } = require("../src/jobs/documentExpiryJob");

const testId = randomUUID();
const createdDocumentIds = [];
let propertyId;
let ownerId;
let ownerToken;

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

const expiryDateAtOffset = (days) =>
  DateTime.now()
    .setZone(TIMEZONE)
    .startOf("day")
    .plus({ days, hours: 12 })
    .toJSDate();

const createTestDocument = async (title, expiryOffsetDays) => {
  // Create with a future date first because the Document schema rejects
  // past expiry dates during normal Mongoose validation.
  const document = await Document.create({
    property: propertyId,
    owner: ownerId,
    title: `${testId}-${title}`,
    category: "OTHER",
    description: "Automated document expiry regression test",
    fileUrl: `https://example.com/${testId}/${title}.pdf`,
    originalFileName: `${title}.pdf`,
    fileType: "PDF",
    fileSize: 1024,
    expiryDate: expiryDateAtOffset(60),
    status: "ACTIVE",
    isActive: true,
  });

  createdDocumentIds.push(document._id);

  // Simulate the relevant expiry date without bypassing validation on
  // normal document creation.
  await Document.collection.updateOne(
    { _id: document._id },
    { $set: { expiryDate: expiryDateAtOffset(expiryOffsetDays) } },
  );

  return document;
};

const findAutomationNotifications = (documentId) =>
  Notification.find({
    "metadata.documentId": documentId,
    "metadata.automationType": "DOCUMENT_EXPIRY",
  }).lean();

test.before(async () => {
  assert.equal(
    process.env.NODE_ENV,
    "test",
    "Refusing to run unless NODE_ENV=test. Use --env-file=.env.test.",
  );

  const mongoUri = process.env.MONGODB_URI;

  assert.ok(mongoUri, "MONGODB_URI must be set in .env.test");

  const databaseName = new URL(mongoUri).pathname.replace(/^\//, "");

  assert.equal(
    databaseName,
    "nri_property_test",
    `Refusing to run against database "${databaseName}".`,
  );

  // Helps resolve Atlas SRV records in environments where the default
  // DNS resolver has trouble resolving them.
  dns.setServers(["1.1.1.1", "8.8.8.8"]);

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  assert.equal(mongoose.connection.name, "nri_property_test");

  const loginResult = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    }),
  });

  assert.equal(
    loginResult.status,
    200,
    `Test owner login failed: ${JSON.stringify(loginResult.body)}`,
  );

  ownerToken = loginResult.body?.data?.token;
  assert.ok(ownerToken, "Login response must contain an authentication token");

  const owner = await User.findOne({
    email: OWNER_EMAIL.toLowerCase(),
  }).select("_id");

  assert.ok(owner, `Test owner ${OWNER_EMAIL} was not found in the test DB`);
  ownerId = owner._id;

  const propertyResult = await request("/api/properties", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      title: `Expiry Job Test Property ${testId.slice(0, 8)}`,
      propertyType: "APARTMENT",
      address: {
        addressLine1: "101 Test Avenue",
        addressLine2: "",
        city: "Ahmedabad",
        state: "Gujarat",
        country: "India",
        postalCode: "380001",
      },
      description: "Created for document expiry job regression tests",
      occupancy: "VACANT",
      condition: "GOOD",
    }),
  });

  assert.equal(
    propertyResult.status,
    201,
    `Test property creation failed: ${JSON.stringify(propertyResult.body)}`,
  );

  propertyId = propertyResult.body?.data?.property?._id;
  assert.ok(propertyId, "Property creation response must contain its ID");
});

test.after(async () => {
  try {
    if (createdDocumentIds.length > 0) {
      const ids = createdDocumentIds.map((id) => id.toString());

      await Notification.deleteMany({
        $or: [
          { "metadata.documentId": { $in: createdDocumentIds } },
          {
            "metadata.automationEventKey": {
              $regex: testId,
            },
          },
        ],
      });

      await Document.deleteMany({
        _id: { $in: createdDocumentIds },
      });
    }

    if (propertyId) {
      await Property.deleteOne({
        _id: propertyId,
        owner: ownerId,
      });
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
});

test("expiry job marks an overdue document expired and creates a notification", async () => {
  const document = await createTestDocument("overdue", -1);

  await runDocumentExpiryJob();

  const updatedDocument = await Document.findById(document._id).lean();

  assert.equal(updatedDocument.status, "EXPIRED");
  assert.equal(updatedDocument.isActive, true);

  const notifications = await findAutomationNotifications(document._id);

  assert.equal(
    notifications.length,
    1,
    "An overdue document should receive one expiry notification",
  );

  assert.equal(notifications[0].type, "DOCUMENT_EXPIRY");
  assert.equal(
    notifications[0].metadata.automationEventKey,
    `DOCUMENT_EXPIRED:${document._id}:${DateTime.fromJSDate(
      updatedDocument.expiryDate,
    )
      .setZone(TIMEZONE)
      .toISODate()}`,
  );
});

test("expiry job creates a notification for a document expiring today", async () => {
  const document = await createTestDocument("expires-today", 0);

  await runDocumentExpiryJob();

  const notifications = await findAutomationNotifications(document._id);

  assert.equal(
    notifications.length,
    1,
    "A document expiring today should receive one expiry notification",
  );

  assert.equal(
    notifications[0].metadata.automationEventKey,
    `DOCUMENT_EXPIRY:${document._id}:${DateTime.fromJSDate(
      expiryDateAtOffset(0),
    )
      .setZone(TIMEZONE)
      .toISODate()}:0`,
  );
});

test("expiry job does not duplicate an overdue notification when rerun", async () => {
  const document = await createTestDocument("overdue-deduplication", -1);

  await runDocumentExpiryJob();
  await runDocumentExpiryJob();

  const notifications = await findAutomationNotifications(document._id);

  assert.equal(
    notifications.length,
    1,
    "Rerunning the job must not create a duplicate notification",
  );

  const updatedDocument = await Document.findById(document._id).lean();
  assert.equal(updatedDocument.status, "EXPIRED");
});

test("expiry job retries notification creation after a failure", async () => {
  const document = await createTestDocument("notification-retry", -1);

  const persistedDocument = await Document.findById(document._id).lean();

  const expiryDateKey = DateTime.fromJSDate(persistedDocument.expiryDate)
    .setZone(TIMEZONE)
    .toISODate();

  const eventKey = `DOCUMENT_EXPIRED:${document._id}:${expiryDateKey}`;

  const originalCreate = Notification.create;
  let simulatedFailure = false;

  Notification.create = async function (...args) {
    const payload = args[0];

    if (
      !simulatedFailure &&
      payload?.metadata?.automationEventKey === eventKey
    ) {
      simulatedFailure = true;

      throw new Error("Simulated notification creation failure");
    }

    return originalCreate.apply(this, args);
  };

  try {
    // First run: notification creation fails.
    await runDocumentExpiryJob();

    assert.equal(
      simulatedFailure,
      true,
      "The test should simulate a notification creation failure",
    );

    const documentAfterFailure = await Document.findById(document._id).lean();

    assert.equal(
      documentAfterFailure.status,
      "ACTIVE",
      "Document must remain ACTIVE when notification creation fails",
    );

    let notifications = await findAutomationNotifications(document._id);

    assert.equal(
      notifications.length,
      0,
      "Failed notification creation must not leave a notification",
    );

    // Second run: notification creation should succeed.
    await runDocumentExpiryJob();

    const documentAfterRetry = await Document.findById(document._id).lean();

    assert.equal(
      documentAfterRetry.status,
      "EXPIRED",
      "Document should become EXPIRED after a successful retry",
    );

    notifications = await findAutomationNotifications(document._id);

    assert.equal(
      notifications.length,
      1,
      "Successful retry should create exactly one notification",
    );
  } finally {
    Notification.create = originalCreate;
  }
});
