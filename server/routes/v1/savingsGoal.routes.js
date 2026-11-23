import express from "express";
import {
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  withdrawFromGoal,
  useGoal,
} from "../../controllers/savingsGoalController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { goalValidator, contributionValidator, useGoalValidator, idParam } from "../../validators/financeValidators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listGoals).post(goalValidator(), validate, createGoal);
router.route("/:id").put(idParam, goalValidator(true), validate, updateGoal).delete(idParam, validate, deleteGoal);
router.post("/:id/contribute", contributionValidator, validate, addContribution);
router.post("/:id/withdraw", contributionValidator, validate, withdrawFromGoal);
router.post("/:id/use", useGoalValidator, validate, useGoal);

export default router;
