import User from "../models/User.js";
import { storeFile } from "../services/storageService.js";

const safe = (user) => {
  const u = user.toObject();
  delete u.passwordHash;
  delete u.resetPasswordToken;
  delete u.resetPasswordExpires;
  return u;
};

// PUT /profile  { name, currency }
export const updateProfile = async (req, res) => {
  const updates = {};
  if (typeof req.body.name === "string") updates.name = req.body.name.trim();
  if (typeof req.body.currency === "string") updates.currency = req.body.currency.trim().toUpperCase().slice(0, 3);

  const user = await User.findByIdAndUpdate(req.user.userId, updates, { returnDocument: "after", runValidators: true });
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  return res.json({ success: true, message: "Profile updated", data: { user: safe(user) } });
};

// PUT /profile/preferences  { darkModePref }
export const updatePreferences = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { darkModePref: Boolean(req.body.darkModePref) },
    { returnDocument: "after" }
  );
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  return res.json({ success: true, data: { user: safe(user) } });
};

// POST /profile/avatar  (multipart, field "avatar")
export const uploadAvatar = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Please choose an image" });
  const avatarUrl = await storeFile(req.file, "avatars");
  const user = await User.findByIdAndUpdate(req.user.userId, { avatarUrl }, { returnDocument: "after" });
  return res.json({ success: true, message: "Profile photo updated", data: { user: safe(user) } });
};
