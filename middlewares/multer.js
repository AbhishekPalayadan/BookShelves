const multer = require("multer");
const fs = require("fs");
const path = require("path");


const TMP_UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "tmp");
const FINAL_DIR = path.join(__dirname, "..", "public", "uploads", "product-images");


if (!fs.existsSync(TMP_UPLOAD_DIR)) {
    fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(FINAL_DIR)) {
    fs.mkdirSync(FINAL_DIR, { recursive: true });
}


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, TMP_UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + ext);
    }
});


const uploads = multer({
    storage,
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type"), false);
      }
    }
  });
  

module.exports = {
    uploads,
    TMP_UPLOAD_DIR,
    FINAL_DIR
};
