import schedule from "node-schedule";
import { processRecurringTransactions } from "./recurringService.js";
import { sendBillReminders } from "./notificationService.js";
import { copyRepeatingBudgets } from "./budgetService.js";
import { sendShortfallAlerts } from "./planningService.js";

const runJobs = async (label) => {
  try {
    const created = await processRecurringTransactions();
    const reminders = await sendBillReminders();
    if (created || reminders) {
      console.log(`⏰ [${label}] recurring records created: ${created}, bill reminders: ${reminders}`);
    }
  } catch (error) {
    console.error("Scheduler error:", error.message);
  }
};

// Daily (and at start-up): budgets marked "Repeat every month" are created for the new month
const runBudgetRepeat = async (label) => {
  try {
    const copied = await copyRepeatingBudgets();
    if (copied) console.log(`⏰ [${label}] repeating budgets created: ${copied}`);
  } catch (error) {
    console.error("Budget repeat error:", error.message);
  }
};

// Daily 09:00: money alerts (may run short before payday)
const runMorningAlerts = async (label) => {
  try {
    const short = await sendShortfallAlerts();
    if (short) console.log(`⏰ [${label}] shortfall alerts: ${short}`);
  } catch (error) {
    console.error("Morning alerts error:", error.message);
  }
};

// Runs once at start-up, then every hour at minute 5; budget repeat daily at 00:10; alerts daily at 09:00
export const startScheduler = () => {
  runJobs("startup");
  runBudgetRepeat("startup");
  schedule.scheduleJob("5 * * * *", () => runJobs("hourly"));
  schedule.scheduleJob("10 0 * * *", () => runBudgetRepeat("daily"));
  schedule.scheduleJob("0 9 * * *", () => runMorningAlerts("09:00"));
  console.log("⏰ Scheduler started (recurring transactions, bill reminders, repeating budgets, money alerts)");
};
