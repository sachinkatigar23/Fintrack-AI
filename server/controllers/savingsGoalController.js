import SavingsGoal from "../models/SavingsGoal.js";
import Expense from "../models/Expense.js";
import { notify, checkBudgetThresholds } from "../services/notificationService.js";
import { startOfDay } from "../utils/dates.js";
import { EXPENSE_CATEGORIES } from "../utils/constants.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const pick = (body) => {
  const allowed = ["name", "targetAmount", "savedAmount", "targetDate", "color"];
  const data = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  if (data.targetDate === "") data.targetDate = null;
  return data;
};

// active <-> completed follows the saved amount; archived goals keep their status
const withStatus = (goal) => {
  if (goal.status === "archived") return goal;
  goal.status = goal.savedAmount >= goal.targetAmount ? "completed" : "active";
  return goal;
};

const sameDay = (a, b) => Boolean(a && b) && startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();
const afterToday = (d) => startOfDay(new Date(d)) > startOfDay();
const DATE_MESSAGE = "Target date must be after today";

const completedNotice = (goal) =>
  notify(goal.user, {
    type: "goal",
    title: `Goal reached: ${goal.name} 🎉`,
    message: `You saved ₹${goal.savedAmount.toLocaleString("en-IN")} and completed this goal.`,
    link: "/savings-goals",
    key: `goal:${goal._id}:completed`,
  });

export const listGoals = async (req, res) => {
  try {
    const records = await SavingsGoal.find({ user: req.user.userId }).sort({ status: 1, createdAt: -1 });
    return res.json({ success: true, data: { records } });
  } catch (error) {
    console.error("List goals error:", error);
    return res.status(500).json({ success: false, message: "Unable to load savings goals" });
  }
};

export const createGoal = async (req, res) => {
  try {
    const data = pick(req.body);
    if (data.targetDate && !afterToday(data.targetDate)) return res.status(400).json({ success: false, message: DATE_MESSAGE });

    const goal = withStatus(new SavingsGoal({ ...data, user: req.user.userId }));
    await goal.save();
    if (goal.status === "completed") await completedNotice(goal);
    return res.status(201).json({ success: true, message: "Goal created", data: { record: goal } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateGoal = async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Savings goal not found" });

    const data = pick(req.body);
    // A past date is allowed only if it wasn't changed
    if (data.targetDate && !sameDay(data.targetDate, goal.targetDate) && !afterToday(data.targetDate)) {
      return res.status(400).json({ success: false, message: DATE_MESSAGE });
    }

    Object.assign(goal, data);
    withStatus(goal);
    await goal.save();
    if (goal.status === "completed") await completedNotice(goal);
    return res.json({ success: true, message: "Goal updated", data: { record: goal } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /savings-goals/:id/contribute  { amount, note }
export const addContribution = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Contribution must be greater than 0" });
    }
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Savings goal not found" });
    if (goal.status === "archived") return res.status(400).json({ success: false, message: "This goal was already used" });

    goal.savedAmount = round2(goal.savedAmount + amount);
    goal.contributions.push({ amount, type: "deposit", note: String(req.body.note || "").slice(0, 120) });
    withStatus(goal);
    await goal.save();
    if (goal.status === "completed") await completedNotice(goal);

    return res.json({ success: true, message: "Contribution added", data: { record: goal } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /savings-goals/:id/withdraw  { amount, note } - amount must be <= savedAmount
export const withdrawFromGoal = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Savings goal not found" });
    if (goal.status === "archived") return res.status(400).json({ success: false, message: "This goal was already used" });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    if (amount > goal.savedAmount) {
      return res.status(400).json({
        success: false,
        message: `You can withdraw at most ₹${goal.savedAmount.toLocaleString("en-IN")} from this goal`,
      });
    }

    goal.savedAmount = round2(goal.savedAmount - amount);
    goal.contributions.push({ amount, type: "withdrawal", note: String(req.body.note || "").slice(0, 120) });
    // Drops back to active when it is below the target again
    withStatus(goal);
    await goal.save();
    return res.json({ success: true, message: "Withdrawal recorded", data: { record: goal } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /savings-goals/:id/use  { createExpense, title, category, paymentMethod }
// "I bought the laptop": optionally records the expense, then archives the goal
export const useGoal = async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Savings goal not found" });
    if (goal.status === "archived") return res.status(400).json({ success: false, message: "This goal was already used" });

    let expense = null;
    if (req.body.createExpense !== false && goal.savedAmount > 0) {
      expense = await Expense.create({
        user: req.user.userId,
        title: String(req.body.title || goal.name).slice(0, 100),
        amount: goal.savedAmount,
        category: EXPENSE_CATEGORIES.includes(req.body.category) ? req.body.category : "Shopping",
        paymentMethod: req.body.paymentMethod || "upi",
        date: new Date(),
        notes: `Paid from savings goal "${goal.name}"`,
      });
      goal.usedExpense = expense._id;
      await checkBudgetThresholds(req.user.userId);
    }

    goal.status = "archived";
    goal.archivedAt = new Date();
    await goal.save();

    return res.json({
      success: true,
      message: expense ? `Goal used and ₹${goal.savedAmount.toLocaleString("en-IN")} recorded as an expense` : "Goal archived",
      data: { record: goal, expense },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteGoal = async (req, res) => {
  const record = await SavingsGoal.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!record) return res.status(404).json({ success: false, message: "Savings goal not found" });
  return res.json({ success: true, message: "Goal deleted" });
};
