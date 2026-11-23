import express from "express";
import { body } from "express-validator";
import {
  listSubscriptions,
  dismissSubscription,
  restoreSubscription,
  setReminder,
  trackSubscription,
} from "../../controllers/subscriptionController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";

const router = express.Router();

const key = body("key").isString().withMessage("Subscription key is required").trim().notEmpty().withMessage("Subscription key is required").isLength({ max: 80 });

router.use(protect);
router.get("/", listSubscriptions);
router.post("/dismiss", key, validate, dismissSubscription);
router.post("/restore", key, validate, restoreSubscription);
router.post("/track", key, validate, trackSubscription);
router.post("/remind", key, body("remind").isBoolean().withMessage("remind must be true or false").toBoolean(), validate, setReminder);

export default router;
