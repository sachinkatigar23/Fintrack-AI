import express from "express";
import { body } from "express-validator";
import { updateProfile, updatePreferences, uploadAvatar } from "../../controllers/profileController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { avatarUpload } from "../../middleware/upload.js";

const router = express.Router();

router.use(protect);

router.put(
  "/",
  body("name").optional().trim().isLength({ min: 2, max: 50 }).withMessage("Name must be between 2 and 50 characters"),
  body("currency").optional().trim().isLength({ min: 3, max: 3 }).withMessage("Currency must be a 3-letter code"),
  validate,
  updateProfile
);
router.put("/preferences", updatePreferences);
router.post("/avatar", avatarUpload.single("avatar"), uploadAvatar);

export default router;
