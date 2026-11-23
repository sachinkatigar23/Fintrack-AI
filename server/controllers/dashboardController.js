import Expense from "../models/Expense.js";
import Income from "../models/Income.js";
import * as analytics from "../services/analyticsService.js";
import { monthRange, addMonths, startOfDay } from "../utils/dates.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Small 8-point trend lines for the summary cards (weekly totals)
const weeklySpark = (series, field) => {
  const weeks = [];
  for (let i = 0; i < series.length; i += 7) {
    weeks.push(series.slice(i, i + 7).reduce((s, d) => s + d[field], 0));
  }
  return weeks.slice(-8);
};

// GET /dashboard?month=YYYY-MM&range=7|30|90
export const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { start, end, key } = monthRange(req.query.month);
    const range = [7, 30, 90].includes(Number(req.query.range)) ? Number(req.query.range) : 30;

    const [
      income,
      expenses,
      available,
      goalReserve,
      incomeSources,
      categories,
      budgetPerf,
      upcomingBills,
      health,
      rhythm,
      spark56,
      streak,
      recentIncome,
      recentExpenses,
      prevExpenses,
    ] = await Promise.all([
      analytics.sumIncome(userId, start, end),
      analytics.sumExpenses(userId, start, end),
      analytics.getAvailableBalance(userId),
      analytics.getGoalReserve(userId),
      analytics.getIncomeBreakdown(userId, start, end),
      analytics.getCategoryBreakdown(userId, start, end),
      analytics.getBudgetPerformance(userId, key),
      analytics.getUpcomingBills(userId, 3),
      analytics.getHealthScore(userId, start),
      analytics.getDailySeries(userId, range, start),
      analytics.getDailySeries(userId, 56, start),
      analytics.getLoggingStreak(userId),
      Income.find({ user: userId }).sort({ date: -1, createdAt: -1 }).limit(5),
      Expense.find({ user: userId }).sort({ date: -1, createdAt: -1 }).limit(5),
      analytics.sumExpenses(userId, addMonths(start, -1), new Date(start.getTime() - 1)),
    ]);

    // Projection: if nothing more is spent this month, what is left?
    const projectedSavings = round2(income.total - expenses.total);
    const balanceSpark = (() => {
      const inc = weeklySpark(spark56, "income");
      const exp = weeklySpark(spark56, "expense");
      let running = 0;
      return inc.map((v, i) => (running += v - exp[i]));
    })();

    const recent = [
      ...recentIncome.map((x) => ({ ...x.toObject(), type: "income", classification: x.source })),
      ...recentExpenses.map((x) => ({ ...x.toObject(), type: "expense", classification: x.category })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    const topCategory = categories[0] || null;

    return res.json({
      success: true,
      data: {
        month: key,
        range,
        // Available balance = opening balance + all income - all expenses
        balance: available.balance,
        openingBalance: available.openingBalance,
        goalReserve,
        monthlyIncome: income.total,
        incomeCount: income.count,
        incomeSources: incomeSources.length,
        topIncomeSource: incomeSources[0]?.name || null,
        monthlyExpenses: expenses.total,
        expenseCount: expenses.count,
        spendPctOfIncome: income.total ? round2((expenses.total / income.total) * 100) : 0,
        lastMonthExpenses: prevExpenses.total,
        budget: budgetPerf.totalBudget,
        budgetRemaining: budgetPerf.totalBudget ? budgetPerf.remaining : null,
        budgetUsedPct: budgetPerf.overallUsedPct,
        budgetStatus: !budgetPerf.totalBudget
          ? "none"
          : budgetPerf.overallUsedPct >= 100
            ? "over"
            : budgetPerf.overallUsedPct >= 80
              ? "warning"
              : "under",
        sparks: {
          balance: balanceSpark,
          income: weeklySpark(spark56, "income"),
          expense: weeklySpark(spark56, "expense"),
          budget: weeklySpark(spark56, "expense").map((v) => -v),
        },
        rhythm,
        health: {
          score: health.score,
          hasData: health.hasData,
          savingsRate: health.savingsRate,
          positivePoints: health.positivePoints,
          attentionPoints: health.attentionPoints,
        },
        tiles: {
          monthSpend: expenses.total,
          budgetUsedPct: budgetPerf.overallUsedPct,
          hasBudget: budgetPerf.totalBudget > 0,
          topCategory: topCategory
            ? { name: topCategory.name, amount: topCategory.amount, pct: topCategory.pct }
            : null,
          upcomingBill: upcomingBills[0] || null,
          projectedSavings,
          projectedPct: income.total ? round2((projectedSavings / income.total) * 100) : 0,
        },
        streak,
        recent,
        upcomingBills,
        today: startOfDay(),
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ success: false, message: "Unable to load dashboard" });
  }
};
