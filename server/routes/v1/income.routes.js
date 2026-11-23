import express from "express";
import { createIncome, deleteIncome, getIncomes, updateIncome } from "../../controllers/incomeController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { createIncomeValidator, updateIncomeValidator, idParam } from "../../validators/financeValidators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(getIncomes).post(createIncomeValidator, validate, createIncome);
router.route("/:id").put(updateIncomeValidator, validate, updateIncome).delete(idParam, validate, deleteIncome);

export default router;
