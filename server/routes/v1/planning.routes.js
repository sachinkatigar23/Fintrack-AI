import express from "express";
import { body } from "express-validator";
import { safeToSpend, afford } from "../../controllers/planningController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { aiLimiter } from "../../middleware/rateLimiter.js";
import { EXPENSE_CATEGORIES } from "../../utils/constants.js";

const router = express.Router();

router.use(protect);

router.get("/safe-to-spend", safeToSpend);
router.post(
  "/afford",
  aiLimiter,
  body("title").trim().notEmpty().withMessage("What do you want to buy?").isLength({ max: 100 }).withMessage("Item name is too long")
    .customSanitizer((v) => String(v).replace(/[<>]/g, "")),
  body("amount").isFloat({ gt: 0, max: 100000000 }).withMessage("Price must be a number greater than 0").toFloat(),
  body("category").optional({ values: "falsy" }).isIn(EXPENSE_CATEGORIES).withMessage("Please choose a valid category"),
  validate,
  afford
);

export default router;
