import "dotenv/config";
// Day boundaries ("today", months) are local time in India unless TZ is set
process.env.TZ = process.env.TZ || "Asia/Kolkata";
import app from "./app.js";
import connectDB from "./config/db.js";
import { startScheduler } from "./services/scheduler.js";

// Load .env before anything else reads process.env (see "dotenv/config" above)

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  // Background jobs: recurring transactions + bill reminders
  startScheduler();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

start();
