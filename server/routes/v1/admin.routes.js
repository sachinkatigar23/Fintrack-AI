import express from "express";
import { getStats, listUsers, updateUserRole, setBlocked, deleteUser } from "../../controllers/adminController.js";
import { protect } from "../../middleware/auth.middleware.js";
import { authorizeRoles } from "../../middleware/role.middleware.js";
import { validate } from "../../middleware/validate.js";
import { idParam } from "../../validators/financeValidators.js";

const router = express.Router();

// Every admin route: must be logged in AND have the admin role
router.use(protect, authorizeRoles("admin"));

router.get("/stats", getStats);
router.get("/users", listUsers);
router.put("/users/:id/role", idParam, validate, updateUserRole);
router.put("/users/:id/block", idParam, validate, setBlocked);
router.delete("/users/:id", idParam, validate, deleteUser);

export default router;
