import RecurringTransaction from "../models/RecurringTransaction.js";
import Expense from "../models/Expense.js";
import Income from "../models/Income.js";
import { notify, checkBudgetThresholds } from "./notificationService.js";
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from "../utils/constants.js";

// Move a date forward by one period
export const nextOccurrence = (date, frequency) => {
  const value = new Date(date);
  if (frequency === "daily") value.setDate(value.getDate() + 1);
  else if (frequency === "weekly") value.setDate(value.getDate() + 7);
  else if (frequency === "yearly") value.setFullYear(value.getFullYear() + 1);
  else value.setMonth(value.getMonth() + 1);
  return value;
};

/**
 * Create the real income/expense records for every active rule that is due,
 * then move each rule's next date forward. Catches up missed periods
 * (e.g. if the server was off for a few days), max 24 per rule per run.
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

      while (item.nextDate <= new Date() && runs < 24) {
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

        item.nextDate = nextOccurrence(item.nextDate, item.frequency);
        runs += 1;
        created += 1;
      }
      item.lastRunAt = new Date();
      await item.save();

      await notify(item.user, {
        type: "recurring",
        title: `Recurring ${item.type} added`,
        message: `${item.title} (₹${item.amount.toLocaleString("en-IN")}) was recorded${runs > 1 ? ` ${runs} times` : ""}. Next run: ${item.nextDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`,
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
