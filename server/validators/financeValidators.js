import { body, param, query } from "express-validator";
import {
  EXPENSE_CATEGORIES,
  INCOME_SOURCES,
  PAYMENT_METHODS,
  RECURRING_FREQUENCIES,
} from "../utils/constants.js";
import { endOfDay, monthKey, addMonths, startOfMonth } from "../utils/dates.js";

// Remove angle brackets so no HTML/script can be stored (React also escapes output)
const clean = (value) => (typeof value === "string" ? value.replace(/[<>]/g, "").trim() : value);

const amount = (field = "amount", optional = false) => {
  const chain = body(field);
  return (optional ? chain.optional() : chain)
    .isFloat({ gt: 0, max: 100000000 })
    .withMessage("Amount must be a number greater than 0")
    .toFloat();
};

const date = (field, optional = true, label = "Date") => {
  const chain = body(field);
  return (optional ? chain.optional({ values: "falsy" }) : chain.notEmpty().withMessage(`${label} is required`))
    .isISO8601()
    .withMessage(`${label} must be a valid date`);
};

// Income and expenses record money that already moved: no dates after today
export const FUTURE_DATE_MESSAGE = "Date can't be in the future. Use Bills or Recurring for upcoming payments.";
const notFuture = (field = "date") =>
  date(field).custom((value) => {
    if (value && new Date(value) > endOfDay()) throw new Error(FUTURE_DATE_MESSAGE);
    return true;
  });

export const idParam = [param("id").isMongoId().withMessage("Invalid record id")];

// ───────── Expenses ─────────
export const createExpenseValidator = [
  body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 100 }).withMessage("Title is too long").customSanitizer(clean),
  amount(),
  body("category").isIn(EXPENSE_CATEGORIES).withMessage("Please choose a valid category"),
  body("paymentMethod").optional().isIn(PAYMENT_METHODS).withMessage("Invalid payment method"),
  notFuture("date"),
  body("notes").optional().trim().isLength({ max: 500 }).withMessage("Notes are too long").customSanitizer(clean),
];

export const updateExpenseValidator = [
  ...idParam,
  body("title").optional().trim().notEmpty().withMessage("Title cannot be empty").isLength({ max: 100 }).customSanitizer(clean),
  amount("amount", true),
  body("category").optional().isIn(EXPENSE_CATEGORIES).withMessage("Please choose a valid category"),
  body("paymentMethod").optional().isIn(PAYMENT_METHODS).withMessage("Invalid payment method"),
  notFuture("date"),
  body("notes").optional().trim().isLength({ max: 500 }).customSanitizer(clean),
];

// ───────── Income ─────────
export const createIncomeValidator = [
  body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 100 }).customSanitizer(clean),
  amount(),
  body("source").isIn(INCOME_SOURCES).withMessage("Please choose a valid source"),
  body("paymentMethod").optional().isIn(PAYMENT_METHODS).withMessage("Invalid payment method"),
  notFuture("date"),
  body("notes").optional().trim().isLength({ max: 500 }).customSanitizer(clean),
];

export const updateIncomeValidator = [
  ...idParam,
  body("title").optional().trim().notEmpty().withMessage("Title cannot be empty").isLength({ max: 100 }).customSanitizer(clean),
  amount("amount", true),
  body("source").optional().isIn(INCOME_SOURCES).withMessage("Please choose a valid source"),
  body("paymentMethod").optional().isIn(PAYMENT_METHODS).withMessage("Invalid payment method"),
  notFuture("date"),
  body("notes").optional().trim().isLength({ max: 500 }).customSanitizer(clean),
];

// ───────── Budgets ─────────
export const budgetValidator = (optional = false) => [
  (optional ? body("name").optional() : body("name")).trim().notEmpty().withMessage("Budget name is required").isLength({ max: 80 }).customSanitizer(clean),
  amount("amount", optional),
  body("category").optional().isIn(["Overall", ...EXPENSE_CATEGORIES]).withMessage("Please choose a valid category"),
  body("month")
    .optional({ values: "falsy" })
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage("Month must look like 2026-10")
    .custom((value) => {
      // A budget can be planned at most 12 months ahead
      if (value > monthKey(addMonths(startOfMonth(), 12))) throw new Error("A budget can be set at most 12 months ahead");
      return true;
    }),
  body("repeat").optional().isBoolean().withMessage("Repeat must be true or false").toBoolean(),
];

export const monthQuery = [
  query("month").optional({ values: "falsy" }).matches(/^\d{4}-(0[1-9]|1[0-2])$/).withMessage("Month must look like 2026-10"),
];

// ───────── Savings goals ─────────
export const goalValidator = (optional = false) => [
  (optional ? body("name").optional() : body("name")).trim().notEmpty().withMessage("Goal name is required").isLength({ max: 80 }).customSanitizer(clean),
  amount("targetAmount", optional),
  body("savedAmount").optional({ values: "falsy" }).isFloat({ min: 0 }).withMessage("Saved amount cannot be negative").toFloat(),
  date("targetDate", true, "Target date"),
];

export const contributionValidator = [
  ...idParam,
  amount("amount"),
  body("note").optional().trim().isLength({ max: 120 }).customSanitizer(clean),
];

// POST /savings-goals/:id/use
export const useGoalValidator = [
  ...idParam,
  body("createExpense").optional().isBoolean().toBoolean(),
  body("title").optional({ values: "falsy" }).trim().isLength({ max: 100 }).withMessage("Title is too long").customSanitizer(clean),
  body("category").optional({ values: "falsy" }).isIn(EXPENSE_CATEGORIES).withMessage("Please choose a valid category"),
  body("paymentMethod").optional({ values: "falsy" }).isIn(PAYMENT_METHODS).withMessage("Invalid payment method"),
];

// ───────── Bills ─────────
export const BILL_REPEATS = ["none", "monthly", "quarterly", "yearly"];

export const billValidator = (optional = false) => [
  (optional ? body("name").optional() : body("name")).trim().notEmpty().withMessage("Bill name is required").isLength({ max: 80 }).customSanitizer(clean),
  amount("amount", optional),
  date("dueDate", optional, "Due date"),
  body("category").optional().isIn(EXPENSE_CATEGORIES).withMessage("Please choose a valid category"),
  body("reminderDays").optional({ values: "falsy" }).isInt({ min: 0, max: 30 }).withMessage("Reminder must be 0-30 days").toInt(),
  body("status").optional().isIn(["pending", "paid"]).withMessage("Invalid status"),
  body("repeat").optional().isIn(BILL_REPEATS).withMessage("Repeat must be none, monthly, quarterly or yearly"),
];

// POST /bills/:id/pay  { amount?, paidOn?, paymentMethod?, createExpense? }
export const payBillValidator = [
  ...idParam,
  amount("amount", true),
  notFuture("paidOn"),
  body("paymentMethod").optional({ values: "falsy" }).isIn(PAYMENT_METHODS).withMessage("Invalid payment method"),
  body("createExpense").optional().isBoolean().toBoolean(),
];

// ───────── Recurring ─────────
export const recurringValidator = (optional = false) => [
  (optional ? body("title").optional() : body("title")).trim().notEmpty().withMessage("Title is required").isLength({ max: 100 }).customSanitizer(clean),
  amount("amount", optional),
  (optional ? body("type").optional() : body("type")).isIn(["income", "expense"]).withMessage("Type must be income or expense"),
  (optional ? body("classification").optional() : body("classification"))
    .custom((value, { req }) => {
      const list = req.body.type === "income" ? INCOME_SOURCES : EXPENSE_CATEGORIES;
      if (!req.body.type && optional) return true;
      if (!list.includes(value)) throw new Error("Please choose a valid category or source");
      return true;
    }),
  body("frequency").optional().isIn(RECURRING_FREQUENCIES).withMessage("Invalid frequency"),
  date("nextDate", optional, "Next date"),
  body("endDate").optional({ values: "falsy" }).isISO8601().withMessage("End date must be a valid date"),
  body("active").optional().isBoolean().toBoolean(),
];
