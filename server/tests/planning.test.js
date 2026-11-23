import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSafeToSpend, computeAffordability, findPayday } from "../services/planningService.js";

// Monday 23 Nov 2026, salary on the 1st -> payday 1 Dec, 8 days left (23..30 Nov)
const TODAY = new Date(2026, 10, 23, 12, 0);
const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

const base = (over = {}) => ({
  today: TODAY,
  settings: { openingBalance: 0, salaryDay: 1, safetyBuffer: 0 },
  totals: { totalIncome: 20000, totalExpenses: 10000, incomeCount: 1 },
  goals: [],
  bills: [],
  recurringRules: [],
  todayExpenses: [],
  // 9,000 of everyday spending in 30 days -> 300 a day
  recentExpenses: [
    { amount: 9000, category: "Food & Dining", isRecurring: false },
    { amount: 6500, category: "Rent & Housing", isRecurring: false },
    { amount: 199, category: "Entertainment", isRecurring: true },
  ],
  budget: null,
  ...over,
});

const goal = (over = {}) => ({
  _id: "g1",
  name: "New laptop",
  status: "active",
  targetAmount: 20000,
  savedAmount: 2000,
  // 181 days away -> 6 months remaining -> 3,000 a month
  targetDate: new Date(2027, 4, 23),
  contributions: [],
  ...over,
});

test("payday: next salary day, or next month's on the salary day itself", () => {
  assert.deepEqual(ymd(findPayday({ today: TODAY, salaryDay: 1 }).payday), [2026, 12, 1]);
  assert.deepEqual(ymd(findPayday({ today: TODAY, salaryDay: 25 }).payday), [2026, 11, 25]);
  assert.deepEqual(ymd(findPayday({ today: TODAY, salaryDay: 23 }).payday), [2026, 12, 23]);
  // clamped to the month length
  assert.deepEqual(ymd(findPayday({ today: new Date(2027, 1, 10), salaryDay: 31 }).payday), [2027, 2, 28]);
  // an active recurring income within 45 days wins
  const rule = { type: "income", active: true, frequency: "monthly", nextDate: new Date(2026, 10, 28), anchorDay: 28 };
  assert.deepEqual(ymd(findPayday({ today: TODAY, salaryDay: 1, incomeRules: [rule] }).payday), [2026, 11, 28]);
});

test("comfortable: spendable / days left", () => {
  const s = computeSafeToSpend(base());
  assert.equal(s.status, "comfortable");
  assert.equal(s.daysLeft, 8);
  assert.equal(s.balance, 10000);
  assert.equal(s.spendable, 10000);
  assert.equal(s.dailyAllowance, 1250);
  assert.equal(s.leftToday, 1250);
  assert.equal(s.limitedBy, "money");
  assert.equal(s.avgDailySpend, 300);
});

test("today's spending is added back so the daily allowance stays stable", () => {
  const s = computeSafeToSpend(
    base({ totals: { totalIncome: 20000, totalExpenses: 10400, incomeCount: 1 }, todayExpenses: [{ amount: 400, category: "Shopping" }] })
  );
  assert.equal(s.spendable, 9600);
  assert.equal(s.dailyAllowance, 1250);
  assert.equal(s.leftToday, 850);
});

test("tight: daily allowance below 80% of the usual daily spend", () => {
  const s = computeSafeToSpend(base({ totals: { totalIncome: 20000, totalExpenses: 18500, incomeCount: 1 } }));
  assert.equal(s.dailyAllowance, 187.5);
  assert.equal(s.status, "tight");
});

test("short: bills before payday are more than the money", () => {
  const s = computeSafeToSpend(
    base({
      totals: { totalIncome: 20000, totalExpenses: 18500, incomeCount: 1 },
      bills: [{ _id: "b1", name: "Credit card", amount: 2000, dueDate: new Date(2026, 10, 28), status: "pending" }],
    })
  );
  assert.equal(s.status, "short");
  assert.equal(s.spendable, -500);
  assert.equal(s.shortBy, 500);
  assert.equal(s.leftToday, 0);
});

test("setup: no income, no starting balance", () => {
  const s = computeSafeToSpend(base({ totals: { totalIncome: 0, totalExpenses: 0, incomeCount: 0 } }));
  assert.equal(s.status, "setup");
  // a starting balance is enough to leave setup
  const withOpening = computeSafeToSpend(
    base({ settings: { openingBalance: 5000, salaryDay: 1, safetyBuffer: 0 }, totals: { totalIncome: 0, totalExpenses: 0, incomeCount: 0 } })
  );
  assert.notEqual(withOpening.status, "setup");
  assert.equal(withOpening.balance, 5000);
});

test("budget-limited: the monthly budget is the tighter limit", () => {
  const s = computeSafeToSpend(
    base({
      budget: { totalBudget: 5000, remaining: 800, hasOverall: true, categories: ["Overall"] },
      todayExpenses: [{ amount: 0, category: "Food & Dining" }],
    })
  );
  // (800 + 0) / 8 days left in November = 100
  assert.equal(s.budgetLeftToday, 100);
  assert.equal(s.leftToday, 100);
  assert.equal(s.limitedBy, "budget");
});

test("budget only counts spending in budgeted categories", () => {
  const s = computeSafeToSpend(
    base({
      totals: { totalIncome: 20000, totalExpenses: 10300, incomeCount: 1 },
      budget: { totalBudget: 3000, remaining: 700, hasOverall: false, categories: ["Shopping"] },
      todayExpenses: [
        { amount: 100, category: "Shopping" },
        { amount: 200, category: "Transport" },
      ],
    })
  );
  // tracked today = 100 -> (700 + 100) / 8 = 100 -> 100 - 100 = 0 left
  assert.equal(s.budgetLeftToday, 0);
  assert.equal(s.limitedBy, "budget");
});

test("recurring payments before payday are counted, and a matching bill is not counted twice", () => {
  const s = computeSafeToSpend(
    base({
      bills: [{ _id: "b1", name: "Wi-Fi (ACT)", amount: 799, dueDate: new Date(2026, 10, 27), status: "pending" }],
      recurringRules: [
        // same name, amount within 10%, date within 5 days -> skipped
        { _id: "r1", title: "wi-fi  (act)", amount: 760, type: "expense", frequency: "monthly", nextDate: new Date(2026, 10, 26), active: true },
        { _id: "r2", title: "Netflix", amount: 249, type: "expense", frequency: "monthly", nextDate: new Date(2026, 10, 25), active: true },
        // weekly: 24 Nov and 1 Dec -> only 24 Nov is before payday
        { _id: "r3", title: "Milk", amount: 100, type: "expense", frequency: "weekly", nextDate: new Date(2026, 10, 24), active: true },
        // due earlier but not processed yet -> still counted
        { _id: "r4", title: "Gym", amount: 500, type: "expense", frequency: "monthly", nextDate: new Date(2026, 10, 20), active: true },
        // ended before its next date -> not counted
        { _id: "r5", title: "Old EMI", amount: 1000, type: "expense", frequency: "monthly", nextDate: new Date(2026, 10, 25), endDate: new Date(2026, 10, 1), active: true },
        { _id: "r6", title: "Paused", amount: 999, type: "expense", frequency: "monthly", nextDate: new Date(2026, 10, 25), active: false },
      ],
    })
  );
  assert.equal(s.billsDueTotal, 799);
  assert.deepEqual(s.recurringDue.map((r) => r.name).sort(), ["Gym", "Milk", "Netflix"]);
  assert.equal(s.recurringDueTotal, 849);
  assert.equal(s.spendable, 10000 - 799 - 849);

  // the breakdown adds up to spendable
  const b = Object.fromEntries(s.breakdown.map((l) => [l.key, l.amount]));
  assert.equal(b.balance - b.goalReserve - b.bills - b.recurring - b.goalSavings - b.buffer, b.spendable);
  // timeline is sorted and shows money left after each item
  assert.deepEqual(s.timeline.map((t) => t.name), ["Gym", "Milk", "Netflix", "Wi-Fi (ACT)"]);
  assert.equal(s.timeline.at(-1).leftAfter, 10000 - 799 - 849);
});

test("goal savings: required monthly minus what was saved this pay cycle", () => {
  const s = computeSafeToSpend(
    base({
      goals: [
        goal({
          contributions: [
            { amount: 5000, type: "deposit", date: new Date(2026, 9, 20) }, // before the cycle (1 Nov)
            { amount: 1000, type: "deposit", date: new Date(2026, 10, 5) },
            { amount: 200, type: "withdrawal", date: new Date(2026, 10, 10) },
          ],
        }),
        // completed goals are reserved but need no more savings; archived goals are ignored
        goal({ _id: "g2", name: "Trip", status: "completed", savedAmount: 1500, targetAmount: 1500 }),
        goal({ _id: "g3", name: "Old", status: "archived", savedAmount: 9999 }),
      ],
      settings: { openingBalance: 0, salaryDay: 1, safetyBuffer: 500 },
    })
  );
  assert.equal(s.goalPlan.length, 1);
  assert.equal(s.goalPlan[0].requiredMonthly, 3000);
  assert.equal(s.goalPlan[0].contributedThisCycle, 800);
  assert.equal(s.goalContributionsDue, 2200);
  assert.equal(s.goalReserve, 3500);
  assert.equal(s.buffer, 500);
  assert.equal(s.spendable, 10000 - 3500 - 2200 - 500);
});

// ───────── Can I afford this? ─────────
// spendable 5,000 (10,000 - 2,000 in goals - 3,000 goal savings), 8 days -> 625/day
const affordBase = () => computeSafeToSpend(base({ goals: [goal()] }));
const goals = [goal()];

test("A: yes - fits in today's amount", () => {
  const sts = affordBase();
  assert.equal(sts.leftToday, 625);
  const r = computeAffordability({ sts, amount: 500, goals });
  assert.equal(r.verdict, "yes");
  assert.match(r.headline, /fits in today's ₹625/);
});

test("B: yes_but - daily amount drops until payday", () => {
  const r = computeAffordability({ sts: affordBase(), amount: 3000, goals });
  assert.equal(r.verdict, "yes_but");
  assert.equal(r.numbers.newDailyAllowance, 250);
  assert.match(r.headline, /drops from ₹625 to ₹250/);
});

test("C: skip_goal_savings - names the goal and how many days it slips", () => {
  const r = computeAffordability({ sts: affordBase(), amount: 6000, goals });
  assert.equal(r.verdict, "skip_goal_savings");
  assert.equal(r.numbers.skipGoalSavings, 1000);
  // ceil(1000 / (3000 / 30.44)) = 11
  assert.equal(r.numbers.slipDays, 11);
  assert.match(r.headline, /New laptop slips about 11 days/);
});

test("D: use_savings - takes the rest from goal savings", () => {
  const r = computeAffordability({ sts: affordBase(), amount: 9000, goals });
  assert.equal(r.verdict, "use_savings");
  assert.equal(r.numbers.fromSavings, 1000);
  assert.deepEqual(r.numbers.fromGoals.map((g) => g.name), ["New laptop"]);
});

test("E: no - with a suggested date from monthly savings", () => {
  const r = computeAffordability({ sts: affordBase(), amount: 20000, goals, monthlyNet: 5000 });
  assert.equal(r.verdict, "no");
  assert.equal(r.numbers.shortBy, 15000);
  // 3 months of saving -> 2 months after payday (1 Dec) = 1 Feb 2027
  assert.deepEqual(ymd(r.suggestedDate), [2027, 2, 1]);
});

test("E: no - without monthly savings there is no suggested date", () => {
  const r = computeAffordability({ sts: affordBase(), amount: 20000, goals, monthlyNet: -200 });
  assert.equal(r.verdict, "no");
  assert.equal(r.suggestedDate, null);
  assert.ok(r.details.some((d) => /aren't saving each month/.test(d)));
});

test("budget warnings are added to any verdict", () => {
  const r = computeAffordability({
    sts: affordBase(),
    amount: 500,
    category: "Shopping",
    goals,
    budgetItems: [
      { category: "Shopping", remaining: 400 },
      { category: "Overall", remaining: 300 },
    ],
  });
  assert.equal(r.verdict, "yes");
  assert.deepEqual(r.warnings, ["This is ₹100 over your Shopping budget.", "This is ₹200 over your Overall budget."]);
});
