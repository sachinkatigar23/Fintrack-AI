import schedule from "node-schedule";
import { processRecurringTransactions } from "./recurringService.js";
import { sendBillReminders } from "./notificationService.js";

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

// Runs once at start-up, then every hour at minute 5
export const startScheduler = () => {
  runJobs("startup");
  schedule.scheduleJob("5 * * * *", () => runJobs("hourly"));
  console.log("⏰ Scheduler started (recurring transactions + bill reminders)");
};
