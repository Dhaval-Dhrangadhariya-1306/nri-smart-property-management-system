const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5001";

const uniqueEmail = () => `auth-test-${randomUUID()}@example.com`;

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

const registerOwner = async (overrides = {}) => {
  const payload = {
    name: "Automated Test Owner",
    email: uniqueEmail(),
    password: "SecureTest@123",
    ...overrides,
  };

  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { ...result, payload };
};

// ============================================================
// REGISTRATION TESTS
// ============================================================

test("registration creates an owner and returns a token without a password", async () => {
  const result = await registerOwner();

  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.user.role, "NRI_OWNER");
  assert.ok(result.body.data.token);
  assert.equal("password" in result.body.data.user, false);
  assert.equal("password" in result.body.data, false);
});

test("registration normalizes email and name whitespace", async () => {
  const email = uniqueEmail();

  const result = await registerOwner({
    name: "  Test Owner  ",
    email: ` ${email.toUpperCase()} `,
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.data.user.name, "Test Owner");
  assert.equal(result.body.data.user.email, email);
});

test("registration rejects missing required fields", async () => {
  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({}),
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("registration rejects an invalid email", async () => {
  const result = await registerOwner({
    email: "not-an-email",
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("registration rejects a password shorter than eight characters", async () => {
  const result = await registerOwner({
    password: "short",
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("public registration cannot choose an administrator role", async () => {
  const result = await registerOwner({
    role: "ADMIN",
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.data.user.role, "NRI_OWNER");
});

test("registration rejects a duplicate email", async () => {
  const email = uniqueEmail();

  const first = await registerOwner({ email });
  assert.equal(first.status, 201);

  const second = await registerOwner({
    email: email.toUpperCase(),
  });

  assert.equal(second.status, 409);
  assert.equal(second.body.success, false);
});

// ============================================================
// LOGIN TESTS
// ============================================================

test("login accepts normalized email and returns a safe user response", async () => {
  const registration = await registerOwner();
  assert.equal(registration.status, 201);

  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: ` ${registration.payload.email.toUpperCase()} `,
      password: registration.payload.password,
    }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.ok(result.body.data.token);
  assert.equal("password" in result.body.data.user, false);
});

test("login rejects an incorrect password", async () => {
  const registration = await registerOwner();
  assert.equal(registration.status, 201);

  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: registration.payload.email,
      password: "WrongPassword@123",
    }),
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
});

test("login rejects a nonexistent account without revealing account existence", async () => {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: uniqueEmail(),
      password: "SecureTest@123",
    }),
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
  assert.equal(result.body.message, "Invalid email or password");
});

test("account is locked after five incorrect password attempts", async () => {
  const registration = await registerOwner();
  assert.equal(registration.status, 201);

  const email = registration.payload.email;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password: "WrongPassword@123",
      }),
    });

    assert.equal(result.status, 401, `Failed attempt ${attempt}`);
  }

  const lockedResult = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: registration.payload.password,
    }),
  });

  assert.equal(lockedResult.status, 423);
  assert.equal(lockedResult.body.success, false);
});

// ============================================================
// AUTHENTICATED USER TESTS
// ============================================================

test("current-user endpoint rejects requests without a token", async () => {
  const result = await request("/api/auth/me");

  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
});

test("current-user endpoint returns the authenticated user", async () => {
  const registration = await registerOwner();
  assert.equal(registration.status, 201);

  const result = await request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${registration.body.data.token}`,
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(
    result.body.data.user.email,
    registration.payload.email.toLowerCase(),
  );
  assert.equal(result.body.data.user.role, "NRI_OWNER");
  assert.equal("password" in result.body.data.user, false);
});

test("current-user endpoint rejects a token after tokenVersion changes", async () => {
  const registration = await registerOwner();
  assert.equal(registration.status, 201);

  const token = registration.body.data.token;
  const email = registration.payload.email;

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  // The token should initially be valid.
  const beforeChange = await request("/api/auth/me", {
    headers,
  });

  assert.equal(beforeChange.status, 200);

  // Increment tokenVersion through the test-only server endpoint.
  const update = await request("/__test/increment-token-version", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  assert.equal(update.status, 200);
  assert.equal(update.body.success, true);
  assert.equal(update.body.tokenVersion, 1);

  // The previously issued token must now be invalid.
  const afterChange = await request("/api/auth/me", {
    headers,
  });

  assert.equal(afterChange.status, 401);
  assert.equal(afterChange.body.success, false);
  assert.equal(
    afterChange.body.message,
    "Authentication session is no longer valid",
  );
});

// ============================================================
// DEVELOPMENT-ONLY ENDPOINT TEST
// ============================================================

test("development-only caretaker password reset is unavailable in the test environment", async () => {
  const result = await request("/api/auth/dev/reset-caretaker-password", {
    method: "POST",
    body: JSON.stringify({
      email: "caretaker.test@example.com",
      newPassword: "NewSecure@123",
    }),
  });

  assert.equal(result.status, 404);
  assert.equal(result.body.success, false);
});
