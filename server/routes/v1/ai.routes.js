import express from "express";
import {
  chatWithFinances,
  simulateWhatIf,
  generateMonthlyRecap,
  getMoneyBrief,
  getAIStatus,
} from "../../controllers/aiController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { aiLimiter } from "../../middleware/rateLimiter.js";

const router = express.Router();

router.use(protect);

router.get("/status", getAIStatus);
router.get("/brief", getMoneyBrief);
router.get("/recap", aiLimiter, generateMonthlyRecap);
router.post("/chat", aiLimiter, chatWithFinances);
router.post("/simulate", aiLimiter, simulateWhatIf);

export default router;
