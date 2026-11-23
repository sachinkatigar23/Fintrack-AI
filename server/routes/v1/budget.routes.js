import express from "express";
import { listBudgets, createBudget, updateBudget, deleteBudget } from "../../controllers/budgetController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { budgetValidator, idParam } from "../../validators/financeValidators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listBudgets).post(budgetValidator(), validate, createBudget);
router.route("/:id").put(idParam, budgetValidator(true), validate, updateBudget).delete(idParam, validate, deleteBudget);

export default router;
