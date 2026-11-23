import Budget from "../models/Budget.js";
import { getBudgetPerformance } from "../services/analyticsService.js";
import { checkBudgetThresholds } from "../services/notificationService.js";
import { monthKey, parseMonthKey } from "../utils/dates.js";

const pick = (body) => {
  const allowed = ["name", "amount", "category", "month"];
  return Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
};

// GET /budgets?month=YYYY-MM  -> budgets with spent, remaining and % used
export const listBudgets = async (req, res) => {
  try {
    const month = parseMonthKey(req.query.month) ? req.query.month : monthKey();
    const perf = await getBudgetPerformance(req.user.userId, month);

    // Months that have budgets (for the month switcher)
    const months = await Budget.distinct("month", { user: req.user.userId });

    return res.json({
      success: true,
      data: {
        records: perf.items,
        month,
        months: months.sort().reverse(),
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
    if (exists) {
      return res.status(409).json({
        success: false,
        message: `You already have a ${data.category || "Overall"} budget for ${data.month}. Edit it instead.`,
      });
    }

    const record = await Budget.create({ ...data, user: req.user.userId });
    await checkBudgetThresholds(req.user.userId, parseMonthKey(record.month));
    return res.status(201).json({ success: true, message: "Budget created", data: { record } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateBudget = async (req, res) => {
  try {
    const record = await Budget.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      pick(req.body),
      { returnDocument: "after", runValidators: true }
    );
    if (!record) return res.status(404).json({ success: false, message: "Budget not found" });
    await checkBudgetThresholds(req.user.userId, parseMonthKey(record.month));
    return res.json({ success: true, message: "Budget updated", data: { record } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteBudget = async (req, res) => {
  const record = await Budget.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!record) return res.status(404).json({ success: false, message: "Budget not found" });
  return res.json({ success: true, message: "Budget deleted" });
};
