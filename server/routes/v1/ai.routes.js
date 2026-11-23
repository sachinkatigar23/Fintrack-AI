import express from "express";
import {
  chatWithFinances,
  simulateWhatIf,
  generateMonthlyRecap,
  getMoneyBrief,
  getAIStatus,
  parseTransaction,
} from "../../controllers/aiController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { aiLimiter } from "../../middleware/rateLimiter.js";
import { validate } from "../../middleware/validate.js";
import { body } from "express-validator";

const router = express.Router();

router.use(protect);

router.get("/status", getAIStatus);
router.get("/brief", getMoneyBrief);
router.get("/recap", aiLimiter, generateMonthlyRecap);
router.post("/chat", aiLimiter, chatWithFinances);
router.post("/simulate", aiLimiter, simulateWhatIf);
router.post(
  "/parse-transaction",
  aiLimiter,
  body("text").isString().withMessage("Text is required").trim().notEmpty().withMessage("Say or type what you spent").isLength({ max: 300 }).withMessage("Keep it under 300 characters"),
  validate,
  parseTransaction
);

export default router;
