import User from "../models/User.js";
import Expense from "../models/Expense.js";
import Income from "../models/Income.js";
import Budget from "../models/Budget.js";
import SavingsGoal from "../models/SavingsGoal.js";
import Bill from "../models/Bill.js";
import RecurringTransaction from "../models/RecurringTransaction.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import { audit } from "../services/auditService.js";
import { addDays } from "../utils/dates.js";

// GET /admin/stats - aggregate platform figures only (no personal finance details)
export const getStats = async (req, res) => {
  const since30 = addDays(new Date(), -30);
  const [users, admins, blocked, active30, newUsers30, expenseCount, incomeCount, expenseSum, incomeSum, recentActivity] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ isBlocked: true }),
      User.countDocuments({ lastLoginAt: { $gte: since30 } }),
      User.countDocuments({ createdAt: { $gte: since30 } }),
      Expense.countDocuments(),
      Income.countDocuments(),
      Expense.aggregate([{ $group: { _id: null, t: { $sum: "$amount" } } }]),
      Income.aggregate([{ $group: { _id: null, t: { $sum: "$amount" } } }]),
      AuditLog.find().sort({ createdAt: -1 }).limit(12).populate("user", "name email"),
    ]);

  return res.json({
    success: true,
    data: {
      users,
      admins,
      blocked,
      active30,
      newUsers30,
      transactions: expenseCount + incomeCount,
      expenseVolume: expenseSum[0]?.t || 0,
      incomeVolume: incomeSum[0]?.t || 0,
      recentActivity: recentActivity.map((a) => ({
        action: a.action,
        user: a.user ? `${a.user.name} (${a.user.email})` : "deleted user",
        at: a.createdAt,
      })),
    },
  });
};

// GET /admin/users?search=
export const listUsers = async (req, res) => {
  const search = req.query.search?.trim();
  const filter = search
    ? { $or: [{ name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] }
    : {};
  const users = await User.find(filter)
    .select("name email role currency isBlocked emailVerified lastLoginAt createdAt")
    .sort({ createdAt: -1 });

  // Record counts per user (activity, not amounts)
  const [exp, inc] = await Promise.all([
    Expense.aggregate([{ $group: { _id: "$user", n: { $sum: 1 } } }]),
    Income.aggregate([{ $group: { _id: "$user", n: { $sum: 1 } } }]),
  ]);
  const counts = {};
  [...exp, ...inc].forEach((r) => (counts[String(r._id)] = (counts[String(r._id)] || 0) + r.n));

  return res.json({
    success: true,
    data: { users: users.map((u) => ({ ...u.toObject(), records: counts[String(u._id)] || 0 })) },
  });
};

export const updateUserRole = async (req, res) => {
  if (String(req.params.id) === String(req.user.userId)) {
    return res.status(400).json({ success: false, message: "You cannot change your own role" });
  }
  if (!["user", "admin"].includes(req.body.role)) {
    return res.status(400).json({ success: false, message: "Role must be user or admin" });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { returnDocument: "after", runValidators: true })
    .select("name email role isBlocked");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  await audit(req, `admin:role:${req.body.role}`, req.user.userId, user.email);
  return res.json({ success: true, message: "Role updated", data: { user } });
};

// PUT /admin/users/:id/block  { blocked: true|false }
export const setBlocked = async (req, res) => {
  if (String(req.params.id) === String(req.user.userId)) {
    return res.status(400).json({ success: false, message: "You cannot block your own account" });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: Boolean(req.body.blocked) }, { returnDocument: "after" })
    .select("name email role isBlocked");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  await audit(req, user.isBlocked ? "admin:block" : "admin:unblock", req.user.userId, user.email);
  return res.json({ success: true, message: user.isBlocked ? "User blocked" : "User unblocked", data: { user } });
};

// DELETE /admin/users/:id - removes the account and all of its data
export const deleteUser = async (req, res) => {
  if (String(req.params.id) === String(req.user.userId)) {
    return res.status(400).json({ success: false, message: "You cannot delete your own account here" });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const owner = { user: user._id };
  await Promise.all([
    Expense.deleteMany(owner),
    Income.deleteMany(owner),
    Budget.deleteMany(owner),
    SavingsGoal.deleteMany(owner),
    Bill.deleteMany(owner),
    RecurringTransaction.deleteMany(owner),
    Notification.deleteMany(owner),
  ]);
  await user.deleteOne();
  await audit(req, "admin:delete-user", req.user.userId, user.email);

  return res.json({ success: true, message: "User and all their data deleted" });
};
