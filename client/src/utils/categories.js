import {
  Utensils, Car, ShoppingBag, Receipt, HeartPulse, GraduationCap, Ticket, Plane, Building2, CircleEllipsis,
  DollarSign, Laptop, Briefcase, TrendingUp, Gift, ArrowUpRight, Wallet,
} from "../components/common/icons.js";

// Same lists as server/utils/constants.js
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

export const INCOME_SOURCES = ["Salary", "Freelance", "Business", "Investment", "Gift", "Rental", "Other"];

export const PAYMENT_METHODS = [
  ["upi", "UPI"],
  ["card", "Card"],
  ["cash", "Cash"],
  ["bankTransfer", "Bank transfer"],
  ["other", "Other"],
];

export const paymentLabel = (value) => PAYMENT_METHODS.find(([v]) => v === value)?.[1] || "Other";

const EXPENSE_ICONS = {
  "Food & Dining": Utensils,
  Transport: Car,
  Shopping: ShoppingBag,
  "Bills & Utilities": Receipt,
  Health: HeartPulse,
  Education: GraduationCap,
  Entertainment: Ticket,
  Travel: Plane,
  "Rent & Housing": Building2,
  Other: CircleEllipsis,
};

const INCOME_ICONS = {
  Salary: DollarSign,
  Freelance: Laptop,
  Business: Briefcase,
  Investment: TrendingUp,
  Gift: Gift,
  Rental: ArrowUpRight,
  Other: Wallet,
};

export const iconFor = (type, classification) =>
  (type === "income" ? INCOME_ICONS[classification] || Wallet : EXPENSE_ICONS[classification] || CircleEllipsis);

// Colours used for ranked category bars / tags (1st, 2nd, 3rd ...)
export const RANK_COLORS = ["coral", "gold", "sky", "mint", "iris"];
export const COLOR_HEX = {
  coral: "#FF6B7A",
  gold: "#F5B944",
  sky: "#4FA8E8",
  mint: "#2FD6A6",
  iris: "#7C6BFF",
};
export const BAR_GRADIENT = {
  coral: "linear-gradient(180deg,#FF7D8A,#E8475A)",
  gold: "linear-gradient(180deg,#F8C860,#E0A030)",
  sky: "linear-gradient(180deg,#68B8F0,#3A8FD0)",
  mint: "linear-gradient(180deg,#4FE3B8,#1FB88B)",
  iris: "linear-gradient(180deg,#A193FF,#6A56F0)",
};
