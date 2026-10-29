const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5001";

const uniqueEmail = () => `notification-test-${randomUUID()}@example.com`;

// Generate a valid 24-character hexadecimal ID for nonexistent records.
const unknownObjectId = () => randomUUID().replace(/-/g, "").slice(0, 24);

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
// TEST HELPERS
// ============================================================

const registerOwner = async () => {
  const payload = {
    name: "Notification Test Owner",
    email: uniqueEmail(),
    password: "SecureTest@123",
  };

  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  const token = result.body.data.token;

  assert.ok(token, "Registration should return an authentication token");

  // Extract the user ID from the JWT payload.
  const tokenPayload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
  );

  assert.ok(tokenPayload.userId, "JWT should contain a userId");

  return {
    token,
    userId: tokenPayload.userId,
  };
};

const propertyPayload = () => ({
  title: `Notification Test Property ${randomUUID().slice(0, 8)}`,
  propertyType: "APARTMENT",
  address: {
    addressLine1: "101 Notification Test Avenue",
    addressLine2: "",
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    postalCode: "380001",
  },
  description: "Property created by notification integration tests",
  occupancy: "VACANT",
  condition: "GOOD",
});

let owner;
let otherOwner;
let propertyId;
let otherPropertyId;
let notificationId;

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

const createProperty = async (token) => {
  const result = await request("/api/properties", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(propertyPayload()),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.ok(result.body.data.property._id);

  return result.body.data.property._id;
};

const notificationPayload = (overrides = {}) => ({
  recipient: owner.userId,
  property: propertyId,
  type: "PROPERTY",
  priority: "MEDIUM",
  title: `Test notification ${randomUUID().slice(0, 8)}`,
  message: "This notification was created by an integration test.",
  ...overrides,
});

const createNotification = async (overrides = {}, token = owner.token) => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(notificationPayload(overrides)),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(result.body.notification._id);

  return result.body.notification;
};

// ============================================================
// TEST SETUP
// ============================================================

test("register two independent notification test owners", async () => {
  owner = await registerOwner();
  otherOwner = await registerOwner();

  propertyId = await createProperty(owner.token);
  otherPropertyId = await createProperty(otherOwner.token);

  assert.notEqual(owner.userId, otherOwner.userId);
  assert.notEqual(propertyId, otherPropertyId);
});

// ============================================================
// AUTHENTICATION
// ============================================================

test("notification endpoints reject unauthenticated requests", async () => {
  const paths = [
    "/api/notifications/my",
    "/api/notifications/unread",
    "/api/notifications/stats",
    "/api/notifications/read-all",
  ];

  for (const path of paths) {
    const result = await request(path);

    assert.equal(result.status, 401, `${path}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.success, false);
  }
});

test("notification creation rejects unauthenticated requests", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    body: JSON.stringify({
      recipient: owner.userId,
      property: propertyId,
      type: "PROPERTY",
      title: "Authentication test",
      message: "This request should be rejected.",
    }),
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
});

// ============================================================
// CREATE NOTIFICATIONS
// ============================================================

test("owner can create a notification for a recipient", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(notificationPayload()),
  });

  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, "Notification created successfully");
  assert.equal(result.body.notification.type, "PROPERTY");
  assert.equal(result.body.notification.isRead, false);
  assert.ok(result.body.notification._id);

  notificationId = result.body.notification._id;
});

test("notification creation rejects a missing recipient", async () => {
  const payload = notificationPayload();
  delete payload.recipient;

  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("notification creation rejects a malformed recipient ID", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(notificationPayload({ recipient: "not-a-valid-id" })),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("notification creation rejects a nonexistent recipient", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(
      notificationPayload({
        recipient: unknownObjectId(),
      }),
    ),
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
});

test("notification creation rejects a missing type", async () => {
  const payload = notificationPayload();
  delete payload.type;

  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("notification creation rejects an invalid type", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(notificationPayload({ type: "INVALID_TYPE" })),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("notification creation rejects a missing title", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(notificationPayload({ title: "   " })),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("notification creation rejects a missing message", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(notificationPayload({ message: "   " })),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("notification creation rejects an invalid priority", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(notificationPayload({ priority: "CRITICAL_INVALID" })),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("owner cannot create a notification for another owner's property", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(notificationPayload({ property: otherPropertyId })),
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.success, false);
});

test("owner cannot create a notification without specifying a property", async () => {
  const payload = notificationPayload();
  delete payload.property;

  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(payload),
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.success, false);
});

test("notification creation rejects an invalid expiry date", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(notificationPayload({ expiresAt: "not-a-date" })),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("notification creation rejects an expiry date in the past", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(
      notificationPayload({
        expiresAt: "2000-01-01T00:00:00.000Z",
      }),
    ),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

// ============================================================
// LIST AND RETRIEVE NOTIFICATIONS
// ============================================================

test("recipient can list their notifications", async () => {
  const result = await request("/api/notifications/my", {
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.notifications));

  assert.ok(
    result.body.notifications.some(
      (notification) => notification._id === notificationId,
    ),
  );
});

test("recipient can retrieve unread notifications", async () => {
  const result = await request("/api/notifications/unread", {
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.notifications));

  assert.ok(
    result.body.notifications.some(
      (notification) => notification._id === notificationId,
    ),
  );

  assert.ok(
    result.body.notifications.every(
      (notification) => notification.isRead === false,
    ),
  );
});

test("recipient can retrieve a notification by ID", async () => {
  const result = await request(`/api/notifications/${notificationId}`, {
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.notification._id, notificationId);
});

test("notification lookup rejects a malformed ID", async () => {
  const result = await request("/api/notifications/not-a-valid-id", {
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("notification lookup returns not found for an unknown valid ID", async () => {
  const result = await request(`/api/notifications/${unknownObjectId()}`, {
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
});

// ============================================================
// RECIPIENT DATA ISOLATION
// ============================================================

test("another owner cannot retrieve a recipient's notification", async () => {
  const result = await request(`/api/notifications/${notificationId}`, {
    headers: authHeaders(otherOwner.token),
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
});

test("another owner cannot mark a recipient's notification as read", async () => {
  const result = await request(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: authHeaders(otherOwner.token),
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
});

test("another owner cannot delete a recipient's notification", async () => {
  const result = await request(`/api/notifications/${notificationId}`, {
    method: "DELETE",
    headers: authHeaders(otherOwner.token),
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
});

test("owner cannot create a notification for another owner's property and recipient", async () => {
  const result = await request("/api/notifications", {
    method: "POST",
    headers: authHeaders(owner.token),
    body: JSON.stringify(
      notificationPayload({
        recipient: otherOwner.userId,
        property: otherPropertyId,
      }),
    ),
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.success, false);
});

// ============================================================
// MARK AS READ
// ============================================================

test("recipient can mark a notification as read", async () => {
  const result = await request(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.notification.isRead, true);
  assert.ok(result.body.notification.readAt);
});

test("marking an already-read notification is handled safely", async () => {
  const result = await request(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, "Notification is already marked as read");
});

test("mark-as-read rejects a malformed notification ID", async () => {
  const result = await request("/api/notifications/not-a-valid-id/read", {
    method: "PATCH",
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("recipient can mark all notifications as read", async () => {
  await createNotification();
  await createNotification({ priority: "HIGH" });

  const result = await request("/api/notifications/read-all", {
    method: "PATCH",
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, "All notifications marked as read");
  assert.ok(Number.isInteger(result.body.modifiedCount));

  const unread = await request("/api/notifications/unread", {
    headers: authHeaders(owner.token),
  });

  assert.equal(unread.status, 200);
  assert.equal(unread.body.success, true);
  assert.equal(
    unread.body.notifications.length,
    0,
    "No unread notifications should remain for this test owner",
  );
});

// ============================================================
// STATISTICS
// ============================================================

test("recipient can retrieve notification statistics", async () => {
  await createNotification({ type: "SYSTEM" });

  const result = await request("/api/notifications/stats", {
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);

  const stats = result.body.stats;

  assert.ok(Number.isInteger(stats.totalNotifications));
  assert.ok(Number.isInteger(stats.unreadNotifications));
  assert.ok(Number.isInteger(stats.readNotifications));
  assert.ok(Array.isArray(stats.byType));
  assert.ok(Array.isArray(stats.byPriority));

  assert.equal(
    stats.totalNotifications,
    stats.unreadNotifications + stats.readNotifications,
  );

  assert.ok(stats.byType.some((item) => item._id === "SYSTEM"));
});

// ============================================================
// DELETE NOTIFICATIONS
// ============================================================

test("recipient can delete their notification", async () => {
  const notification = await createNotification({
    title: "Notification to delete",
  });

  const result = await request(`/api/notifications/${notification._id}`, {
    method: "DELETE",
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, "Notification deleted successfully");
});

test("deleted notification can no longer be retrieved", async () => {
  const notification = await createNotification({
    title: "Notification that will be deleted",
  });

  const deleted = await request(`/api/notifications/${notification._id}`, {
    method: "DELETE",
    headers: authHeaders(owner.token),
  });

  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));

  const result = await request(`/api/notifications/${notification._id}`, {
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
});

test("deleting a notification twice returns not found", async () => {
  const notification = await createNotification({
    title: "Notification for repeated delete",
  });

  const first = await request(`/api/notifications/${notification._id}`, {
    method: "DELETE",
    headers: authHeaders(owner.token),
  });

  assert.equal(first.status, 200);

  const second = await request(`/api/notifications/${notification._id}`, {
    method: "DELETE",
    headers: authHeaders(owner.token),
  });

  assert.equal(second.status, 404);
  assert.equal(second.body.success, false);
});

test("notification deletion rejects a malformed ID", async () => {
  const result = await request("/api/notifications/not-a-valid-id", {
    method: "DELETE",
    headers: authHeaders(owner.token),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});
