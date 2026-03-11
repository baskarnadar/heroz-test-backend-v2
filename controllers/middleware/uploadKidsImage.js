// middleware/uploadKidsImage.js

const multer = require("multer");
const path = require("path");

// store file in memory (you upload to S3 later)
const storage = multer.memoryStorage();

function isAllowedImage(file) {
  const mime = String(file?.mimetype || "").toLowerCase().trim();
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();

  // ✅ allow common image mimetypes
  const allowedMimes = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);

  // ✅ allow common extensions (fallback if mimetype is weird)
  const allowedExts = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".heif",
  ]);

  // Some clients send octet-stream but filename has .jpg/.png
  if (allowedMimes.has(mime)) return true;
  if (mime === "application/octet-stream" && allowedExts.has(ext)) return true;

  // If mimetype missing/unknown, still allow by extension
  if (!mime && allowedExts.has(ext)) return true;

  return false;
}

// optional validations
const uploadKidsImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, cb) => {
    if (isAllowedImage(file)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Only JPG/PNG/WEBP/HEIC images allowed. Got mimetype="${file?.mimetype}" name="${file?.originalname}"`
        ),
        false
      );
    }
  },
});

module.exports = uploadKidsImage;