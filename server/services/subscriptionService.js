// ─────────────────────────────────────────────────────────────
// Subscription Detective
// detectSubscriptions() is PURE: it finds repeated payments to the same
// merchant at a regular interval (weekly / monthly / quarterly / yearly).
// The rest of the file holds the thin DB wrappers used by the API and scheduler.
// ─────────────────────────────────────────────────────────────
import Expense from "../models/Expense.js";
import RecurringTransaction from "../models/RecurringTransaction.js";
import SubscriptionPref from "../models/SubscriptionPref.js";
import * as analytics from "./analyticsService.js";
import { notify } from "./notificationService.js";
import { addPeriod, monthlyEquivalent } from "../utils/schedule.js";
import { startOfDay, addDays } from "../utils/dates.js";
import { EXPENSE_CATEGORIES } from "../utils/constants.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DAY = 86400000;
const dayDiff = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

const STOP_WORDS = new Set([
  "payment", "paid", "bill", "subscription", "sub", "monthly", "yearly", "renewal", "upi",
  "autopay", "auto", "debit", "txn", "ref", "to", "for", "the", "a",
]);

// "Netflix payment #123 (UPI)" -> "netflix"
export const merchantKey = (title) =>
  String(title || "")
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ") // digits and punctuation
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .join(" ")
    .trim();

const CLASSES = [
  ["weekly", 6, 8],
  ["monthly", 26, 35],
  ["quarterly", 84, 98],
  ["yearly", 350, 380],
];

const SUBSCRIPTION_CATEGORIES = ["Entertainment", "Education", "Shopping", "Bills & Utilities"];

const median = (list) => {
  const s = [...list].sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const withinPct = (value, base, pct) => Math.abs(value - base) <= base * pct;

/**
 * @param {Array} expenses       [{ title, amount, date, category, paymentMethod }]
 * @param {Date}  today
 * @param {Array} recurringRules [{ title, active }]
 * @param {Array} prefs          [{ key, dismissed, remind }]
 * @param {{ avgMonthlyIncome?: number }} [options]
 */
export const detectSubscriptions = (expenses = [], today = new Date(), recurringRules = [], prefs = [], options = {}) => {
  const t0 = startOfDay(today);
  const since = addDays(t0, -400);
  const prefByKey = new Map(prefs.map((p) => [p.key, p]));
  const trackedKeys = new Set(recurringRules.filter((r) => r.active).map((r) => merchantKey(r.title)).filter(Boolean));

  // 1-3. group by merchant key (last 400 days)
  const groups = new Map();
  for (const e of expenses) {
    const date = new Date(e.date);
    if (date < since || date > addDays(t0, 1)) continue;
    const key = merchantKey(e.title);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...e, date, amount: Number(e.amount) || 0 });
  }

  const found = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date - b.date);

    // Records less than 5 days apart are one payment (amounts added up)
    const merged = [];
    for (const e of list) {
      const last = merged[merged.length - 1];
      if (last && dayDiff(last.date, e.date) < 5) {
        last.amount = round2(last.amount + e.amount);
        last.latest = e;
      } else merged.push({ date: e.date, amount: e.amount, latest: e });
    }
    if (merged.length < 2) continue;

    // 4. frequency from the median interval; >= 75% of intervals must fit the class
    const intervals = merged.slice(1).map((m, i) => dayDiff(merged[i].date, m.date));
    const med = median(intervals);
    const cls = CLASSES.find(([, lo, hi]) => med >= lo && med <= hi);
    if (!cls) continue;
    const [frequency, lo, hi] = cls;
    const fitting = intervals.filter((d) => d >= lo && d <= hi).length;
    const regular = fitting / intervals.length >= 0.75;
    if (!regular) continue;

    // 5. amounts
    const amounts = merged.map((m) => m.amount);
    const typical = round2(median(amounts));
    const lastAmount = amounts[amounts.length - 1];
    const prevAmount = amounts[amounts.length - 2];
    const allClose = amounts.every((a) => withinPct(a, typical, 0.15));
    const onlyLastDiffers = amounts.slice(0, -1).every((a) => withinPct(a, typical, 0.15));
    const stable = allClose || onlyLastDiffers;
    const lastEntry = merged[merged.length - 1];
    const priceChange =
      Math.abs(lastAmount - prevAmount) > prevAmount * 0.02 && Math.abs(lastAmount - prevAmount) >= 1
        ? {
            from: round2(prevAmount),
            to: round2(lastAmount),
            pct: round2(((lastAmount - prevAmount) / prevAmount) * 100),
            date: lastEntry.date,
          }
        : null;

    // 6. confidence
    let confidence = null;
    if (merged.length >= 3 && regular && stable) confidence = "high";
    else if (merged.length === 2 && stable) confidence = "medium";
    if (!confidence) continue;

    // 7. next expected charge and status
    const lastDate = lastEntry.date;
    const nextExpected = frequency === "weekly" ? addDays(lastDate, 7) : addPeriod(lastDate, frequency, lastDate.getDate());
    let status = "detected";
    if (trackedKeys.has(key)) status = "tracked";
    else if (t0 > addDays(startOfDay(nextExpected), 10)) status = "missed";

    // 8-9. kind and costs
    const latest = lastEntry.latest;
    const category = EXPENSE_CATEGORIES.includes(latest.category) ? latest.category : "Other";
    const monthlyCost = round2(monthlyEquivalent(lastAmount, frequency));
    const pref = prefByKey.get(key);

    found.push({
      key,
      name: String(latest.title || key).trim(),
      category,
      kind: SUBSCRIPTION_CATEGORIES.includes(category) ? "subscription" : "regular payment",
      frequency,
      typical,
      lastAmount: round2(lastAmount),
      lastDate,
      nextExpected,
      daysUntil: dayDiff(t0, nextExpected),
      occurrences: merged.length,
      monthlyCost,
      yearlyCost: round2(monthlyCost * 12),
      paymentMethod: latest.paymentMethod || "upi",
      confidence,
      status,
      priceChange,
      dismissed: Boolean(pref?.dismissed),
      remind: pref ? pref.remind !== false : true,
    });
  }

  found.sort((a, b) => b.monthlyCost - a.monthlyCost);
  const items = found.filter((i) => !i.dismissed);
  const hidden = found.filter((i) => i.dismissed);

  // Totals: visible items that still look active (missed ones are probably cancelled)
  const counted = items.filter((i) => i.status !== "missed");
  const monthly = round2(counted.reduce((s, i) => s + i.monthlyCost, 0));
  const income = Number(options.avgMonthlyIncome) || 0;
  return {
    items,
    hidden,
    totals: {
      monthly,
      yearly: round2(monthly * 12),
      pctOfIncome: income > 0 ? round2((monthly / income) * 100) : null,
      count: items.length,
    },
  };
};

// ───────── DB wrappers ─────────
const averageMonthlyIncome = async (userId) => {
  const trend = await analytics.getMonthlyTrend(userId, 4);
  const full = trend.slice(0, 3).filter((m) => m.income > 0);
  return full.length ? full.reduce((s, m) => s + m.income, 0) / full.length : 0;
};

export const getSubscriptions = async (userId, today = new Date()) => {
  const [expenses, rules, prefs, avgMonthlyIncome] = await Promise.all([
    Expense.find({ user: userId, date: { $gte: addDays(startOfDay(today), -400) } })
      .select("title amount date category paymentMethod")
      .lean(),
    RecurringTransaction.find({ user: userId, active: true }).select("title active").lean(),
    SubscriptionPref.find({ user: userId }).lean(),
    averageMonthlyIncome(userId),
  ]);
  return detectSubscriptions(expenses, today, rules, prefs, { avgMonthlyIncome });
};

export const setPref = (userId, key, changes) =>
  SubscriptionPref.findOneAndUpdate({ user: userId, key }, { $set: changes }, { upsert: true, returnDocument: "after", runValidators: true });

// The first date after today on this subscription's schedule
export const nextFutureDate = (item, today = new Date()) => {
  const tomorrow = startOfDay(addDays(today, 1));
  const anchor = new Date(item.lastDate).getDate();
  let d = new Date(item.nextExpected);
  for (let i = 0; d < tomorrow && i < 400; i++) {
    d = item.frequency === "weekly" ? addDays(d, 7) : addPeriod(d, item.frequency, anchor);
  }
  return d;
};

// Daily 09:00: renewal reminders (within 3 days) and price-change alerts
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const shortDay = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const isoDay = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export const sendSubscriptionAlerts = async (today = new Date(), userIds = null) => {
  const users = userIds || (await Expense.distinct("user", { date: { $gte: addDays(startOfDay(today), -60) } }));
  let sent = 0;
  for (const userId of users) {
    try {
      const { items } = await getSubscriptions(userId, today);
      for (const item of items) {
        if (!item.remind) continue;
        if (item.status !== "missed" && item.daysUntil >= 0 && item.daysUntil <= 3) {
          const created = await notify(userId, {
            type: "subscription",
            title: `${item.name} renews soon`,
            message: `${item.name} renews on ${shortDay(item.nextExpected)} (${inr(item.lastAmount)}).`,
            link: "/subscriptions",
            key: `sub:${item.key}:${isoDay(item.nextExpected)}`,
          });
          if (created) sent += 1;
        }
        // Only recent price changes (last 35 days) are announced
        if (item.priceChange && dayDiff(item.priceChange.date, today) <= 35) {
          const up = item.priceChange.to > item.priceChange.from;
          const created = await notify(userId, {
            type: "subscription",
            title: `${item.name} price ${up ? "went up" : "went down"}`,
            message: `${item.name} went ${up ? "up" : "down"} from ${inr(item.priceChange.from)} to ${inr(item.priceChange.to)} (${up ? "+" : ""}${Math.round(item.priceChange.pct)}%).`,
            link: "/subscriptions",
            key: `subprice:${item.key}:${isoDay(item.priceChange.date)}`,
          });
          if (created) sent += 1;
        }
      }
    } catch (error) {
      console.error(`Subscription alerts for ${userId} failed:`, error.message);
    }
  }
  return sent;
};
