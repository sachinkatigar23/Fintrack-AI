// ─────────────────────────────────────────────────────────────
// Logging streak
// A "logged day" is a calendar day (Asia/Kolkata) on which the user CREATED at
// least one income or expense themselves (manual add, quick add / voice, receipt
// scan, paying a bill). It counts by when it was logged (createdAt), not by the
// transaction date. Records the scheduler makes from recurring rules don't count.
// computeStreak() is PURE; getStreak() loads the days and sends milestone notices.
// ─────────────────────────────────────────────────────────────
import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import Income from "../models/Income.js";
import { notify } from "./notificationService.js";

export const MILESTONES = [3, 7, 14, 30, 60, 100];
const LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const shift = (d, days) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * @param {string[]} loggedDays  "YYYY-MM-DD" days with at least one user-logged record
 * @param {Date} today
 * @returns {{ current, best, status, loggedToday, last7, nextMilestone, daysToNext, runStart, milestoneReached }}
 */
export const computeStreak = (loggedDays = [], today = new Date()) => {
  const t0 = startOfDay(today);
  const todayKey = dayKey(t0);
  const days = new Set(loggedDays.filter((d) => typeof d === "string" && d <= todayKey));
  const loggedToday = days.has(todayKey);
  const loggedYesterday = days.has(dayKey(shift(t0, -1)));

  // current: consecutive days ending today, or ending yesterday when today isn't logged yet
  let cursor = loggedToday ? t0 : shift(t0, -1);
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor = shift(cursor, -1);
  }
  const runStart = current ? dayKey(shift(cursor, 1)) : null;

  let status;
  if (!days.size) status = "new";
  else if (loggedToday) status = "active";
  else if (loggedYesterday) status = "at_risk";
  else status = "broken";

  // best: longest run in the last 365 days (today included)
  let best = 0;
  let run = 0;
  for (let i = 364; i >= 0; i--) {
    if (days.has(dayKey(shift(t0, -i)))) {
      run += 1;
      best = Math.max(best, run);
    } else run = 0;
  }
  best = Math.max(best, current);

  const nextMilestone = MILESTONES.find((m) => m > current) ?? null;
  const daysToNext = nextMilestone ? nextMilestone - current : 0;
  const milestoneReached = status === "active" && MILESTONES.includes(current) ? current : null;

  const last7 = Array.from({ length: 7 }, (_, n) => {
    const d = shift(t0, n - 6);
    const key = dayKey(d);
    return { date: key, label: LABELS[d.getDay()], logged: days.has(key), isToday: n === 6 };
  });

  return { current, best, status, loggedToday, last7, nextMilestone, daysToNext, runStart, milestoneReached };
};

// A record the person logged themselves (older automatic records have no createdBy but notes "Added automatically…")
export const isUserLogged = (r) => r?.createdBy !== "system" && !/^Added automatically/.test(String(r?.notes || ""));

// Pure version of getLoggedDays for a list of records (local calendar days of createdAt)
export const loggedDaysFrom = (records = []) => [
  ...new Set(records.filter(isUserLogged).map((r) => dayKey(new Date(r.createdAt)))),
];

// Days with at least one record the user logged themselves (same rule as isUserLogged, done in the database)
export const getLoggedDays = async (userId, today = new Date()) => {
  const tz = process.env.TZ || "Asia/Kolkata";
  const pipeline = [
    {
      $match: {
        user: new mongoose.Types.ObjectId(String(userId)),
        createdAt: { $gte: shift(startOfDay(today), -400) },
        createdBy: { $ne: "system" },
        notes: { $not: /^Added automatically/ },
      },
    },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } } } },
  ];
  const [a, b] = await Promise.all([Expense.aggregate(pipeline), Income.aggregate(pipeline)]);
  return [...new Set([...a, ...b].map((r) => r._id))];
};

export const getStreak = async (userId, today = new Date()) => {
  const streak = computeStreak(await getLoggedDays(userId, today), today);
  // Milestone reached today: one notification per milestone per streak run
  if (streak.milestoneReached) {
    await notify(userId, {
      type: "streak",
      title: `🔥 ${streak.milestoneReached}-day logging streak!`,
      message: `You've logged your money ${streak.milestoneReached} days in a row. Keep it going!`,
      link: "/dashboard",
      key: `streak:${streak.milestoneReached}:${streak.runStart}`,
    });
  }
  return streak;
};
