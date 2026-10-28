const { test, mock } = require("node:test");
const assert = require("node:assert/strict");

const cron = require("node-cron");
const logger = require("../src/utils/logger");

const JOB_TIMEZONE = process.env.JOB_TIMEZONE || "Asia/Kolkata";

const {
  startBackgroundJobs,
  stopBackgroundJobs,
} = require("../src/jobs/scheduler");

test("background scheduler uses the correct schedule and supports safe restart", () => {
  let scheduleCalls = 0;
  let stopCalls = 0;
  const scheduledTasks = [];

  const scheduleMock = mock.method(
    cron,
    "schedule",
    (expression, callback, options) => {
      scheduleCalls++;

      const task = {
        stop() {
          stopCalls++;
        },
      };

      scheduledTasks.push({ expression, callback, options, task });

      return task;
    },
  );

  mock.method(logger, "info", () => {});
  mock.method(logger, "warn", () => {});
  mock.method(logger, "error", () => {});

  try {
    // First start should register one scheduled task.
    startBackgroundJobs();

    assert.equal(scheduleCalls, 1);
    assert.equal(scheduledTasks[0].expression, "0 2 * * *");
    assert.equal(scheduledTasks[0].options.timezone, JOB_TIMEZONE);
    assert.equal(typeof scheduledTasks[0].callback, "function");

    // Starting again must not create a duplicate task.
    startBackgroundJobs();

    assert.equal(scheduleCalls, 1);

    // Stop should stop the task exactly once.
    stopBackgroundJobs();

    assert.equal(stopCalls, 1);

    // Stopping again should be safe.
    stopBackgroundJobs();

    assert.equal(stopCalls, 1);

    // Starting after stopping should register a new task.
    startBackgroundJobs();

    assert.equal(scheduleCalls, 2);
    assert.equal(scheduledTasks[1].expression, "0 2 * * *");
    assert.equal(scheduledTasks[1].options.timezone, JOB_TIMEZONE);

    stopBackgroundJobs();

    assert.equal(stopCalls, 2);
  } finally {
    // Ensure the scheduler and mocks are cleaned up.
    stopBackgroundJobs();
    mock.restoreAll();
  }
});
