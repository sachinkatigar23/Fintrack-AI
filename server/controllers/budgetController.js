import Budget from "../models/Budget.js";
import { getBudgetPerformance } from "../services/analyticsService.js";
import { checkBudgetThresholds } from "../services/notificationService.js";
import { budgetConsistency, copyPreviousBudgets, previousMonthKey } from "../services/budgetService.js";
import { monthKey, parseMonthKey } from "../utils/dates.js";

const pick = (body) => {
  const allowed = ["name", "amount", "category", "month", "repeat"];
  return Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
};

const duplicateMessage = (category, month) => `You already have a ${category} budget for ${month}. Edit it instead.`;

// GET /budgets?month=YYYY-MM  -> budgets with spent, remaining, % used and pace
export const listBudgets = async (req, res) => {
  try {
    const month = parseMonthKey(req.query.month) ? req.query.month : monthKey();
    const [perf, months, previousMonthCount] = await Promise.all([
      getBudgetPerformance(req.user.userId, month),
      // Months that have budgets (for the month switcher)
      Budget.distinct("month", { user: req.user.userId }),
      Budget.countDocuments({ user: req.user.userId, month: previousMonthKey(month) }),
    ]);

    return res.json({
      success: true,
      data: {
        records: perf.items,
        month,
        months: months.sort().reverse(),
        previousMonth: previousMonthKey(month),
        previousMonthCount,
        // Category budgets adding up to more than the Overall budget
        consistency: budgetConsistency(perf.items),
        summary: {
          totalBudget: perf.totalBudget,
          totalSpent: perf.trackedSpent,
          usedPct: perf.overallUsedPct,
          remaining: perf.remaining,
        },
      },
    });
  } catch (error) {
    console.error("List budgets error:", error);
    return res.status(500).json({ success: false, message: "Unable to load budgets" });
  }
};

export const createBudget = async (req, res) => {
  try {
    const data = pick(req.body);
    if (!data.month) data.month = monthKey();

    const exists = await Budget.findOne({ user: req.user.userId, month: data.month, category: data.category || "Overall" });
    if (exists) return res.status(409).json({ success: false, message: duplicateMessage(data.category || "Overall", data.month) });

    const record = await Budget.create({ ...data, user: req.user.userId });
    await checkBudgetThresholds(req.user.userId, parseMonthKey(record.month));
    return res.status(201).json({ success: true, message: "Budget created", data: { record } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateBudget = async (req, res) => {
  try {
    const record = await Budget.findOne({ _id: req.params.id, user: req.user.userId });
    if (!record) return res.status(404).json({ success: false, message: "Budget not found" });

    const data = pick(req.body);
    const month = data.month || record.month;
    const category = data.category || record.category;
    // Same user + month + category is blocked on update too
    const clash = await Budget.findOne({ user: req.user.userId, month, category, _id: { $ne: record._id } });
    if (clash) return res.status(409).json({ success: false, message: duplicateMessage(category, month) });

    Object.assign(record, data);
    await record.save();
    await checkBudgetThresholds(req.user.userId, parseMonthKey(record.month));
    return res.json({ success: true, message: "Budget updated", data: { record } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /budgets/copy-previous?month=YYYY-MM - copy last month's budgets into this month
export const copyPrevious = async (req, res) => {
  try {
    const month = parseMonthKey(req.query.month) ? req.query.month : monthKey();
    const created = await copyPreviousBudgets(req.user.userId, month);
    if (!created.length) {
      return res.status(400).json({ success: false, message: `Nothing to copy: ${previousMonthKey(month)} has no budgets that ${month} doesn't already have.` });
    }
    await checkBudgetThresholds(req.user.userId, parseMonthKey(month));
    return res.status(201).json({
      success: true,
      message: `${created.length} budget(s) copied from ${previousMonthKey(month)}`,
      data: { records: created, month },
    });
  } catch (error) {
    console.error("Copy budgets error:", error);
    return res.status(500).json({ success: false, message: "Unable to copy budgets" });
  }
};

export const deleteBudget = async (req, res) => {
  const record = await Budget.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!record) return res.status(404).json({ success: false, message: "Budget not found" });
  return res.json({ success: true, message: "Budget deleted" });
};
