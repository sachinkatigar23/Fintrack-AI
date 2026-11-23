// ─────────────────────────────────────────────────────────────
// Analytics service
// All financial numbers in FinTrack AI are calculated HERE, from the
// user's own records. The AI layer only receives these verified figures
// and explains them - it never does the arithmetic itself.
// ─────────────────────────────────────────────────────────────
import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import Income from "../models/Income.js";
import Budget from "../models/Budget.js";
import Bill from "../models/Bill.js";
import SavingsGoal from "../models/SavingsGoal.js";
import User from "../models/User.js";
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  addDays,
  startOfDay,
  monthKey,
  monthRange,
} from "../utils/dates.js";
import { LEAK_MAX_AMOUNT, LEAK_MIN_COUNT } from "../utils/constants.js";

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const dateMatch = (start, end) => {
  if (!start && !end) return {};
  const date = {};
  if (start) date.$gte = start;
  if (end) date.$lte = end;
  return { date };
};

// ───────── Totals ─────────
export const sumIncome = async (userId, start, end) => {
  const r = await Income.aggregate([
    { $match: { user: oid(userId), ...dateMatch(start, end) } },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: round2(r[0]?.total), count: r[0]?.count || 0 };
};

export const sumExpenses = async (userId, start, end) => {
  const r = await Expense.aggregate([
    { $match: { user: oid(userId), ...dateMatch(start, end) } },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: round2(r[0]?.total), count: r[0]?.count || 0 };
};

// ───────── Balance (one definition everywhere) ─────────
// Available balance = opening balance + all income - all expenses
export const computeAvailableBalance = (openingBalance, totalIncome, totalExpenses) =>
  round2((Number(openingBalance) || 0) + (Number(totalIncome) || 0) - (Number(totalExpenses) || 0));

// The user's money settings (currency + Safe to spend settings), with defaults for older accounts
export const getMoneySettings = async (userId) => {
  const u = await User.findById(userId).select("currency openingBalance salaryDay safetyBuffer").lean();
  return {
    currency: u?.currency || "INR",
    openingBalance: Number(u?.openingBalance) || 0,
    salaryDay: Number(u?.salaryDay) || 1,
    safetyBuffer: Math.max(0, Number(u?.safetyBuffer) || 0),
  };
};

// Money that goals hold: still in the account but not spendable (archived goals are spent/closed)
export const getGoalReserve = async (userId) => {
  const r = await SavingsGoal.aggregate([
    { $match: { user: oid(userId), status: { $in: ["active", "completed"] } } },
    { $group: { _id: null, total: { $sum: "$savedAmount" } } },
  ]);
  return round2(r[0]?.total);
};

export const getAvailableBalance = async (userId) => {
  const [settings, income, expenses] = await Promise.all([getMoneySettings(userId), sumIncome(userId), sumExpenses(userId)]);
  return {
    balance: computeAvailableBalance(settings.openingBalance, income.total, expenses.total),
    openingBalance: settings.openingBalance,
    totalIncome: income.total,
    totalExpenses: expenses.total,
    incomeCount: income.count,
  };
};

export const getMonthlyIncome = async (userId, ref = new Date()) =>
  (await sumIncome(userId, startOfMonth(ref), endOfMonth(ref))).total;

export const getMonthlyExpenses = async (userId, ref = new Date()) =>
  (await sumExpenses(userId, startOfMonth(ref), endOfMonth(ref))).total;

export const getSavings = async (userId, ref = new Date()) =>
  (await getMonthlyIncome(userId, ref)) - (await getMonthlyExpenses(userId, ref));

// Savings rate (%) for a month = (income - expenses) / income
export const getSavingsRate = async (userId, ref = new Date()) => {
  const income = await getMonthlyIncome(userId, ref);
  if (income === 0) return 0;
  const expenses = await getMonthlyExpenses(userId, ref);
  return Math.max(0, ((income - expenses) / income) * 100);
};

// ───────── Breakdowns ─────────
export const getCategoryBreakdown = async (userId, start, end) => {
  const rows = await Expense.aggregate([
    { $match: { user: oid(userId), ...dateMatch(start, end) } },
    { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  const grand = rows.reduce((s, r) => s + r.total, 0);
  return rows.map((r) => ({
    name: r._id,
    amount: round2(r.total),
    count: r.count,
    pct: grand ? round2((r.total / grand) * 100) : 0,
  }));
};

export const getIncomeBreakdown = async (userId, start, end) => {
  const rows = await Income.aggregate([
    { $match: { user: oid(userId), ...dateMatch(start, end) } },
    { $group: { _id: "$source", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  return rows.map((r) => ({ name: r._id, amount: round2(r.total), count: r.count }));
};

// Income vs expense for each of the last `months` months (oldest first)
export const getMonthlyTrend = async (userId, months = 6) => {
  const from = startOfMonth(addMonths(new Date(), -(months - 1)));
  const group = { _id: { y: { $year: "$date" }, m: { $month: "$date" } }, total: { $sum: "$amount" } };
  const [inc, exp] = await Promise.all([
    Income.aggregate([{ $match: { user: oid(userId), date: { $gte: from } } }, { $group: group }]),
    Expense.aggregate([{ $match: { user: oid(userId), date: { $gte: from } } }, { $group: group }]),
  ]);
  const key = (r) => `${r._id.y}-${String(r._id.m).padStart(2, "0")}`;
  const incMap = Object.fromEntries(inc.map((r) => [key(r), r.total]));
  const expMap = Object.fromEntries(exp.map((r) => [key(r), r.total]));

  return Array.from({ length: months }, (_, i) => {
    const d = addMonths(from, i);
    const k = monthKey(d);
    const income = round2(incMap[k]);
    const expense = round2(expMap[k]);
    return {
      month: k,
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      income,
      expense,
      savings: round2(income - expense),
    };
  });
};

// Daily income & expense for the last `days` days (Spending Rhythm chart)
export const getDailySeries = async (userId, days = 30, endRef = new Date()) => {
  const end = endOfMonth(endRef) < new Date() ? endOfMonth(endRef) : new Date();
  const start = startOfDay(addDays(end, -(days - 1)));
  const group = {
    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: process.env.TZ || "Asia/Kolkata" } },
    total: { $sum: "$amount" },
  };
  const [inc, exp] = await Promise.all([
    Income.aggregate([{ $match: { user: oid(userId), date: { $gte: start, $lte: end } } }, { $group: group }]),
    Expense.aggregate([{ $match: { user: oid(userId), date: { $gte: start, $lte: end } } }, { $group: group }]),
  ]);
  const incMap = Object.fromEntries(inc.map((r) => [r._id, r.total]));
  const expMap = Object.fromEntries(exp.map((r) => [r._id, r.total]));

  return Array.from({ length: days }, (_, i) => {
    const d = addDays(start, i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      date: k,
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      expense: round2(expMap[k]),
      income: round2(incMap[k]),
    };
  });
};

// ───────── Budgets ─────────
// Spent / remaining / % used for every budget of a month
export const getBudgetPerformance = async (userId, key = monthKey()) => {
  const { start, end } = monthRange(key);
  const budgets = await Budget.find({ user: userId, month: key }).sort({ createdAt: -1 });

  const rows = await Expense.aggregate([
    { $match: { user: oid(userId), date: { $gte: start, $lte: end } } },
    { $group: { _id: "$category", spent: { $sum: "$amount" } } },
  ]);
  const spentBy = Object.fromEntries(rows.map((r) => [r._id, r.spent]));
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  const items = budgets.map((b) => {
    const spent = round2(b.category === "Overall" ? totalSpent : spentBy[b.category] || 0);
    const usedPct = b.amount ? (spent / b.amount) * 100 : 0;
    return {
      ...b.toObject(),
      spentAmount: spent,
      remaining: round2(b.amount - spent),
      usedPct: round2(usedPct),
      status: usedPct >= 100 ? "over" : usedPct >= 80 ? "warning" : "ok",
    };
  });

  // Total limit: an "Overall" budget wins; otherwise the sum of category budgets
  const overall = items.find((b) => b.category === "Overall");
  const totalBudget = overall ? overall.amount : items.reduce((s, b) => s + b.amount, 0);
  const trackedSpent = overall
    ? totalSpent
    : items.reduce((s, b) => s + b.spentAmount, 0);

  return {
    month: key,
    totalBudget: round2(totalBudget),
    totalSpent: round2(totalSpent),
    trackedSpent: round2(trackedSpent),
    overallUsedPct: totalBudget > 0 ? round2((trackedSpent / totalBudget) * 100) : 0,
    remaining: totalBudget > 0 ? round2(totalBudget - trackedSpent) : null,
    items,
    // kept for older callers
    categories: items.map((b) => ({ category: b.category, limit: b.amount, spent: b.spentAmount, usedPct: b.usedPct })),
  };
};

// ───────── Bills ─────────
export const getUpcomingBills = async (userId, limit = 3) =>
  Bill.find({ user: userId, status: "pending", dueDate: { $gte: startOfDay() } })
    .sort({ dueDate: 1 })
    .limit(limit);

export const getOverdueBills = async (userId) =>
  Bill.find({ user: userId, status: "pending", dueDate: { $lt: startOfDay() } }).sort({ dueDate: 1 });

// ───────── Health score (explainable) ─────────
// Base 50, + half the savings rate (max +50), +10 if within budget,
// minus the % over budget, -5 per overdue bill. Clamped to 0..100.
export const getHealthScore = async (userId, ref = new Date()) => {
  const key = monthKey(ref);
  const [income, expenses, budgetPerf, upcomingBills, overdueBills] = await Promise.all([
    getMonthlyIncome(userId, ref),
    getMonthlyExpenses(userId, ref),
    getBudgetPerformance(userId, key),
    getUpcomingBills(userId, 10),
    getOverdueBills(userId),
  ]);

  const savingsRate = income > 0 ? Math.max(0, ((income - expenses) / income) * 100) : 0;

  let score = 50;
  const factors = [];

  if (income > 0) {
    score += savingsRate / 2;
    factors.push({ label: "Savings rate", impact: round2(savingsRate / 2), value: `${savingsRate.toFixed(1)}%` });
  }
  if (budgetPerf.totalBudget > 0) {
    if (budgetPerf.overallUsedPct <= 100) {
      score += 10;
      factors.push({ label: "Within budget", impact: 10, value: `${budgetPerf.overallUsedPct.toFixed(1)}% used` });
    } else {
      const over = budgetPerf.overallUsedPct - 100;
      score -= over;
      factors.push({ label: "Over budget", impact: -round2(over), value: `${budgetPerf.overallUsedPct.toFixed(1)}% used` });
    }
  }
  if (overdueBills.length) {
    score -= overdueBills.length * 5;
    factors.push({ label: "Overdue bills", impact: -overdueBills.length * 5, value: `${overdueBills.length}` });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const positivePoints = [];
  const attentionPoints = [];

  if (income === 0 && expenses === 0) {
    // nothing recorded this month
  } else if (income === 0) {
    attentionPoints.push("No income recorded this month, so your savings rate cannot be calculated.");
  } else if (savingsRate > 20) {
    positivePoints.push(`Great savings rate: You are saving ${savingsRate.toFixed(1)}% of your income.`);
  } else if (savingsRate > 0) {
    positivePoints.push(`You are saving ${savingsRate.toFixed(1)}% of your income. Aim for 20% or more.`);
  } else {
    attentionPoints.push("Your expenses currently exceed your income. Try to identify areas to cut back.");
  }

  if (budgetPerf.totalBudget > 0) {
    if (budgetPerf.overallUsedPct <= 90)
      positivePoints.push(`Good budget control: You've only used ${budgetPerf.overallUsedPct.toFixed(1)}% of your budget.`);
    else if (budgetPerf.overallUsedPct <= 100)
      attentionPoints.push(`You have used ${budgetPerf.overallUsedPct.toFixed(1)}% of your monthly budget. Slow down a little.`);
    else
      attentionPoints.push(`You have exceeded your monthly budget by ${(budgetPerf.overallUsedPct - 100).toFixed(1)}%.`);
  }

  if (overdueBills.length) attentionPoints.push(`${overdueBills.length} bill(s) are overdue. Pay them to avoid late fees.`);
  else if (upcomingBills.length) attentionPoints.push(`You have ${upcomingBills.length} pending bill(s) to review.`);
  else if (income > 0 || expenses > 0) positivePoints.push("No immediate pending bills to worry about.");

  return {
    score: income > 0 ? score : income === 0 && expenses === 0 ? 0 : score,
    hasData: income > 0 || expenses > 0,
    savingsRate: round2(savingsRate),
    income,
    expenses,
    factors,
    positivePoints,
    attentionPoints,
    budgetUsedPct: budgetPerf.overallUsedPct,
    pendingBills: upcomingBills.length,
    overdueBills: overdueBills.length,
  };
};

// ───────── Historical averages ─────────
// Average monthly spend per category over the last 3 months (months with data only)
export const getHistoricalAverages = async (userId, { includeCurrent = true } = {}) => {
  const end = includeCurrent ? new Date() : endOfMonth(addMonths(new Date(), -1));
  const start = startOfMonth(addMonths(new Date(), includeCurrent ? -2 : -3));
  const rows = await Expense.aggregate([
    { $match: { user: oid(userId), date: { $gte: start, $lte: end } } },
    { $group: { _id: { category: "$category", y: { $year: "$date" }, m: { $month: "$date" } }, total: { $sum: "$amount" } } },
  ]);
  const months = new Set(rows.map((r) => `${r._id.y}-${r._id.m}`)).size || 1;
  const byCat = {};
  rows.forEach((r) => {
    byCat[r._id.category] = (byCat[r._id.category] || 0) + r.total;
  });
  return Object.entries(byCat)
    .map(([category, total]) => ({ category, average: round2(total / months), months }))
    .sort((a, b) => b.average - a.average);
};

// ───────── Anomalies & money leaks ─────────
export const getAnomaliesAndLeaks = async (userId) => {
  const monthStart = startOfMonth();
  const history = await getHistoricalAverages(userId, { includeCurrent: false });

  const current = await Expense.aggregate([
    { $match: { user: oid(userId), date: { $gte: monthStart } } },
    { $group: { _id: "$category", spent: { $sum: "$amount" } } },
  ]);
  const spentBy = Object.fromEntries(current.map((c) => [c._id, c.spent]));

  // 1) Category spikes: > 25% above own 3-month average and at least Rs 500 more
  const anomalies = [];
  for (const avg of history) {
    const spent = spentBy[avg.category] || 0;
    if (avg.average > 0 && spent > avg.average * 1.25 && spent - avg.average > 500) {
      anomalies.push({
        kind: "category",
        category: avg.category,
        currentSpent: round2(spent),
        average: round2(avg.average),
        difference: round2(spent - avg.average),
        percentageIncrease: round2(((spent - avg.average) / avg.average) * 100),
      });
    }
  }

  // 2) Unusual single transactions: > 3x the category's usual transaction size
  const sizeRows = await Expense.aggregate([
    { $match: { user: oid(userId), date: { $lt: monthStart, $gte: startOfMonth(addMonths(new Date(), -6)) } } },
    { $group: { _id: "$category", avgTxn: { $avg: "$amount" }, n: { $sum: 1 } } },
  ]);
  const avgTxn = Object.fromEntries(sizeRows.filter((r) => r.n >= 3).map((r) => [r._id, r.avgTxn]));
  const recent = await Expense.find({ user: userId, date: { $gte: monthStart } }).sort({ amount: -1 }).limit(50);
  const transactions = recent
    .filter((e) => avgTxn[e.category] && e.amount > avgTxn[e.category] * 3 && e.amount >= 500)
    .slice(0, 5)
    .map((e) => ({
      kind: "transaction",
      id: e._id,
      title: e.title,
      category: e.category,
      amount: e.amount,
      date: e.date,
      usual: round2(avgTxn[e.category]),
      times: round2(e.amount / avgTxn[e.category]),
    }));

  // 3) Money leaks: the same small purchase repeated several times this month
  const leakRows = await Expense.aggregate([
    { $match: { user: oid(userId), date: { $gte: monthStart }, amount: { $lt: LEAK_MAX_AMOUNT } } },
    {
      $group: {
        _id: { title: { $toLower: "$title" }, category: "$category" },
        label: { $first: "$title" },
        count: { $sum: 1 },
        total: { $sum: "$amount" },
      },
    },
    { $match: { count: { $gte: LEAK_MIN_COUNT } } },
    { $sort: { total: -1 } },
  ]);
  const leaks = leakRows.map((l) => ({
    title: l.label,
    category: l._id.category,
    count: l.count,
    total: round2(l.total),
    average: round2(l.total / l.count),
    yearlyImpact: round2(l.total * 12),
  }));

  return { anomalies, transactions, leaks, leakThreshold: LEAK_MAX_AMOUNT };
};

// ───────── Goals ─────────
export const getSavingsGoalProjections = async (userId) => {
  const goals = await SavingsGoal.find({ user: userId, status: "active" }).sort({ targetDate: 1 });
  const currentSavings = await getSavings(userId);

  // Average monthly savings over the last 3 months gives a steadier pace
  const trend = await getMonthlyTrend(userId, 3);
  const withData = trend.filter((t) => t.income || t.expense);
  const avgSavings = withData.length ? withData.reduce((s, t) => s + t.savings, 0) / withData.length : currentSavings;

  return goals.map((goal) => {
    const remainingAmount = round2(Math.max(0, goal.targetAmount - goal.savedAmount));
    const progressPct = round2(Math.min(100, (goal.savedAmount / goal.targetAmount) * 100));
    const hasDate = Boolean(goal.targetDate);
    const monthsRemaining = hasDate
      ? Math.max(1, Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24 * 30.44)))
      : null;
    const requiredMonthly = hasDate ? round2(remainingAmount / monthsRemaining) : null;
    const pace = Math.max(0, avgSavings);
    const monthsAtCurrentPace = pace > 0 ? Math.ceil(remainingAmount / pace) : null;

    return {
      goalId: goal._id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      targetDate: goal.targetDate,
      remainingAmount,
      progressPct,
      monthsRemaining,
      requiredMonthly,
      currentMonthlySavings: round2(currentSavings),
      averageMonthlySavings: round2(avgSavings),
      monthsAtCurrentPace,
      isSufficient: hasDate ? pace >= requiredMonthly : pace > 0,
    };
  });
};

// ───────── Smart budgets ─────────
// Suggest each category's limit at its 3-month average (rounded to the nearest 10)
export const getBudgetRecommendations = async (userId) => {
  const averages = await getHistoricalAverages(userId);
  const income = await getMonthlyIncome(userId);
  return averages.map((avg) => ({
    category: avg.category,
    average: avg.average,
    suggestedLimit: Math.max(10, Math.round(avg.average / 10) * 10),
    shareOfIncome: income ? round2((avg.average / income) * 100) : null,
  }));
};

// ───────── Logging streak ─────────
// Consecutive days (ending today or yesterday) with at least one record
export const getLoggingStreak = async (userId) => {
  const since = addDays(startOfDay(), -60);
  const tz = process.env.TZ || "Asia/Kolkata";
  const project = [
    { $match: { user: oid(userId), createdAt: { $gte: since } } },
    { $project: { d: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } } } },
  ];
  const [a, b] = await Promise.all([Expense.aggregate(project), Income.aggregate(project)]);
  const days = new Set([...a, ...b].map((r) => r.d));
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let cursor = startOfDay();
  if (!days.has(fmt(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(fmt(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  const last7 = Array.from({ length: 7 }, (_, i) => days.has(fmt(addDays(startOfDay(), i - 6))));
  return { days: streak, last7 };
};
