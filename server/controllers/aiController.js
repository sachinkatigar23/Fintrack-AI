// ─────────────────────────────────────────────────────────────
// AI Financial Intelligence
// Pipeline for every feature:
//   1. fetch ONLY the signed-in user's records
//   2. calculate the figures in analyticsService (verified numbers)
//   3. send those figures as context to the AI service
//   4. return the AI explanation together with the same numbers
// If the AI is off or fails, a rule-based answer built from the same
// numbers is returned, so the app keeps working.
// ─────────────────────────────────────────────────────────────
import Expense from "../models/Expense.js";
import mongoose from "mongoose";
import * as analytics from "../services/analyticsService.js";
import { explainOrFallback, cached, isAIEnabled, generateJSON } from "../services/aiService.js";
import { parseQuickAdd, mergeAIItems, hasDevanagariLetters } from "../services/quickAddParser.js";
import { startOfMonth, endOfMonth, addMonths, monthKey, monthRange } from "../utils/dates.js";
import { EXPENSE_CATEGORIES, INCOME_SOURCES, PAYMENT_METHODS } from "../utils/constants.js";
import { getSafeToSpend } from "../services/planningService.js";
import { getSubscriptions } from "../services/subscriptionService.js";

const isoDay = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

// ───────── Build the verified context for one user ─────────
const buildContext = async (userId) => {
  const now = new Date();
  const last = addMonths(now, -1);
  const [
    thisIncome,
    thisExpenses,
    lastIncome,
    lastExpenses,
    thisCats,
    lastCats,
    sources,
    budget,
    goals,
    bills,
    averages,
    merchants,
    settings,
    available,
  ] = await Promise.all([
    analytics.sumIncome(userId, startOfMonth(now), endOfMonth(now)),
    analytics.sumExpenses(userId, startOfMonth(now), endOfMonth(now)),
    analytics.sumIncome(userId, startOfMonth(last), endOfMonth(last)),
    analytics.sumExpenses(userId, startOfMonth(last), endOfMonth(last)),
    analytics.getCategoryBreakdown(userId, startOfMonth(now), endOfMonth(now)),
    analytics.getCategoryBreakdown(userId, startOfMonth(last), endOfMonth(last)),
    analytics.getIncomeBreakdown(userId, startOfMonth(now), endOfMonth(now)),
    analytics.getBudgetPerformance(userId),
    analytics.getSavingsGoalProjections(userId),
    analytics.getUpcomingBills(userId, 5),
    analytics.getHistoricalAverages(userId),
    Expense.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(userId)), date: { $gte: startOfMonth(now) } } },
      { $group: { _id: "$title", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]),
    analytics.getMoneySettings(userId),
    analytics.getAvailableBalance(userId),
  ]);

  // Safe to spend summary (never blocks the coach if it fails)
  const [sts, subs] = await Promise.all([
    getSafeToSpend(userId).catch(() => null),
    getSubscriptions(userId).catch(() => null),
  ]);

  const savings = round2(thisIncome.total - thisExpenses.total);
  const lastByCat = Object.fromEntries(lastCats.map((c) => [c.name, c.amount]));

  return {
    currency: settings.currency,
    // Available balance = opening balance + all income - all expenses
    availableBalance: available.balance,
    month: monthKey(now),
    thisMonth: {
      income: thisIncome.total,
      expenses: thisExpenses.total,
      savings,
      savingsRate: thisIncome.total ? round2((savings / thisIncome.total) * 100) : 0,
      expenseCount: thisExpenses.count,
      categories: thisCats.slice(0, 8).map((c) => ({
        name: c.name,
        amount: c.amount,
        shareOfSpend: c.pct,
        lastMonth: round2(lastByCat[c.name] || 0),
        changeVsLastMonth: round2(c.amount - (lastByCat[c.name] || 0)),
      })),
      incomeSources: sources,
      topMerchants: merchants.map((m) => ({ title: m._id, total: round2(m.total), count: m.count })),
    },
    lastMonth: {
      income: lastIncome.total,
      expenses: lastExpenses.total,
      savings: round2(lastIncome.total - lastExpenses.total),
      categories: lastCats.slice(0, 8).map((c) => ({ name: c.name, amount: c.amount })),
    },
    changeVsLastMonth: {
      expenses: round2(thisExpenses.total - lastExpenses.total),
      income: round2(thisIncome.total - lastIncome.total),
    },
    budgets: {
      totalLimit: budget.totalBudget,
      usedPct: budget.overallUsedPct,
      items: budget.items.map((b) => ({ name: b.name, category: b.category, limit: b.amount, spent: b.spentAmount, usedPct: b.usedPct })),
    },
    goals: goals.map((g) => ({
      name: g.name,
      target: g.targetAmount,
      saved: g.savedAmount,
      remaining: g.remainingAmount,
      requiredMonthly: g.requiredMonthly,
      onTrack: g.isSufficient,
    })),
    upcomingBills: bills.map((b) => ({ name: b.name, amount: b.amount, dueDate: b.dueDate.toISOString().slice(0, 10) })),
    threeMonthAverages: averages,
    safeToSpend: sts
      ? {
          status: sts.status,
          leftToday: sts.leftToday,
          dailyAllowance: sts.dailyAllowance,
          spendableUntilPayday: sts.spendable,
          payday: isoDay(sts.payday),
          daysLeft: sts.daysLeft,
          reservedInGoals: sts.goalReserve,
          billsBeforePayday: sts.billsDueTotal,
          recurringBeforePayday: sts.recurringDueTotal,
          plannedGoalSavings: sts.goalContributionsDue,
          safetyBuffer: sts.buffer,
          limitedBy: sts.limitedBy,
          shortBy: sts.shortBy,
        }
      : null,
    subscriptions: subs
      ? {
          count: subs.totals.count,
          monthlyTotal: subs.totals.monthly,
          yearlyTotal: subs.totals.yearly,
          pctOfIncome: subs.totals.pctOfIncome,
          top: subs.items.slice(0, 5).map((i) => ({ name: i.name, monthlyCost: i.monthlyCost, frequency: i.frequency, status: i.status })),
        }
      : null,
  };
};

// ───────── Rule-based answers (used when AI is off/unavailable) ─────────
const ruleBasedAnswer = (q, ctx) => {
  const text = (q || "").toLowerCase();
  const t = ctx.thisMonth;
  const top = t.categories[0];

  // "How much can I spend / afford?" -> Safe to spend
  const s = ctx.safeToSpend;
  if (s && /(how much (can|could|should|may) i (spend|afford)|can i (spend|afford|buy)|afford|safe to spend|kitna.*kharch.*(sakta|sakti|sake))/.test(text)) {
    const statusLine =
      s.status === "short"
        ? `Careful: you may run short by ${inr(s.shortBy)} before payday.`
        : s.status === "setup"
          ? "Add your income or a starting balance in Profile → Money settings to get an accurate number."
          : s.status === "tight"
            ? "Money is tight until payday, so keep today's spending light."
            : "You're comfortable until payday.";
    return {
      type: "financial_health",
      title: "Safe to spend",
      summary: `You can safely spend ${inr(s.leftToday)} today. Until payday on ${s.payday} (${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left) you have ${inr(Math.max(0, s.spendableUntilPayday))} spendable. ${statusLine}`,
      metrics: [
        `Safe today: ${inr(s.leftToday)}`,
        `Spendable until payday: ${inr(s.spendableUntilPayday)}`,
        `Bills before payday: ${inr(s.billsBeforePayday)}`,
        `Reserved in goals: ${inr(s.reservedInGoals)}`,
      ],
      recommendation: "Use \"Can I afford this?\" on the Safe to spend page before a bigger purchase.",
    };
  }

  if (/(compare|last month|changed|change|increase|decrease|vs)/.test(text)) {
    const diff = ctx.changeVsLastMonth.expenses;
    const movers = [...t.categories].sort((a, b) => Math.abs(b.changeVsLastMonth) - Math.abs(a.changeVsLastMonth)).slice(0, 3);
    return {
      type: "spending_analysis",
      title: "This month vs last month",
      summary: `You have spent ${inr(t.expenses)} this month compared with ${inr(ctx.lastMonth.expenses)} last month, a ${diff >= 0 ? "rise" : "drop"} of ${inr(Math.abs(diff))}.`,
      metrics: [`This month: ${inr(t.expenses)}`, `Last month: ${inr(ctx.lastMonth.expenses)}`, `Difference: ${diff >= 0 ? "+" : "-"}${inr(Math.abs(diff))}`],
      recommendation: movers[0] && movers[0].changeVsLastMonth > 0 ? `${movers[0].name} grew the most (+${inr(movers[0].changeVsLastMonth)}). Review it first.` : "Good job keeping spending under control.",
      chart: { type: "bar", data: movers.map((m) => ({ name: m.name, value: m.changeVsLastMonth })) },
    };
  }
  if (/(save|saving)/.test(text)) {
    return {
      type: "savings_plan",
      title: "Your savings",
      summary: `This month you earned ${inr(t.income)} and spent ${inr(t.expenses)}, so you have saved ${inr(t.savings)} (${pct(t.savingsRate)} of income).`,
      metrics: [`Savings: ${inr(t.savings)}`, `Savings rate: ${pct(t.savingsRate)}`],
      recommendation: t.savingsRate >= 20 ? "You are above the healthy 20% savings mark. Consider moving the extra into a goal." : top ? `Try trimming ${top.name} (${inr(top.amount)}) to push your savings rate towards 20%.` : "Add your income and expenses to plan savings.",
    };
  }
  if (/budget/.test(text)) {
    const b = ctx.budgets;
    return {
      type: "financial_health",
      title: "Budget status",
      summary: b.totalLimit ? `You have used ${pct(b.usedPct)} of your ${inr(b.totalLimit)} budget this month.` : "You have not set a budget for this month yet.",
      metrics: b.items.slice(0, 4).map((i) => `${i.name}: ${inr(i.spent)} / ${inr(i.limit)}`),
      recommendation: b.totalLimit ? "Open Budgets to adjust limits that are close to 100%." : "Use Smart Budgets in AI Insights to create limits from your own averages.",
    };
  }
  if (/bill|due/.test(text)) {
    return {
      type: "daily_brief",
      title: "Upcoming bills",
      summary: ctx.upcomingBills.length ? `You have ${ctx.upcomingBills.length} upcoming bill(s).` : "No upcoming bills are pending.",
      metrics: ctx.upcomingBills.map((b) => `${b.name}: ${inr(b.amount)} on ${b.dueDate}`),
      recommendation: ctx.upcomingBills.length ? "Keep enough balance aside for these payments." : "All clear for now.",
    };
  }
  if (/(most|highest|top|where|biggest|spend)/.test(text) && top) {
    return {
      type: "spending_analysis",
      title: "Where your money goes",
      summary: `Your highest spending category this month is ${top.name} at ${inr(top.amount)}, which is ${pct(top.shareOfSpend)} of your total spending.`,
      metrics: t.categories.slice(0, 3).map((c) => `${c.name}: ${inr(c.amount)}`),
      recommendation: `Set a ${top.name} budget slightly below ${inr(top.amount)} to keep it in check.`,
      chart: { type: "bar", data: t.categories.slice(0, 5).map((c) => ({ name: c.name, value: c.amount })) },
    };
  }
  return {
    type: "daily_brief",
    title: "Financial Snapshot",
    summary: `Here is your summary for this month: income ${inr(t.income)}, expenses ${inr(t.expenses)}, savings ${inr(t.savings)}.`,
    metrics: [`Total Income: ${inr(t.income)}`, `Total Expenses: ${inr(t.expenses)}`, `Total Savings: ${inr(t.savings)}`],
    recommendation: top ? `Your top spending area is ${top.name}. Setting a budget for it is a good next step.` : "Start by adding a few income and expense records.",
  };
};

// ───────── POST /ai/chat  { message, history? } ─────────
export const chatWithFinances = async (req, res) => {
  try {
    const message = String(req.body.message || "").trim().slice(0, 500);
    if (!message) return res.status(400).json({ success: false, message: "Please type a question" });

    const history = Array.isArray(req.body.history)
      ? req.body.history.slice(-6).map((h) => ({ role: h.role === "user" ? "user" : "coach", text: String(h.text || "").slice(0, 400) }))
      : [];

    const ctx = await buildContext(req.user.userId);
    const fallback = ruleBasedAnswer(message, ctx);

    const answer = await explainOrFallback(
      `Answer the user's question about their own finances using only the context.
If the question is not about personal finance, politely steer back to their money.
Return JSON:
{
  "type": "spending_analysis" | "anomaly" | "money_leak" | "what_if" | "savings_plan" | "financial_health" | "daily_brief",
  "title": "short title",
  "summary": "2-4 sentence answer in plain language",
  "metrics": ["up to 4 short 'Label: value' facts copied from the context"],
  "recommendation": "one practical next step",
  "chart": { "type": "bar", "data": [{"name": "string", "value": number}] } or null
}
Previous conversation: ${JSON.stringify(history)}
User question: ${message}`,
      ctx,
      fallback
    );

    return res.json({ success: true, data: answer });
  } catch (error) {
    console.error("AI chat error:", error);
    return res.status(500).json({ success: false, message: "AI coach is unavailable right now. Please try again." });
  }
};

// Map free text like "food" to a real category / source name
const matchName = (input, list) => {
  const q = String(input || "").trim().toLowerCase();
  if (!q) return null;
  return (
    list.find((c) => c.toLowerCase() === q) ||
    list.find((c) => c.toLowerCase().includes(q)) ||
    list.find((c) => q.includes(c.toLowerCase().split(" ")[0])) ||
    null
  );
};

// ───────── POST /ai/simulate  { type, category, amount } ─────────
// amount is the monthly change: -1000 = reduce by ₹1,000, 5000 = increase by ₹5,000
export const simulateWhatIf = async (req, res) => {
  try {
    const userId = req.user.userId;
    const type = req.body.type === "income" ? "income" : "expense";
    const change = Number(req.body.amount ?? req.body.changes?.[0]?.amountChange);

    if (!Number.isFinite(change) || change === 0) {
      return res.status(400).json({ success: false, message: "Enter a non-zero amount, e.g. -1000 or 5000" });
    }

    const now = new Date();
    const [income, expenses, cats, sources, averages, settings] = await Promise.all([
      analytics.getMonthlyIncome(userId),
      analytics.getMonthlyExpenses(userId),
      analytics.getCategoryBreakdown(userId, startOfMonth(now), endOfMonth(now)),
      analytics.getIncomeBreakdown(userId, startOfMonth(now), endOfMonth(now)),
      analytics.getHistoricalAverages(userId),
      analytics.getMoneySettings(userId),
    ]);

    const list = type === "expense" ? EXPENSE_CATEGORIES : INCOME_SOURCES;
    const name = matchName(req.body.category, list) || (type === "expense" ? "Total spending" : "Total income");
    const isTotal = !list.includes(name);

    // Current monthly figure for the chosen item (this month, or 3-month average if bigger)
    let currentItem;
    if (type === "expense") {
      const monthVal = isTotal ? expenses : cats.find((c) => c.name === name)?.amount || 0;
      const avgVal = isTotal ? 0 : averages.find((a) => a.category === name)?.average || 0;
      currentItem = Math.max(monthVal, avgVal);
    } else {
      currentItem = isTotal ? income : sources.find((s) => s.name === name)?.amount || 0;
    }

    const newItem = Math.max(0, currentItem + change);
    const effectiveChange = newItem - currentItem; // can't go below zero
    const savingsDelta = type === "expense" ? -effectiveChange : effectiveChange;

    const currentSavings = round2(income - expenses);
    const newSavings = round2(currentSavings + savingsDelta);
    const newIncome = type === "income" ? income + effectiveChange : income;

    const result = {
      type,
      item: name,
      currentMonthly: round2(currentItem),
      newMonthly: round2(newItem),
      monthlyChange: round2(effectiveChange),
      currentMonthlySavings: currentSavings,
      newMonthlySavings: newSavings,
      monthlyDifference: round2(savingsDelta),
      yearlyImpact: round2(savingsDelta * 12),
      currentSavingsRate: income ? round2((currentSavings / income) * 100) : 0,
      newSavingsRate: newIncome ? round2((newSavings / newIncome) * 100) : 0,
    };

    const better = savingsDelta >= 0;
    const fallback = {
      title: "Simulation Result",
      summary: `If your ${name.toLowerCase()} goes from ${inr(result.currentMonthly)} to ${inr(result.newMonthly)} a month, your monthly savings ${better ? "improve" : "fall"} by ${inr(Math.abs(savingsDelta))}. Kept up for 12 months, that is ${inr(Math.abs(result.yearlyImpact))} ${better ? "more" : "less"} saved in a year.`,
      recommendation: better
        ? "Small, steady changes like this add up. Move the difference into a savings goal so it isn't spent elsewhere."
        : "This change lowers your savings. Make sure it is planned and fits within your budget.",
    };

    const explanation = await explainOrFallback(
      `Explain this what-if simulation result to the user. Use the exact numbers.
Return JSON: {"title": "short title", "summary": "2-3 sentences", "recommendation": "one practical tip"}`,
      { ...result, currency: settings.currency },
      fallback
    );

    return res.json({
      success: true,
      data: {
        ...result,
        title: explanation.title,
        summary: explanation.summary,
        recommendation: explanation.recommendation,
        aiGenerated: explanation.aiGenerated,
        aiNote: explanation.aiNote,
        metrics: [
          `Current savings: ${inr(currentSavings)}/mo`,
          `New savings: ${inr(newSavings)}/mo`,
          `Monthly difference: ${savingsDelta >= 0 ? "+" : "-"}${inr(Math.abs(savingsDelta))}`,
          `Yearly impact: ${result.yearlyImpact >= 0 ? "+" : "-"}${inr(Math.abs(result.yearlyImpact))}`,
        ],
        chart: [
          { name: "Current", savings: currentSavings, item: result.currentMonthly },
          { name: "After change", savings: newSavings, item: result.newMonthly },
        ],
      },
    });
  } catch (error) {
    console.error("Simulation error:", error);
    return res.status(500).json({ success: false, message: "Simulation unavailable." });
  }
};

const gradeFor = (score) =>
  score >= 90 ? "A+" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";

// ───────── GET /ai/recap?month=YYYY-MM  (Monthly AI Review / report card) ─────────
export const generateMonthlyRecap = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { start, end, key } = monthRange(req.query.month);
    const refresh = req.query.refresh === "1";

    const build = async () => {
      const [income, expenses, categories, budgetPerf, leaksData, goals, health, settings] = await Promise.all([
        analytics.getMonthlyIncome(userId, start),
        analytics.getMonthlyExpenses(userId, start),
        analytics.getCategoryBreakdown(userId, start, end),
        analytics.getBudgetPerformance(userId, key),
        analytics.getAnomaliesAndLeaks(userId),
        analytics.getSavingsGoalProjections(userId),
        analytics.getHealthScore(userId, start),
        analytics.getMoneySettings(userId),
      ]);

      if (!income && !expenses) {
        return { empty: true, month: key };
      }

      const savings = round2(income - expenses);
      const savingsRate = income ? round2((savings / income) * 100) : 0;
      const top = categories[0] || null;

      const recapData = {
        currency: settings.currency,
        month: key,
        income,
        expenses,
        savings,
        savingsRate,
        budgetUsedPct: budgetPerf.overallUsedPct,
        hasBudget: budgetPerf.totalBudget > 0,
        topCategory: top,
        anomaliesCount: leaksData.anomalies.length,
        leaksTotal: round2(leaksData.leaks.reduce((s, l) => s + l.total, 0)),
        goalsOnTrack: goals.filter((g) => g.isSufficient).length,
        totalGoals: goals.length,
        healthScore: health.score,
        grade: gradeFor(health.score),
      };

      const fallback = {
        topWin:
          savingsRate >= 20
            ? `You saved ${pct(savingsRate)} of your income this month.`
            : savings > 0
              ? `You stayed positive and saved ${inr(savings)}.`
              : "You kept tracking your money consistently.",
        topImprovement: top
          ? `${top.name} made up the largest share of your spending at ${inr(top.amount)}.`
          : "Record more expenses to find areas to improve.",
        advice:
          savingsRate >= 20
            ? `Keep the momentum going and set a cap on ${top ? top.name.toLowerCase() : "discretionary spending"} next month.`
            : "Pick one category to reduce by 10% next month and move the difference into a savings goal.",
      };

      const ai = await explainOrFallback(
        `Write a short monthly financial report card for the user. The grade is already decided: ${recapData.grade}.
Be encouraging but honest.
Return JSON:
{"topWin": "one punchy sentence about their best achievement",
 "topImprovement": "one sentence on the biggest area to focus on",
 "advice": "1-2 sentences of practical advice for next month"}`,
        recapData,
        fallback
      );

      return {
        month: key,
        grade: recapData.grade,
        healthScore: recapData.healthScore,
        topWin: ai.topWin,
        topImprovement: ai.topImprovement,
        advice: ai.advice,
        aiGenerated: ai.aiGenerated,
        aiNote: ai.aiNote,
        // Figures are added by the backend, never by the AI
        metrics: [
          `Savings Rate: ${pct(savingsRate)}`,
          `Total Saved: ${inr(savings)}`,
          top ? `Top Expense: ${top.name} (${inr(top.amount)})` : "Top Expense: none",
          recapData.hasBudget ? `Budget Used: ${pct(recapData.budgetUsedPct)}` : "Budget: not set",
        ],
        generatedAt: new Date(),
      };
    };

    const cacheKey = `${userId}:recap:${key}`;
    const data = refresh ? await build() : await cached(cacheKey, 30 * 60 * 1000, build);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Recap error:", error);
    return res.status(500).json({ success: false, message: "Unable to generate recap." });
  }
};

// ───────── GET /ai/brief  (Money Brief card on the dashboard) ─────────
export const getMoneyBrief = async (req, res) => {
  try {
    const userId = req.user.userId;
    const data = await cached(`${userId}:brief:${monthKey()}`, 20 * 60 * 1000, async () => {
      const ctx = await buildContext(userId);
      const t = ctx.thisMonth;

      if (!t.income && !t.expenses) {
        return {
          lines: ["Add your first income and expense records and your Money Brief will appear here."],
          aiGenerated: false,
          generatedAt: new Date(),
        };
      }

      const top = t.categories[0];
      const fallbackLines = [
        `You've spent ${inr(t.expenses)} this month${t.income ? ` (${pct((t.expenses / t.income) * 100)} of income)` : ""}.`,
        top ? `${top.name} leads your spending at ${inr(top.amount)}.` : "",
        t.income ? `You're on track to save ${inr(t.savings)} if spending stays where it is.` : "Add this month's income to see your savings.",
      ].filter(Boolean);

      const ai = await explainOrFallback(
        `Write a 'Money Brief' for the dashboard: exactly 3 short sentences (max 18 words each) about this month.
Mention spending, the top category and savings outlook. Return JSON: {"lines": ["sentence 1", "sentence 2", "sentence 3"]}`,
        ctx,
        { lines: fallbackLines }
      );

      return { lines: (ai.lines || fallbackLines).slice(0, 3), aiGenerated: ai.aiGenerated, generatedAt: new Date() };
    });

    return res.json({ success: true, data: { ...data, aiEnabled: isAIEnabled() } });
  } catch (error) {
    console.error("Money brief error:", error);
    return res.status(500).json({ success: false, message: "Unable to load money brief" });
  }
};

// GET /ai/status - lets the UI show whether AI is configured
export const getAIStatus = (req, res) => {
  res.json({ success: true, data: { enabled: isAIEnabled(), model: process.env.GEMINI_MODEL || "gemini-3.6-flash" } });
};

// ───────── POST /ai/parse-transaction  { text } ─────────
// Quick add / voice: rules first; the AI only fills fields the rules missed. Nothing is saved.
export const parseTransaction = async (req, res) => {
  try {
    const text = String(req.body.text || "").trim().slice(0, 300);
    const today = new Date();
    const parsed = parseQuickAdd(text, today);
    if (!parsed.items.length) {
      return res.status(400).json({ success: false, message: "Say or type something like \"250 petrol kal upi\"" });
    }

    const needsAI = parsed.items.some((i) => i.confidence !== "high") || hasDevanagariLetters(text);
    let items = parsed.items;
    let source = "rules";

    if (needsAI && isAIEnabled()) {
      try {
        const ai = await generateJSON(
          `Read this short note (English, Hindi or Hinglish; it may contain several entries) about money the user ALREADY spent or received:
"${text}"
Split it into the same ${parsed.items.length} entr${parsed.items.length === 1 ? "y" : "ies"} as these segments, in this order: ${JSON.stringify(parsed.items.map((i) => i.text))}
For each entry return:
- "type": "expense" or "income"
- "title": short name of what it was for (max 40 characters, English or the user's words)
- "amount": plain number (no currency symbol), e.g. 1500
- "category": for expenses exactly one of ${JSON.stringify(EXPENSE_CATEGORIES)}
- "source": for income exactly one of ${JSON.stringify(INCOME_SOURCES)}
- "paymentMethod": one of ${JSON.stringify(PAYMENT_METHODS)} or ""
- "date": YYYY-MM-DD. Today is ${isoDay(today)}. "kal" means yesterday here. NEVER return a date after today.
Use "" for anything you cannot tell.
Return JSON: {"items": [{"type": string, "title": string, "amount": number, "category": string, "source": string, "paymentMethod": string, "date": string}]}`,
          { today: isoDay(today), currency: (await analytics.getMoneySettings(req.user.userId)).currency },
          undefined,
          { timeoutMs: 20000, retries: 1, lenientJSON: true, useFallbackModel: true }
        );
        const merged = mergeAIItems(parsed.items, ai?.items, {
          today,
          categories: EXPENSE_CATEGORIES,
          sources: INCOME_SOURCES,
          paymentMethods: PAYMENT_METHODS,
        });
        items = merged.items;
        if (merged.filled) source = parsed.items.every((i) => i.confidence === "low") ? "ai" : "mixed";
      } catch (error) {
        if (error.code !== "AI_DISABLED") console.error("Quick add AI error:", error.message);
      }
    }

    return res.json({ success: true, data: { items, source } });
  } catch (error) {
    console.error("Parse transaction error:", error);
    return res.status(500).json({ success: false, message: "Could not understand that. Please try again." });
  }
};
