const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const STORAGE_DIRECTORY = path.resolve(__dirname, "../../../uploads/documents");

const createStorageKey = () => crypto.randomUUID();

const getFilePath = (storageKey) => {
  if (
    typeof storageKey !== "string" ||
    !/^[a-f0-9-]{36}\.(pdf|jpg|jpeg|png|webp)$/i.test(storageKey)
  ) {
    const error = new Error("Invalid document storage reference");
    error.statusCode = 400;
    throw error;
  }

  const filePath = path.resolve(STORAGE_DIRECTORY, storageKey);

  if (path.dirname(filePath) !== STORAGE_DIRECTORY) {
    const error = new Error("Invalid document storage reference");
    error.statusCode = 400;
    throw error;
  }

  return filePath;
};

const ensureStorageDirectory = async () => {
  await fs.mkdir(STORAGE_DIRECTORY, { recursive: true });
};

const deleteFile = async (storageKey) => {
  await fs.unlink(getFilePath(storageKey));
};

module.exports = {
  STORAGE_DIRECTORY,
  createStorageKey,
  getFilePath,
  ensureStorageDirectory,
  deleteFile,
};
