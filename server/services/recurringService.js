import RecurringTransaction from "../models/RecurringTransaction.js";
import Expense from "../models/Expense.js";
import Income from "../models/Income.js";
import { notify, checkBudgetThresholds } from "./notificationService.js";
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from "../utils/constants.js";
import { addPeriod } from "../utils/schedule.js";
import { endOfDay } from "../utils/dates.js";

// Day of month a rule keeps (older rules without anchorDay use the day of their current nextDate)
export const anchorOf = (rule) => rule.anchorDay || new Date(rule.nextDate).getDate();

// Move a date forward by one period (kept for older callers; uses the shared schedule helper)
export const nextOccurrence = (date, frequency, anchorDay) => addPeriod(date, frequency, anchorDay);

// true when this date is after the rule's last allowed day
const pastEnd = (rule, date) => Boolean(rule.endDate) && new Date(date) > endOfDay(rule.endDate);

const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Create the real income/expense records for every active rule that is due,
 * then move each rule's next date forward. Catches up missed periods
 * (e.g. if the server was off for a few days), max 24 per rule per run.
 * When the next payment would fall after the rule's endDate, the rule is
 * finished: active=false, completedAt=now and one notification is sent.
 */
export const processRecurringTransactions = async (userId) => {
  const query = { active: true, nextDate: { $lte: new Date() } };
  if (userId) query.user = userId;

  const due = await RecurringTransaction.find(query);
  let created = 0;

  for (const item of due) {
    let runs = 0;
    try {
      // Old rules may hold a name that is no longer allowed: record it as "Other"
      // and keep the original name in the notes
      const allowed = item.type === "expense" ? EXPENSE_CATEGORIES : INCOME_SOURCES;
      const known = allowed.includes(item.classification);
      const classification = known ? item.classification : "Other";
      const notes = known
        ? "Added automatically by a recurring rule"
        : `Added automatically by a recurring rule (${item.type === "expense" ? "category" : "source"}: ${String(item.classification || "").slice(0, 100)})`;

      if (!item.anchorDay) item.anchorDay = anchorOf(item);
      let lastDate = null;

      while (item.nextDate <= new Date() && runs < 24 && !pastEnd(item, item.nextDate)) {
        const base = {
          user: item.user,
          title: item.title,
          amount: item.amount,
          date: item.nextDate,
          paymentMethod: item.paymentMethod,
          isRecurring: true,
          notes,
        };
        if (item.type === "expense") await Expense.create({ ...base, category: classification });
        else await Income.create({ ...base, source: classification });

        lastDate = item.nextDate;
        item.nextDate = addPeriod(item.nextDate, item.frequency, item.anchorDay);
        runs += 1;
        created += 1;
      }
      item.lastRunAt = new Date();

      // End date reached: the next payment would fall after it, so the rule is finished
      const finished = pastEnd(item, item.nextDate);
      if (finished) {
        item.active = false;
        item.completedAt = new Date();
      }
      await item.save();

      if (finished) {
        const last = lastDate || addPeriod(item.nextDate, item.frequency, item.anchorDay, -1);
        await notify(item.user, {
          type: "recurring",
          title: `${item.title} has finished`,
          message: `${item.title} has finished (last payment on ${fmt(last)}).`,
          link: "/recurring",
          key: `recurring:${item._id}:finished`,
        });
      }
      if (!runs) continue;

      await notify(item.user, {
        type: "recurring",
        title: `Recurring ${item.type} added`,
        message: `${item.title} (₹${item.amount.toLocaleString("en-IN")}) was recorded${runs > 1 ? ` ${runs} times` : ""}. ${finished ? "That was the last payment." : `Next run: ${fmt(item.nextDate)}.`}`,
        link: "/recurring",
      });

      if (item.type === "expense") await checkBudgetThresholds(item.user);
    } catch (error) {
      // One bad rule must not stop the other rules or the bill reminders
      console.error(`Recurring rule ${item._id} ("${item.title}") failed:`, error.message);
      // Records already created in this run stay; save the moved-forward date so they are not duplicated
      if (runs > 0) await item.save().catch(() => {});
    }
  }

  return created;
};
