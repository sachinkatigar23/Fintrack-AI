import express from "express";
import { listBills, createBill, updateBill, deleteBill, payBill, unpayBill } from "../../controllers/billController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { billValidator, idParam } from "../../validators/financeValidators.js";

const router = express.Router();

router.use(protect);
router.route("/").get(listBills).post(billValidator(), validate, createBill);
router.route("/:id").put(idParam, billValidator(true), validate, updateBill).delete(idParam, validate, deleteBill);
router.post("/:id/pay", idParam, validate, payBill);
router.post("/:id/unpay", idParam, validate, unpayBill);

export default router;
