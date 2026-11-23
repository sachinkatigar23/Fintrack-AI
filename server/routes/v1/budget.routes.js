import express from "express";
import { listBudgets, createBudget, updateBudget, deleteBudget, copyPrevious } from "../../controllers/budgetController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { budgetValidator, idParam, monthQuery } from "../../validators/financeValidators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listBudgets).post(budgetValidator(), validate, createBudget);
router.post("/copy-previous", monthQuery, validate, copyPrevious);
router.route("/:id").put(idParam, budgetValidator(true), validate, updateBudget).delete(idParam, validate, deleteBudget);

export default router;
