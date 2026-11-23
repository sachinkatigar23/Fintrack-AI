import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import {
  getAnalytics,
  getAnomalies,
  getGoalProjections,
  getBudgetRecs,
  applyBudgetRecs,
} from "../../controllers/analyticsController.js";

const router = express.Router();

router.use(protect);
router.get("/", getAnalytics);
router.get("/anomalies", getAnomalies);
router.get("/goals", getGoalProjections);
router.get("/budgets/recommend", getBudgetRecs);
router.post("/budgets/apply", applyBudgetRecs);

export default router;
