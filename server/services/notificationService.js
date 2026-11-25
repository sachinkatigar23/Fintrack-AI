import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Bill from "../models/Bill.js";
import { getBudgetPerformance } from "./analyticsService.js";
import { sendEmail } from "./emailService.js";
import { BUDGET_THRESHOLDS } from "../utils/constants.js";
import { monthKey, startOfDay, addDays, daysBetween } from "../utils/dates.js";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * Create a notification once. If `key` is given and already exists for this
 * user, nothing is created (prevents duplicate alerts).
 */
export const notify = async (userId, { type = "system", title, message, link = "", key }) => {
  try {
    if (key) {
      const exists = await Notification.exists({ user: userId, key });
      if (exists) return null;
    }
    return await Notification.create({ user: userId, type, title, message, link, key });
  } catch (error) {
    if (error.code === 11000) return null; // duplicate key - already notified
    console.error("Notification error:", error.message);
    return null;
  }
};

// Called after an expense is added/edited: warn at 80% and 100% of a budget
export const checkBudgetThresholds = async (userId, date = new Date()) => {
  const key = monthKey(new Date(date));
  const perf = await getBudgetPerformance(userId, key);

  for (const b of perf.items) {
    for (const threshold of BUDGET_THRESHOLDS) {
      if (b.usedPct >= threshold) {
        const created = await notify(userId, {
          type: "budget",
          title: threshold >= 100 ? `Budget exceeded: ${b.name}` : `${threshold}% of ${b.name} used`,
          message:
            threshold >= 100
              ? `You have spent ${inr(b.spentAmount)} of your ${inr(b.amount)} ${b.category} budget for ${key}.`
              : `You have used ${b.usedPct.toFixed(0)}% (${inr(b.spentAmount)} of ${inr(b.amount)}). ${inr(b.remaining)} left for ${key}.`,
          link: "/budgets",
          key: `budget:${b._id}:${threshold}`,
        });

        // Critical alert also goes by email (if email is configured)
        if (created && threshold >= 100) {
          const user = await User.findById(userId).select("email name emailAlerts");
          // emailAlerts off: the in-app notification is enough
          if (user && user.emailAlerts !== false) {
            await sendEmail({
              to: user.email,
              subject: `FinTrack AI: ${b.name} budget exceeded`,
              title: "Budget limit reached",
              html: `Hi ${user.name},<br/>${created.message}`,
            });
          }
        }
      }
    }
  }
};

// Scheduler job: remind users about bills that are due soon or overdue
export const sendBillReminders = async () => {
  const today = startOfDay();
  const bills = await Bill.find({ status: "pending", dueDate: { $lte: addDays(today, 30) } }).populate("user", "email name emailAlerts");
  let sent = 0;

  for (const bill of bills) {
    if (!bill.user) continue;
    const daysLeft = daysBetween(today, bill.dueDate);
    if (daysLeft > bill.reminderDays) continue;

    const due = new Date(bill.dueDate).toISOString().slice(0, 10);
    const overdue = daysLeft < 0;
    const title = overdue ? `Overdue: ${bill.name}` : daysLeft === 0 ? `${bill.name} is due today` : `${bill.name} due in ${daysLeft} day(s)`;
    const message = `${inr(bill.amount)} ${overdue ? "was" : "is"} due on ${new Date(bill.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`;

    const created = await notify(bill.user._id, {
      type: "bill",
      title,
      message,
      link: "/bills",
      key: `bill:${bill._id}:${due}:${overdue ? "overdue" : "reminder"}`,
    });

    if (created) {
      sent += 1;
      if (bill.user.emailAlerts === false) continue;
      await sendEmail({
        to: bill.user.email,
        subject: `FinTrack AI reminder: ${title}`,
        title: "Bill reminder",
        html: `Hi ${bill.user.name},<br/>${title}. ${message}`,
      });
    }
  }
  return sent;
};
