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
  body("openingBalance").optional({ values: "falsy" }).isFloat({ min: -100000000, max: 100000000 }).withMessage("Starting balance must be a number").toFloat(),
  body("salaryDay").optional({ values: "falsy" }).isInt({ min: 1, max: 31 }).withMessage("Salary day must be between 1 and 31").toInt(),
  body("safetyBuffer").optional({ values: "falsy" }).isFloat({ min: 0, max: 100000000 }).withMessage("Safety buffer can't be negative").toFloat(),
  validate,
  updateProfile
);
router.put("/preferences", updatePreferences);
router.post("/avatar", avatarUpload.single("avatar"), uploadAvatar);

export default router;
