import express from "express";
import {
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  skipRecurring,
} from "../../controllers/recurringController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { recurringValidator, idParam } from "../../validators/financeValidators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listRecurring).post(recurringValidator(), validate, createRecurring);
router.route("/:id").put(idParam, recurringValidator(true), validate, updateRecurring).delete(idParam, validate, deleteRecurring);
router.post("/:id/skip", idParam, validate, skipRecurring);

export default router;
