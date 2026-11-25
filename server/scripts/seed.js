// ─────────────────────────────────────────────────────────────
// Demo data for presentations:  npm run seed
// Creates (or resets) ONLY these two accounts - other users are never touched:
//   demo@fintrack.ai  / Demo@1234   (normal user "Aditya" with ~4 months of data)
//   admin@fintrack.ai / Admin@1234  (administrator)
// ─────────────────────────────────────────────────────────────
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Expense from "../models/Expense.js";
import Income from "../models/Income.js";
import Budget from "../models/Budget.js";
import SavingsGoal from "../models/SavingsGoal.js";
import Bill from "../models/Bill.js";
import RecurringTransaction from "../models/RecurringTransaction.js";
import Notification from "../models/Notification.js";
import SubscriptionPref from "../models/SubscriptionPref.js";
import { addPeriod } from "../utils/schedule.js";
import { hashPassword } from "../utils/authUtils.js";
import { monthKey, addMonths, addDays, startOfMonth } from "../utils/dates.js";
import { checkBudgetThresholds } from "../services/notificationService.js";

// Small deterministic random generator so every seed looks the same
let s = 42;
const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const between = (min, max) => Math.round(min + rand() * (max - min));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const today = new Date();
const dayOf = (monthStart, day) => {
  const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day, between(9, 21), between(0, 59));
  return d;
};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing in server/.env");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected. Seeding demo data...");

  // Reset only the demo accounts
  for (const email of ["demo@fintrack.ai", "admin@fintrack.ai"]) {
    const old = await User.findOne({ email });
    if (old) {
      const owner = { user: old._id };
      await Promise.all([
        Expense.deleteMany(owner), Income.deleteMany(owner), Budget.deleteMany(owner),
        SavingsGoal.deleteMany(owner), Bill.deleteMany(owner), RecurringTransaction.deleteMany(owner),
        Notification.deleteMany(owner), SubscriptionPref.deleteMany(owner),
      ]);
      await old.deleteOne();
    }
  }

  const demo = await User.create({
    name: "Aditya Kulkarni",
    email: "demo@fintrack.ai",
    passwordHash: await hashPassword("Demo@1234"),
    currency: "INR",
    darkModePref: true,
    emailVerified: true,
    // demo addresses aren't real inboxes: no sign-in alerts or budget / bill emails
    loginAlerts: false,
    emailAlerts: false,
    // Money settings (Safe to spend)
    openingBalance: 25000,
    salaryDay: 1,
    safetyBuffer: 2000,
  });
  await User.create({
    name: "Admin",
    email: "admin@fintrack.ai",
    passwordHash: await hashPassword("Admin@1234"),
    role: "admin",
    darkModePref: true,
    emailVerified: true,
    loginAlerts: false,
    emailAlerts: false,
  });

  const user = demo._id;
  const incomes = [];
  const expenses = [];

  // 3 past months + current month (up to today)
  for (let m = -3; m <= 0; m++) {
    const ms = startOfMonth(addMonths(today, m));
    const lastDay = m === 0 ? today.getDate() : new Date(ms.getFullYear(), ms.getMonth() + 1, 0).getDate();
    const add = (day, e) => {
      if (day <= lastDay) expenses.push({ user, date: dayOf(ms, day), paymentMethod: "upi", ...e });
    };

    // Income
    incomes.push({ user, title: "Salary", amount: 35000, source: "Salary", paymentMethod: "bankTransfer", date: dayOf(ms, 1), isRecurring: true });
    if (lastDay >= 5) incomes.push({ user, title: "Rent", amount: 8000, source: "Rental", paymentMethod: "cash", date: dayOf(ms, 5) });
    if (m !== -2 && lastDay >= 18) incomes.push({ user, title: "Freelance website", amount: between(4000, 7000), source: "Freelance", paymentMethod: "upi", date: dayOf(ms, 18) });

    // Fixed costs
    add(2, { title: "PG rent", amount: 6500, category: "Rent & Housing", paymentMethod: "bankTransfer" });
    add(6, { title: "Electricity bill", amount: between(850, 1300), category: "Bills & Utilities" });
    add(8, { title: "Jio recharge", amount: 349, category: "Bills & Utilities" });

    // Groceries & food
    [3, 9, 16, 23, 29].forEach((d) => add(d, { title: pick(["DMart groceries", "Reliance Fresh", "BigBasket order"]), amount: between(450, 1100), category: "Food & Dining" }));
    [4, 7, 12, 15, 20, 26].forEach((d) => add(d, { title: pick(["Swiggy order", "Zomato dinner", "Hotel Naveen lunch"]), amount: between(180, 520), category: "Food & Dining" }));

    // Transport
    [5, 11, 17, 24].forEach((d) => add(d, { title: pick(["Petrol", "Rapido ride", "Uber to college"]), amount: between(120, 650), category: "Transport" }));

    // Small repeated purchases -> money leak (tea & snacks)
    const leakDays = m === 0 ? [1, 2, 3, 4, 6, 8, 9, 11, 13, 14, 16, 18, 20] : [2, 5, 9, 13, 19, 25];
    leakDays.forEach((d) => add(d, { title: "Tea & snacks", amount: between(30, 70), category: "Food & Dining", paymentMethod: "cash" }));
    if (m === 0) [3, 7, 12, 17].forEach((d) => add(d, { title: "Cold drink", amount: between(40, 60), category: "Food & Dining", paymentMethod: "upi" }));

    // Shopping / entertainment / health / education
    add(between(13, 22), { title: pick(["Amazon order", "Myntra shirt", "Decathlon"]), amount: between(600, 1800), category: "Shopping", paymentMethod: "card" });
    add(between(14, 27), { title: pick(["Movie - PVR", "Bowling with friends"]), amount: between(350, 800), category: "Entertainment" });
    if (m === -1) add(21, { title: "Pharmacy", amount: 420, category: "Health" });
    if (m === -3) add(12, { title: "Udemy course", amount: 499, category: "Education", paymentMethod: "card" });

    // Current month: a clear shopping spike (anomaly) + a big one-off purchase
    if (m === 0) {
      add(Math.min(lastDay, 10), { title: "Diwali shopping", amount: 4200, category: "Shopping", paymentMethod: "card" });
      add(Math.min(lastDay, 14), { title: "Headphones - Croma", amount: 3499, category: "Shopping", paymentMethod: "card" });
    }
  }

  // ── Subscriptions (for the Subscription Detective) ──
  // The most recent `count` dates on a schedule that are not after today
  const pastDates = (day, frequency, count) => {
    let d = new Date(today.getFullYear(), today.getMonth(), day, 10, 0);
    while (d > today) d = addPeriod(d, frequency, day, -1);
    const out = [];
    for (let i = count - 1; i >= 0; i--) out.push(addPeriod(d, frequency, day, -i));
    return out;
  };
  // Netflix: monthly for 5 months, 199 -> 249 in the latest month
  pastDates(10, "monthly", 5).forEach((date, i, all) =>
    expenses.push({ user, title: "Netflix", amount: i === all.length - 1 ? 249 : 199, category: "Entertainment", paymentMethod: "card", date })
  );
  // Spotify: 119 monthly
  pastDates(15, "monthly", 4).forEach((date) =>
    expenses.push({ user, title: "Spotify Premium", amount: 119, category: "Entertainment", paymentMethod: "upi", date })
  );
  // Gym: 2,999 every quarter
  pastDates(4, "quarterly", 3).forEach((date) =>
    expenses.push({ user, title: "Gym", amount: 2999, category: "Health", paymentMethod: "card", date })
  );

  await Income.insertMany(incomes);
  await Expense.insertMany(expenses);

  // Budgets for the current month
  const month = monthKey(today);
  // repeat: true -> created again automatically next month
  await Budget.insertMany([
    { user, name: "Food budget", amount: 6000, category: "Food & Dining", month, repeat: true },
    { user, name: "Shopping limit", amount: 5000, category: "Shopping", month, repeat: true },
    { user, name: "Transport", amount: 2500, category: "Transport", month, repeat: true },
    { user, name: "Fun money", amount: 1500, category: "Entertainment", month, repeat: true },
  ]);

  // Overall budget for the month: sized so the demo's Safe to spend is limited by the
  // budget at roughly ₹1,100 a day (whatever day the seed runs), and never smaller than
  // the category budgets added together (15,000), so there is no consistency warning.
  const monthStart = startOfMonth(today);
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // whole days, like the budget (seeded times today can be later than now)
  const spentMonth = expenses.filter((e) => e.date >= monthStart).reduce((s, e) => s + e.amount, 0);
  const spentToday = expenses.filter((e) => e.date >= dayStart).reduce((s, e) => s + e.amount, 0);
  const daysLeftInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1;
  const overallAmount = Math.max(15000, Math.round((spentMonth - spentToday + (1100 + spentToday) * daysLeftInMonth) / 500) * 500);
  await Budget.create({ user, name: "Monthly budget", amount: overallAmount, category: "Overall", month, repeat: true });

  // Savings goals
  await SavingsGoal.insertMany([
    {
      user,
      name: "Emergency fund",
      targetAmount: 50000,
      savedAmount: 15000,
      targetDate: addMonths(today, 10),
      // contributions and one withdrawal (shown in History)
      contributions: [
        { amount: 10000, type: "deposit", date: addMonths(today, -3), note: "Started the fund" },
        { amount: 8000, type: "deposit", date: addMonths(today, -2) },
        { amount: 3000, type: "withdrawal", date: addMonths(today, -1), note: "Bike repair" },
      ],
    },
    {
      user,
      name: "New laptop",
      targetAmount: 70000,
      savedAmount: 22000,
      targetDate: addMonths(today, 6),
      contributions: [
        { amount: 15000, type: "deposit", date: addMonths(today, -2) },
        { amount: 7000, type: "deposit", date: addMonths(today, -1) },
      ],
    },
    { user, name: "Goa trip", targetAmount: 15000, savedAmount: 15000, targetDate: addMonths(today, -1), status: "completed", contributions: [{ amount: 15000 }] },
  ]);

  // Bills
  await Bill.insertMany([
    { user, name: "Credit card bill", amount: 4820, dueDate: addDays(today, 2), category: "Bills & Utilities", reminderDays: 3 },
    // Repeating bill: paying it creates next month's bill automatically
    { user, name: "Wi-Fi (ACT)", amount: 799, dueDate: addDays(today, 9), anchorDay: addDays(today, 9).getDate(), category: "Bills & Utilities", reminderDays: 3, repeat: "monthly" },
    { user, name: "Bike insurance", amount: 2150, dueDate: addDays(today, 20), category: "Transport", reminderDays: 7 },
    { user, name: "Electricity", amount: 1120, dueDate: addDays(today, -5), category: "Bills & Utilities", status: "paid", paidAt: addDays(today, -6) },
  ]);

  // Recurring rules (next dates in the future so nothing is duplicated)
  const nextMonth1 = startOfMonth(addMonths(today, 1));
  await RecurringTransaction.insertMany([
    { user, title: "Salary", amount: 35000, type: "income", classification: "Salary", frequency: "monthly", nextDate: nextMonth1, anchorDay: 1, paymentMethod: "bankTransfer" },
    { user, title: "Netflix", amount: 249, type: "expense", classification: "Entertainment", frequency: "monthly", nextDate: addDays(nextMonth1, 9), anchorDay: 10, paymentMethod: "card" },
    // Phone EMI: 6 payments, then the rule ends by itself
    {
      user,
      title: "Phone EMI",
      amount: 2500,
      type: "expense",
      classification: "Shopping",
      frequency: "monthly",
      nextDate: addDays(nextMonth1, 4),
      anchorDay: 5,
      endDate: addPeriod(addDays(nextMonth1, 4), "monthly", 5, 5),
      paymentMethod: "upi",
    },
    { user, title: "Gym membership", amount: 1200, type: "expense", classification: "Health", frequency: "monthly", nextDate: addDays(nextMonth1, 4), paymentMethod: "upi", active: false },
  ]);

  // Generate budget alerts for the demo
  await checkBudgetThresholds(user, today);
  await Notification.create({
    user,
    type: "system",
    title: "Welcome back, Aditya!",
    message: "Your demo data is ready. Open AI Insights to see anomalies, money leaks and your monthly report card.",
    link: "/insights",
  });

  console.log(`✅ Demo data created: ${incomes.length} income records, ${expenses.length} expenses.`);
  console.log("   Login: demo@fintrack.ai / Demo@1234");
  console.log("   Admin: admin@fintrack.ai / Admin@1234");
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("❌ Seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
