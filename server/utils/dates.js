// Date helpers used by analytics, budgets and the scheduler.

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

export const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

export const addMonths = (d, n) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// "2026-10" <-> Date
export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const parseMonthKey = (key) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key || "")) return null;
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
};

// Range for a month key (defaults to the current month)
export const monthRange = (key) => {
  const start = parseMonthKey(key) || startOfMonth();
  return { start, end: endOfMonth(start), key: monthKey(start) };
};

// Report / analytics periods
export const periodRange = (period = "all") => {
  const now = new Date();
  switch (period) {
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "lastMonth": {
      const s = startOfMonth(addMonths(now, -1));
      return { start: s, end: endOfMonth(s) };
    }
    case "quarter":
      return { start: startOfMonth(addMonths(now, -2)), end: endOfMonth(now) };
    case "year":
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfMonth(now) };
    default:
      return { start: null, end: null };
  }
};

export const daysBetween = (a, b) => Math.ceil((startOfDay(b) - startOfDay(a)) / 86400000);
