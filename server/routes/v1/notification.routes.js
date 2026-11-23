import express from "express";
import { listNotifications, markRead, markAllRead, deleteNotification } from "../../controllers/notificationController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { idParam } from "../../validators/financeValidators.js";

const router = express.Router();

router.use(protect);
router.get("/", listNotifications);
router.put("/read-all", markAllRead);
router.put("/:id/read", idParam, validate, markRead);
router.delete("/:id", idParam, validate, deleteNotification);

export default router;
