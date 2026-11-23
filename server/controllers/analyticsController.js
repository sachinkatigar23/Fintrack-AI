import Budget from "../models/Budget.js";
import * as analytics from "../services/analyticsService.js";
import { periodRange, monthKey } from "../utils/dates.js";
import { EXPENSE_CATEGORIES } from "../utils/constants.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// GET /analytics?period=month|lastMonth|quarter|year|all
// Used by the Reports page and the AI Health Overview tab
export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const period = req.query.period || "all";
    const { start, end } = periodRange(period);

    const [income, expenses, categories, sources, trend, health] = await Promise.all([
      analytics.sumIncome(userId, start, end),
      analytics.sumExpenses(userId, start, end),
      analytics.getCategoryBreakdown(userId, start, end),
      analytics.getIncomeBreakdown(userId, start, end),
      analytics.getMonthlyTrend(userId, 6),
      analytics.getHealthScore(userId),
    ]);

    const totalIncome = income.total;
    const totalExpenses = expenses.total;

    return res.json({
      success: true,
      data: {
        period,
        totalIncome,
        totalExpenses,
        balance: round2(totalIncome - totalExpenses),
        savingsRate: totalIncome ? round2(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
        categories,
        sources,
        trend,
        healthScore: health.hasData ? health.score : null,
        healthData: health,
        recordCount: income.count + expenses.count,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return res.status(500).json({ success: false, message: "Unable to analyze your data" });
  }
};

// GET /analytics/anomalies - spending spikes, unusual transactions, money leaks
export const getAnomalies = async (req, res) => {
  try {
    const data = await analytics.getAnomaliesAndLeaks(req.user.userId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Anomalies error:", error);
    return res.status(500).json({ success: false, message: "Unable to check for anomalies" });
  }
};

// GET /analytics/goals - AI goal planner projections
export const getGoalProjections = async (req, res) => {
  try {
    const goals = await analytics.getSavingsGoalProjections(req.user.userId);
    const currentMonthlySavings = round2(await analytics.getSavings(req.user.userId));
    return res.json({ success: true, data: { goals, currentMonthlySavings } });
  } catch (error) {
    console.error("Goal projections error:", error);
    return res.status(500).json({ success: false, message: "Unable to plan goals" });
  }
};

// GET /analytics/budgets/recommend - smart budget suggestions
export const getBudgetRecs = async (req, res) => {
  try {
    const recommendations = await analytics.getBudgetRecommendations(req.user.userId);
    return res.json({ success: true, data: { recommendations, month: monthKey() } });
  } catch (error) {
    console.error("Budget recommendations error:", error);
    return res.status(500).json({ success: false, message: "Unable to recommend budgets" });
  }
};

// POST /analytics/budgets/apply - create/update this month's category budgets
export const applyBudgetRecs = async (req, res) => {
  try {
    const userId = req.user.userId;
    const month = monthKey();
    const recs = await analytics.getBudgetRecommendations(userId);
    let applied = 0;

    for (const r of recs) {
      if (!EXPENSE_CATEGORIES.includes(r.category)) continue;
      await Budget.findOneAndUpdate(
        { user: userId, month, category: r.category },
        // user, month and category come from the filter when a new budget is inserted
        { $set: { amount: r.suggestedLimit }, $setOnInsert: { name: `${r.category} budget` } },
        { upsert: true, runValidators: true }
      );
      applied += 1;
    }

    return res.json({ success: true, message: `${applied} budget(s) applied for ${month}`, data: { applied, month } });
  } catch (error) {
    console.error("Apply budgets error:", error);
    return res.status(500).json({ success: false, message: "Unable to apply budgets" });
  }
};
