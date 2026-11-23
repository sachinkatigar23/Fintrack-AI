import multer from "multer";
import fs from "fs";
import path from "path";

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storageFor = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureDir(path.resolve("uploads", folder))),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });

const imageOrPdf = (req, file, cb) => {
  const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
  cb(ok ? null : Object.assign(new Error("Only image or PDF files are allowed"), { status: 400, expose: true }), ok);
};

const imageOnly = (req, file, cb) => {
  const ok = file.mimetype.startsWith("image/");
  cb(ok ? null : Object.assign(new Error("Only image files are allowed"), { status: 400, expose: true }), ok);
};

// Receipts: images or PDF up to 5 MB
export const receiptUpload = multer({
  storage: storageFor("receipts"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageOrPdf,
});

// Avatars: images up to 2 MB
export const avatarUpload = multer({
  storage: storageFor("avatars"),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageOnly,
});
