const multer = require("multer");
const fs = require("fs");
const path = require("path");

/* ========= DIRECTORIES ========= */

// Product images
const TMP_UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "tmp");
const FINAL_DIR = path.join(__dirname, "..", "public", "uploads", "product-images");

// Profile images
const PROFILE_DIR = path.join(
  __dirname,
  "..",
  "public",
  "uploads",
  "profile-images"
);

// Create folders if not exist
[TMP_UPLOAD_DIR, FINAL_DIR, PROFILE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/* ========= PRODUCT IMAGE MULTER ========= */

const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  }
});

/* ========= PROFILE IMAGE MULTER ========= */

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROFILE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = "profile-" + req.user._id + "-" + Date.now();
    cb(null, unique + ext);
  }
});

/* ========= FILE FILTER ========= */

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG / PNG images allowed"), false);
  }
};

/* ========= EXPORTS ========= */

const uploads = multer({
  storage: productStorage,
  fileFilter
});

const profileUpload = multer({
  storage: profileStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

module.exports = {
  uploads,          // product images
  profileUpload,   // profile image
  TMP_UPLOAD_DIR,
  FINAL_DIR,
  PROFILE_DIR
};
