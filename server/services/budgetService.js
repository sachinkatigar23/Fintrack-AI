// ─────────────────────────────────────────────────────────────
// Budget helpers: pace / projection (pure) + monthly copy (DB wrappers)
// ─────────────────────────────────────────────────────────────
import Budget from "../models/Budget.js";
import { monthKey, parseMonthKey, addMonths } from "../utils/dates.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Pace and projection for one budget.
 *  - current month: daysElapsed = today's day of month, elapsedPct, projectedSpend,
 *    paceStatus ("over_pace" when usedPct > elapsedPct + 10 and something was spent),
 *    dailyLeft = max(0, remaining) / days left including today
 *  - past month: how far under / over it ended
 *  - future month: nothing elapsed yet
 */
export const budgetPace = ({ amount, spent, month, today = new Date() }) => {
  const start = parseMonthKey(month) || new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const current = monthKey(today);
  const key = monthKey(start);
  const remaining = round2((Number(amount) || 0) - (Number(spent) || 0));
  const usedPct = amount ? (spent / amount) * 100 : 0;

  if (key < current) {
    return { period: "past", daysInMonth, daysElapsed: daysInMonth, elapsedPct: 100, endedUnder: remaining >= 0, endedBy: Math.abs(remaining) };
  }
  if (key > current) {
    return {
      period: "future",
      daysInMonth,
      daysElapsed: 0,
      elapsedPct: 0,
      projectedSpend: round2(spent),
      paceStatus: "on_pace",
      dailyLeft: round2(Math.max(0, remaining) / daysInMonth),
    };
  }

  const daysElapsed = today.getDate();
  const elapsedPct = (daysElapsed / daysInMonth) * 100;
  const daysLeft = daysInMonth - daysElapsed + 1;
  return {
    period: "current",
    daysInMonth,
    daysElapsed,
    daysLeft,
    elapsedPct: round2(elapsedPct),
    projectedSpend: round2((spent / daysElapsed) * daysInMonth),
    paceStatus: usedPct > elapsedPct + 10 && spent > 0 ? "over_pace" : "on_pace",
    dailyLeft: round2(Math.max(0, remaining) / daysLeft),
  };
};

// Category budgets that add up to more than the Overall budget (null when fine)
export const budgetConsistency = (budgets) => {
  const overall = budgets.find((b) => b.category === "Overall");
  if (!overall) return null;
  const categoryTotal = round2(budgets.filter((b) => b.category !== "Overall").reduce((s, b) => s + b.amount, 0));
  return categoryTotal > overall.amount ? { categoryTotal, overall: overall.amount } : null;
};

// Which budgets of the previous month should be created in the target month
export const planBudgetCopies = (previous, existing, { onlyRepeat = false } = {}) => {
  const taken = new Set(existing.map((b) => b.category));
  return previous
    .filter((b) => (!onlyRepeat || b.repeat) && !taken.has(b.category))
    .map((b) => ({ name: b.name, amount: b.amount, category: b.category, repeat: Boolean(b.repeat) }));
};

export const previousMonthKey = (key) => monthKey(addMonths(parseMonthKey(key) || new Date(), -1));

// POST /budgets/copy-previous: copy last month's budgets into `month` (categories it doesn't have yet)
export const copyPreviousBudgets = async (userId, month, { onlyRepeat = false } = {}) => {
  const [previous, existing] = await Promise.all([
    Budget.find({ user: userId, month: previousMonthKey(month) }).lean(),
    Budget.find({ user: userId, month }).lean(),
  ]);
  const copies = planBudgetCopies(previous, existing, { onlyRepeat });
  if (!copies.length) return [];
  return Budget.insertMany(copies.map((c) => ({ ...c, user: userId, month })));
};

// Scheduler (daily + at start-up): repeat budgets marked "Repeat every month" into the current month
export const copyRepeatingBudgets = async (today = new Date()) => {
  const month = monthKey(today);
  const users = await Budget.distinct("user", { month: previousMonthKey(month), repeat: true });
  let created = 0;
  for (const userId of users) {
    try {
      created += (await copyPreviousBudgets(userId, month, { onlyRepeat: true })).length;
    } catch (error) {
      console.error(`Budget repeat for ${userId} failed:`, error.message);
    }
  }
  return created;
};
