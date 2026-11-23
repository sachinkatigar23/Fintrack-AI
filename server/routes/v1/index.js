import express from "express";
import authRoutes from "./auth.routes.js";
import expenseRoutes from "./expense.routes.js";
import incomeRoutes from "./income.routes.js";
import transactionRoutes from "./transaction.routes.js";
import budgetRoutes from "./budget.routes.js";
import savingsGoalRoutes from "./savingsGoal.routes.js";
import billRoutes from "./bill.routes.js";
import recurringRoutes from "./recurring.routes.js";
import notificationRoutes from "./notification.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import aiRoutes from "./ai.routes.js";
import profileRoutes from "./profile.routes.js";
import adminRoutes from "./admin.routes.js";
import planningRoutes from "./planning.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/expenses", expenseRoutes);
router.use("/income", incomeRoutes);
router.use("/transactions", transactionRoutes);
router.use("/budgets", budgetRoutes);
router.use("/savings-goals", savingsGoalRoutes);
router.use("/bills", billRoutes);
router.use("/recurring-transactions", recurringRoutes);
router.use("/notifications", notificationRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/ai", aiRoutes);
router.use("/profile", profileRoutes);
router.use("/admin", adminRoutes);
router.use("/planning", planningRoutes);

export default router;
