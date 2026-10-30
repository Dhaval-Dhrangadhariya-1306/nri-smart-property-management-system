const multer = require("multer");
const fs = require("node:fs/promises");
const path = require("node:path");
const documentStorage = require("../services/documentStorage");

// ============================================================
// CONFIGURATION
// ============================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = {
  ".pdf": {
    mime: "application/pdf",
    type: "PDF",
  },
  ".jpg": {
    mime: "image/jpeg",
    type: "JPG",
  },
  ".jpeg": {
    mime: "image/jpeg",
    type: "JPEG",
  },
  ".png": {
    mime: "image/png",
    type: "PNG",
  },
  ".webp": {
    mime: "image/webp",
    type: "WEBP",
  },
};

// ============================================================
// ERROR HELPER
// ============================================================

const createUploadError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ============================================================
// MULTER STORAGE
// ============================================================

const storage = multer.diskStorage({
  destination: async (req, file, callback) => {
    try {
      await documentStorage.ensureStorageDirectory();
      callback(null, documentStorage.STORAGE_DIRECTORY);
    } catch (error) {
      callback(error);
    }
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    // Generate a unique, server-controlled filename.
    const storageKey = `${documentStorage.createStorageKey()}${extension}`;

    // Retain the key so failed uploads can attempt cleanup,
    // even if Multer has not assigned the file to req.file.
    req._documentUploadStorageKey = storageKey;

    callback(null, storageKey);
  },
});

// ============================================================
// MULTER UPLOAD CONFIGURATION
// ============================================================

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 20,
    fieldSize: 16 * 1024, // 16 KB per field
  },

  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedType = ALLOWED_TYPES[extension];

    if (!allowedType || file.mimetype !== allowedType.mime) {
      return callback(
        createUploadError(
          "Unsupported file type. Upload a PDF, JPG, JPEG, PNG, or WEBP file.",
        ),
      );
    }

    callback(null, true);
  },
}).single("file");

// ============================================================
// FILE TYPE HELPER
// ============================================================

const getFileType = (filename) => {
  const extension = path.extname(filename).toLowerCase();

  return ALLOWED_TYPES[extension]?.type || null;
};

// ============================================================
// FILE SIGNATURE VALIDATION
// ============================================================

const validateFileSignature = async (file) => {
  const handle = await fs.open(file.path, "r");

  try {
    const buffer = Buffer.alloc(12);

    const { bytesRead } = await handle.read(
      buffer,
      0,
      buffer.length,
      0,
    );

    const bytes = buffer.subarray(0, bytesRead);
    const extension = path.extname(file.originalname).toLowerCase();

    // PDF signature: %PDF-
    if (extension === ".pdf") {
      return (
        bytes.length >= 5 &&
        bytes.subarray(0, 5).toString() === "%PDF-"
      );
    }

    // JPEG signature: FF D8 FF
    if (extension === ".jpg" || extension === ".jpeg") {
      return (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    }

    // PNG signature
    if (extension === ".png") {
      const pngSignature = Buffer.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      return (
        bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(pngSignature)
      );
    }

    // WEBP signature: RIFF....WEBP
    if (extension === ".webp") {
      return (
        bytes.length >= 12 &&
        bytes.subarray(0, 4).toString() === "RIFF" &&
        bytes.subarray(8, 12).toString() === "WEBP"
      );
    }

    return false;
  } finally {
    await handle.close();
  }
};

// ============================================================
// FILE CLEANUP HELPER
// ============================================================

const cleanupUploadedFile = async (storageKey) => {
  if (!storageKey) {
    return;
  }

  try {
    await documentStorage.deleteFile(storageKey);
  } catch (error) {
    // ENOENT means the file is already absent.
    // Other errors are logged because cleanup was unsuccessful.
    if (error.code !== "ENOENT") {
      console.error(
        "Failed to clean up uploaded document:",
        error.message,
      );
    }
  }
};

// ============================================================
// DOCUMENT UPLOAD MIDDLEWARE
// ============================================================

const handleDocumentUpload = (req, res, next) => {
  upload(req, res, async (uploadError) => {
    // --------------------------------------------------------
    // HANDLE MULTER ERRORS
    // --------------------------------------------------------

    if (uploadError) {
      const partialStorageKey = req._documentUploadStorageKey;

      // Attempt to remove any partially written file.
      await cleanupUploadedFile(partialStorageKey);

      delete req._documentUploadStorageKey;

      if (uploadError instanceof multer.MulterError) {
        const statusCode =
          uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400;

        const message =
          uploadError.code === "LIMIT_FILE_SIZE"
            ? "File exceeds the 10 MB upload limit"
            : uploadError.message;

        return next(createUploadError(message, statusCode));
      }

      return next(uploadError);
    }

    // --------------------------------------------------------
    // REQUIRE A FILE
    // --------------------------------------------------------

    if (!req.file) {
      delete req._documentUploadStorageKey;

      return next(
        createUploadError("A document file is required"),
      );
    }

    // Multer completed the upload. The file is now available
    // through req.file, so the temporary key is no longer needed.
    delete req._documentUploadStorageKey;

    // --------------------------------------------------------
    // VALIDATE FILE CONTENTS
    // --------------------------------------------------------

    try {
      const validSignature = await validateFileSignature(req.file);

      if (!validSignature) {
        await cleanupUploadedFile(req.file.filename);

        return next(
          createUploadError(
            "File contents do not match the declared file type",
          ),
        );
      }

      // ------------------------------------------------------
      // SANITIZE ORIGINAL FILENAME
      // ------------------------------------------------------

      const originalFileName = path
        .basename(req.file.originalname.replace(/\\/g, "/"))
        .replace(/[\x00-\x1f\x7f]/g, "")
        .slice(0, 255);

      // ------------------------------------------------------
      // ATTACH UPLOAD METADATA TO REQUEST
      // ------------------------------------------------------

      req.documentUpload = {
        storageKey: req.file.filename,
        storageProvider: "LOCAL",
        originalFileName,
        fileType: getFileType(req.file.originalname),
        fileSize: req.file.size,
        filePath: req.file.path,
      };

      return next();
    } catch (error) {
      // Remove the uploaded file if validation or processing fails.
      await cleanupUploadedFile(req.file.filename);

      return next(error);
    }
  });
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  handleDocumentUpload,
  MAX_FILE_SIZE,
};