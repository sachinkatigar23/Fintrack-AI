// ─────────────────────────────────────────────────────────────
// Safe to spend + "Can I afford this?"
// computeSafeToSpend() and computeAffordability() are PURE functions:
// everything they need is passed in, so they are easy to test.
// getSafeToSpend() / checkAffordability() are the thin DB-loading wrappers.
// ─────────────────────────────────────────────────────────────
import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import Bill from "../models/Bill.js";
import SavingsGoal from "../models/SavingsGoal.js";
import RecurringTransaction from "../models/RecurringTransaction.js";
import * as analytics from "./analyticsService.js";
import { normalizeName } from "./billService.js";
import { notify } from "./notificationService.js";
import { addPeriod, occurrencesBetween, daysInMonth } from "../utils/schedule.js";
import { startOfDay, endOfDay, addDays, monthKey } from "../utils/dates.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DAY = 86400000;
const dayDiff = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
const sum = (list, f = (x) => x.amount) => list.reduce((s, x) => s + (Number(f(x)) || 0), 0);

// Spending that is "everyday" (not rent, bills or automatic recurring records)
const FIXED_CATEGORIES = ["Rent & Housing", "Bills & Utilities"];

// ───────── Payday ─────────
// Earliest active recurring income within the next 45 days; otherwise the next salaryDay
// (clamped to the month length; on the salary day itself, next month's).
export const findPayday = ({ today, salaryDay = 1, incomeRules = [] }) => {
  const tomorrow = startOfDay(addDays(today, 1));
  const limit = endOfDay(addDays(today, 45));
  let best = null;
  let anchor = null;

  for (const rule of incomeRules) {
    if (!rule.active || rule.type !== "income" || !rule.nextDate) continue;
    const ruleAnchor = rule.anchorDay || new Date(rule.nextDate).getDate();
    // A rule date earlier than tomorrow is moved forward to its next future occurrence
    let d = new Date(rule.nextDate);
    for (let i = 0; d < tomorrow && i < 400; i++) d = addPeriod(d, rule.frequency, ruleAnchor);
    if (rule.endDate && d > endOfDay(rule.endDate)) continue;
    if (d <= limit && (!best || d < best)) {
      best = startOfDay(d);
      anchor = ruleAnchor;
    }
  }
  if (best) return { payday: best, anchorDay: anchor, source: "recurring" };

  const day = Math.min(Math.max(1, Number(salaryDay) || 1), 31);
  const t = startOfDay(today);
  const thisMonth = new Date(t.getFullYear(), t.getMonth(), Math.min(day, daysInMonth(t.getFullYear(), t.getMonth())));
  const payday =
    thisMonth > t
      ? thisMonth
      : new Date(t.getFullYear(), t.getMonth() + 1, Math.min(day, daysInMonth(t.getFullYear(), t.getMonth() + 1)));
  return { payday, anchorDay: day, source: "salaryDay" };
};

// ───────── Goals ─────────
const monthsUntil = (today, date) => Math.max(1, Math.ceil(dayDiff(today, date) / 30.44));

export const goalCyclePlan = ({ goals = [], today, cycleStart }) =>
  goals
    .filter((g) => g.status === "active" && g.targetDate && startOfDay(g.targetDate) > startOfDay(today))
    .map((g) => {
      const remaining = Math.max(0, (g.targetAmount || 0) - (g.savedAmount || 0));
      const requiredMonthly = remaining / monthsUntil(today, g.targetDate);
      const contributed = sum(
        (g.contributions || []).filter((c) => new Date(c.date) >= cycleStart),
        (c) => (c.type === "withdrawal" ? -c.amount : c.amount)
      );
      return {
        id: g._id,
        name: g.name,
        targetDate: g.targetDate,
        remaining: round2(remaining),
        requiredMonthly: round2(requiredMonthly),
        contributedThisCycle: round2(contributed),
        due: round2(Math.max(0, requiredMonthly - contributed)),
      };
    });

/**
 * Safe to spend (pure).
 * input: { today, settings{openingBalance,salaryDay,safetyBuffer}, totals{totalIncome,totalExpenses,incomeCount},
 *          goals[], bills[] (pending), recurringRules[], todayExpenses[], recentExpenses[] (last 30 days),
 *          budget{ totalBudget, remaining, hasOverall, categories[] } (current month) }
 */
export const computeSafeToSpend = (input) => {
  const today = new Date(input.today || Date.now());
  const t0 = startOfDay(today);
  const settings = input.settings || {};
  const totals = input.totals || {};
  const rules = input.recurringRules || [];

  // 1-2. payday and days left (today up to the day before payday, counting today)
  const { payday, anchorDay: paydayAnchor, source: paydaySource } = findPayday({
    today,
    salaryDay: settings.salaryDay,
    incomeRules: rules.filter((r) => r.type === "income"),
  });
  const daysLeft = Math.max(1, dayDiff(t0, payday));

  // 3. balance = opening balance + all income - all expenses
  const balance = round2((settings.openingBalance || 0) + (totals.totalIncome || 0) - (totals.totalExpenses || 0));

  // 4. money held by goals (still in the account, not spendable)
  const goalReserve = round2(sum((input.goals || []).filter((g) => ["active", "completed"].includes(g.status)), (g) => g.savedAmount));

  // 5. pending bills due before payday (overdue included)
  const billsDue = (input.bills || [])
    .filter((b) => b.status !== "paid" && startOfDay(b.dueDate) < payday)
    .map((b) => ({ id: b._id, name: b.name, amount: round2(b.amount), date: new Date(b.dueDate), overdue: startOfDay(b.dueDate) < t0 }))
    .sort((a, b) => a.date - b.date);
  const billsDueTotal = round2(sum(billsDue));

  // 6. recurring expenses from their nextDate up to payday (not yet recorded), deduped against bills
  const recurringDue = [];
  for (const r of rules) {
    if (!r.active || r.type !== "expense" || !r.nextDate) continue;
    const anchor = r.anchorDay || new Date(r.nextDate).getDate();
    const dates = occurrencesBetween(r.nextDate, r.frequency, anchor, r.nextDate, payday, r.endDate);
    for (const date of dates) {
      const key = normalizeName(r.title);
      const dupe = billsDue.some(
        (b) =>
          normalizeName(b.name) === key &&
          Math.abs(b.amount - r.amount) <= 0.1 * Math.max(b.amount, r.amount) &&
          Math.abs(dayDiff(b.date, date)) <= 5
      );
      if (!dupe) recurringDue.push({ id: r._id, name: r.title, amount: round2(r.amount), date, overdue: startOfDay(date) < t0 });
    }
  }
  recurringDue.sort((a, b) => a.date - b.date);
  const recurringDueTotal = round2(sum(recurringDue));

  // 7. this pay cycle's planned goal savings
  const cycleStart = startOfDay(addPeriod(payday, "monthly", paydayAnchor, -1));
  const goalPlan = goalCyclePlan({ goals: input.goals, today, cycleStart });
  const goalContributionsDue = round2(sum(goalPlan, (g) => g.due));

  // 8-9. buffer and spendable
  const buffer = round2(Math.max(0, settings.safetyBuffer || 0));
  const spendable = round2(balance - goalReserve - billsDueTotal - recurringDueTotal - goalContributionsDue - buffer);

  // 10. daily allowance (today's spending is added back so the number stays stable during the day)
  const spentToday = round2(sum(input.todayExpenses || []));
  const dailyAllowance = round2(Math.max(0, spendable + spentToday) / daysLeft);
  let leftToday = round2(Math.max(0, dailyAllowance - spentToday));
  let limitedBy = "money";

  // 11. the monthly budget can be the tighter limit
  const budget = input.budget;
  let budgetLeftToday = null;
  if (budget && budget.totalBudget > 0 && budget.remaining !== null && budget.remaining !== undefined) {
    const tracked = (input.todayExpenses || []).filter((e) => budget.hasOverall || (budget.categories || []).includes(e.category));
    const spentTodayTracked = sum(tracked);
    const daysLeftInMonth = daysInMonth(t0.getFullYear(), t0.getMonth()) - t0.getDate() + 1;
    const budgetDaily = Math.max(0, budget.remaining + spentTodayTracked) / daysLeftInMonth;
    budgetLeftToday = round2(Math.max(0, budgetDaily - spentTodayTracked));
    if (budgetLeftToday < leftToday) {
      leftToday = budgetLeftToday;
      limitedBy = "budget";
    }
  }

  // 12. status
  const everyday = (input.recentExpenses || []).filter((e) => !e.isRecurring && !FIXED_CATEGORIES.includes(e.category));
  const avgDailySpend = round2(sum(everyday) / 30);
  let status = "comfortable";
  let shortBy = 0;
  if (!totals.incomeCount && !(settings.openingBalance || 0) && balance <= 0) status = "setup";
  else if (spendable < 0) {
    status = "short";
    shortBy = round2(-spendable);
  } else if (dailyAllowance < 0.8 * avgDailySpend) status = "tight";

  // 13. "Why this number?" and "Before payday"
  const breakdown = [
    { key: "balance", label: "Available balance", amount: balance, sign: "" },
    { key: "goalReserve", label: "Reserved in goals", amount: goalReserve, sign: "-" },
    { key: "bills", label: "Bills before payday", amount: billsDueTotal, sign: "-" },
    { key: "recurring", label: "Recurring before payday", amount: recurringDueTotal, sign: "-" },
    { key: "goalSavings", label: "Planned goal savings", amount: goalContributionsDue, sign: "-" },
    { key: "buffer", label: "Safety buffer", amount: buffer, sign: "-" },
    { key: "spendable", label: "Spendable until payday", amount: spendable, sign: "=" },
    { key: "days", label: "Days left (incl. today)", value: daysLeft, sign: "÷" },
  ];

  let running = round2(balance - goalReserve);
  const timeline = [
    ...billsDue.map((b) => ({ ...b, kind: "bill" })),
    ...recurringDue.map((r) => ({ ...r, kind: "recurring" })),
  ]
    .sort((a, b) => a.date - b.date)
    .map((item) => {
      running = round2(running - item.amount);
      return { ...item, leftAfter: running };
    });

  return {
    status,
    payday,
    paydaySource,
    paydayAnchor,
    daysLeft,
    balance,
    goalReserve,
    billsDue,
    billsDueTotal,
    recurringDue,
    recurringDueTotal,
    goalPlan,
    goalContributionsDue,
    buffer,
    spendable,
    spentToday,
    dailyAllowance,
    leftToday,
    limitedBy,
    budgetLeftToday,
    shortBy,
    avgDailySpend,
    breakdown,
    timeline,
  };
};

// ───────── Can I afford this? ─────────
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const fmtDay = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// Which goals the money would come from: least urgent first (latest / no target date)
const takeFromGoals = (goals, amount) => {
  const pool = goals
    .filter((g) => ["active", "completed"].includes(g.status) && g.savedAmount > 0)
    .sort((a, b) => (b.targetDate ? new Date(b.targetDate) : Infinity) - (a.targetDate ? new Date(a.targetDate) : Infinity));
  const out = [];
  let left = amount;
  for (const g of pool) {
    if (left <= 0) break;
    const take = Math.min(left, g.savedAmount);
    out.push({ id: g._id, name: g.name, amount: round2(take) });
    left -= take;
  }
  return out;
};

/**
 * Verdict for a planned purchase (pure). The first rule that matches wins:
 *  A yes · B yes_but · C skip_goal_savings · D use_savings · E no
 * input: { sts (computeSafeToSpend result), amount, category?, goals[], budgetItems[], monthlyNet }
 */
export const computeAffordability = ({ sts, amount, category, goals = [], budgetItems = [], monthlyNet = 0 }) => {
  const a = round2(amount);
  const free = Math.max(0, sts.spendable);
  const details = [];
  let verdict;
  let headline;
  let suggestedDate = null;
  const numbers = {
    amount: a,
    leftToday: sts.leftToday,
    dailyAllowance: sts.dailyAllowance,
    spendable: sts.spendable,
    goalContributionsDue: sts.goalContributionsDue,
    goalReserve: sts.goalReserve,
    daysLeft: sts.daysLeft,
    payday: sts.payday,
  };

  if (a <= sts.leftToday) {
    verdict = "yes";
    headline = `Yes – it fits in today's ${money(sts.leftToday)}.`;
    details.push(`You'd still have ${money(sts.leftToday - a)} left to spend today.`);
  } else if (a <= sts.spendable) {
    verdict = "yes_but";
    const after = round2((sts.spendable - a) / sts.daysLeft);
    numbers.newDailyAllowance = after;
    headline = `Yes, but your daily safe-to-spend drops from ${money(sts.dailyAllowance)} to ${money(after)} until payday.`;
    details.push(`That leaves ${money(sts.spendable - a)} for the next ${sts.daysLeft} day(s).`);
  } else if (a <= free + sts.goalContributionsDue) {
    verdict = "skip_goal_savings";
    const y = round2(a - free);
    const perDay = sum(sts.goalPlan, (g) => g.requiredMonthly) / 30.44;
    const slip = perDay > 0 ? Math.ceil(y / perDay) : 0;
    const nearest = [...sts.goalPlan].filter((g) => g.due > 0).sort((p, q) => new Date(p.targetDate) - new Date(q.targetDate))[0];
    numbers.skipGoalSavings = y;
    numbers.slipDays = slip;
    headline = `Only if you skip ${money(y)} of this month's goal savings – ${nearest ? nearest.name : "your goal"} slips about ${slip} day${slip === 1 ? "" : "s"}.`;
    details.push(`Your spendable money (${money(free)}) covers only part of it.`);
  } else if (a <= free + sts.goalContributionsDue + sts.goalReserve) {
    verdict = "use_savings";
    const z = round2(a - free - sts.goalContributionsDue);
    const from = takeFromGoals(goals, z);
    numbers.fromSavings = z;
    numbers.fromGoals = from;
    headline = `Only by taking ${money(z)} out of your goal savings.`;
    if (from.length) details.push(`It would come from ${from.map((g) => `${g.name} (${money(g.amount)})`).join(", ")}.`);
    if (sts.goalContributionsDue > 0) details.push(`You'd also skip this month's planned goal savings of ${money(sts.goalContributionsDue)}.`);
  } else {
    verdict = "no";
    const s = round2(a - free);
    numbers.shortBy = s;
    numbers.monthlyNet = round2(monthlyNet);
    headline = `You'd be ${money(s)} short before payday.`;
    if (monthlyNet > 0) {
      const months = Math.ceil(s / monthlyNet);
      suggestedDate = addPeriod(sts.payday, "monthly", sts.paydayAnchor, months - 1);
      details.push(`You save about ${money(monthlyNet)} a month. You could afford it around ${fmtDay(suggestedDate)}.`);
    } else {
      details.push("You aren't saving each month right now – reduce spending first.");
    }
  }

  // Budget warnings (added to any verdict)
  const warnings = [];
  const catBudget = category ? budgetItems.find((b) => b.category === category) : null;
  if (catBudget && catBudget.remaining < a) {
    warnings.push(`This is ${money(a - Math.max(0, catBudget.remaining))} over your ${category} budget.`);
  }
  const overall = budgetItems.find((b) => b.category === "Overall");
  if (overall && overall.remaining < a) {
    warnings.push(`This is ${money(a - Math.max(0, overall.remaining))} over your Overall budget.`);
  }

  return { verdict, headline, details, warnings, numbers, suggestedDate };
};

// Rule-based one-line tip (used when the AI is off or fails)
export const fallbackTip = (verdict) =>
  ({
    yes: "Enjoy it – it's already inside today's safe amount.",
    yes_but: "If you buy it, keep the next few days light so you stay on track until payday.",
    skip_goal_savings: "Consider waiting until after payday so your goals stay on schedule.",
    use_savings: "Dipping into goal savings is fine for real needs – top the goal back up after payday.",
    no: "Save for it with a goal so the money is ready when you need it.",
  })[verdict] || "Check your Safe to spend before big purchases.";

// ───────── DB wrappers ─────────
const oid = (id) => new mongoose.Types.ObjectId(String(id));

const loadInput = async (userId, today = new Date()) => {
  const t0 = startOfDay(today);
  const [settings, available, goals, bills, recurringRules, todayExpenses, recentExpenses, budgetPerf] = await Promise.all([
    analytics.getMoneySettings(userId),
    analytics.getAvailableBalance(userId),
    SavingsGoal.find({ user: userId, status: { $in: ["active", "completed"] } }).lean(),
    Bill.find({ user: userId, status: "pending" }).lean(),
    RecurringTransaction.find({ user: userId, active: true }).lean(),
    Expense.find({ user: oid(userId), date: { $gte: t0, $lte: endOfDay(today) } }).select("amount category").lean(),
    Expense.find({ user: oid(userId), date: { $gte: startOfDay(addDays(today, -29)), $lte: endOfDay(today) } })
      .select("amount category isRecurring")
      .lean(),
    analytics.getBudgetPerformance(userId, monthKey(today)),
  ]);

  return {
    today,
    settings,
    totals: { totalIncome: available.totalIncome, totalExpenses: available.totalExpenses, incomeCount: available.incomeCount },
    goals,
    bills,
    recurringRules,
    todayExpenses,
    recentExpenses,
    budget: {
      totalBudget: budgetPerf.totalBudget,
      remaining: budgetPerf.remaining,
      hasOverall: budgetPerf.items.some((b) => b.category === "Overall"),
      categories: budgetPerf.items.map((b) => b.category),
    },
    budgetItems: budgetPerf.items.map((b) => ({ category: b.category, remaining: b.remaining, amount: b.amount })),
  };
};

export const getSafeToSpend = async (userId, today = new Date()) => {
  const input = await loadInput(userId, today);
  return computeSafeToSpend(input);
};

// Average (income - expenses) over the last 3 full months that have data
export const getMonthlyNet = async (userId) => {
  const trend = await analytics.getMonthlyTrend(userId, 4);
  const full = trend.slice(0, 3).filter((m) => m.income || m.expense);
  return full.length ? round2(full.reduce((s, m) => s + m.savings, 0) / full.length) : 0;
};

// Users with expenses in the last 60 days (daily jobs only look at active users)
export const activeUserIds = async (days = 60) => Expense.distinct("user", { date: { $gte: addDays(startOfDay(), -days) } });

// Daily 09:00 job: warn users who may run short before payday (once per day)
export const sendShortfallAlerts = async (today = new Date(), userIds = null) => {
  let sent = 0;
  for (const userId of userIds || (await activeUserIds())) {
    try {
      const sts = await getSafeToSpend(userId, today);
      if (sts.status !== "short") continue;
      const created = await notify(userId, {
        type: "planning",
        title: "You may run short before payday",
        message: `Heads up: you may run short by ${money(sts.shortBy)} before payday (${fmtDay(sts.payday)}).`,
        link: "/safe-to-spend",
        key: `planning:short:${toKey(today)}`,
      });
      if (created) sent += 1;
    } catch (error) {
      console.error(`Shortfall check for ${userId} failed:`, error.message);
    }
  }
  return sent;
};

const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const checkAffordability = async (userId, { amount, category }, today = new Date()) => {
  const [input, monthlyNet] = await Promise.all([loadInput(userId, today), getMonthlyNet(userId)]);
  const sts = computeSafeToSpend(input);
  const result = computeAffordability({ sts, amount, category, goals: input.goals, budgetItems: input.budgetItems, monthlyNet });
  return { sts, result, currency: input.settings.currency };
};
