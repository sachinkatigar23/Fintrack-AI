import express from "express";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  scanReceipt,
  uploadReceipt,
} from "../../controllers/expenseController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { receiptUpload } from "../../middleware/upload.js";
import { aiLimiter } from "../../middleware/rateLimiter.js";
import {
  createExpenseValidator,
  updateExpenseValidator,
  idParam,
} from "../../validators/financeValidators.js";

const router = express.Router();

// authentication first, validation second, controller third
router.use(protect);

router.route("/").get(getExpenses).post(createExpenseValidator, validate, createExpense);
router.post("/scan-receipt", aiLimiter, receiptUpload.single("receipt"), scanReceipt);
router.route("/:id").put(updateExpenseValidator, validate, updateExpense).delete(idParam, validate, deleteExpense);
router.post("/:id/receipt", idParam, validate, receiptUpload.single("receipt"), uploadReceipt);

export default router;
