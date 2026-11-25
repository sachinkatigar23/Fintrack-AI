// Shared lists used by models, validators, analytics and the AI layer.
// The client keeps the same lists in client/src/utils/categories.js

export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Health",
  "Education",
  "Entertainment",
  "Travel",
  "Rent & Housing",
  "Other",
];

export const INCOME_SOURCES = [
  "Salary",
  "Freelance",
  "Business",
  "Investment",
  "Gift",
  "Rental",
  "Other",
];

export const PAYMENT_METHODS = ["cash", "card", "upi", "bankTransfer", "other"];

export const RECURRING_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export const NOTIFICATION_TYPES = ["budget", "bill", "recurring", "goal", "ai", "system", "subscription", "planning", "streak"];

// Budget alert thresholds (percent of limit used)
export const BUDGET_THRESHOLDS = [80, 100];

// "Money leak" = repeated small purchases below this amount (in the user's currency)
export const LEAK_MAX_AMOUNT = 150;
export const LEAK_MIN_COUNT = 3;
