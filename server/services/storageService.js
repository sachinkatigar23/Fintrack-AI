import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

// Files are stored on Cloudinary when it is configured, otherwise they stay
// in server/uploads and are served at /uploads/...
const cloudinaryReady = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

let configured = false;
const configure = () => {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
};

/**
 * @param {Express.Multer.File} file - file saved by multer
 * @param {"receipts"|"avatars"} folder
 * @returns {Promise<string>} public URL (absolute for Cloudinary, "/uploads/..." for local)
 */
export const storeFile = async (file, folder) => {
  if (!cloudinaryReady()) return `/uploads/${folder}/${file.filename}`;

  try {
    configure();
    const result = await cloudinary.uploader.upload(file.path, {
      folder: `fintrack-ai/${folder}`,
      resource_type: "auto",
    });
    fs.unlink(file.path, () => {});
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload failed, keeping local copy:", error.message);
    return `/uploads/${folder}/${file.filename}`;
  }
};
