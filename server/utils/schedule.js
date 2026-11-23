// ─────────────────────────────────────────────────────────────
// Schedule helpers (pure functions, no database).
// Used by recurring rules, repeating bills, subscriptions and planning.
//
// Monthly / quarterly / yearly dates keep an "anchor day": the day of the
// month the schedule was set up on. Each step lands on
// min(anchorDay, days in that month), so Jan 31 -> Feb 28 -> Mar 31
// (plain JavaScript setMonth() would give Mar 3).
// ─────────────────────────────────────────────────────────────

export const FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/**
 * Move a date by `steps` periods (steps may be negative).
 * @param {Date|string} date
 * @param {"daily"|"weekly"|"monthly"|"quarterly"|"yearly"} frequency
 * @param {number} [anchorDay] 1-31; defaults to the day of `date`
 * @param {number} [steps=1]
 */
export const addPeriod = (date, frequency, anchorDay, steps = 1) => {
  const d = new Date(date);
  if (frequency === "daily") {
    d.setDate(d.getDate() + steps);
    return d;
  }
  if (frequency === "weekly") {
    d.setDate(d.getDate() + 7 * steps);
    return d;
  }
  const months = frequency === "quarterly" ? 3 * steps : frequency === "yearly" ? 12 * steps : steps;
  const anchor = Number(anchorDay) >= 1 && Number(anchorDay) <= 31 ? Number(anchorDay) : d.getDate();
  const total = d.getFullYear() * 12 + d.getMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const day = Math.min(anchor, daysInMonth(year, month));
  return new Date(year, month, day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
};

/**
 * Every occurrence d of a schedule with from <= d < to.
 * The schedule starts at `startDate` and stops after `endDate` (same day included).
 * Hard cap of 400 steps so a bad input can never loop for long.
 */
export const occurrencesBetween = (startDate, frequency, anchorDay, from, to, endDate) => {
  const out = [];
  if (!startDate) return out;
  const fromT = new Date(from).getTime();
  const toT = new Date(to).getTime();
  const endT = endDate ? endOfDay(endDate).getTime() : Infinity;
  const anchor = anchorDay || new Date(startDate).getDate();

  for (let i = 0; i < 400; i++) {
    const d = addPeriod(startDate, frequency, anchor, i);
    const t = d.getTime();
    if (t >= toT || t > endT) break;
    if (t >= fromT) out.push(d);
  }
  return out;
};

// What a payment costs per month on average
export const monthlyEquivalent = (amount, frequency) => {
  const a = Number(amount) || 0;
  switch (frequency) {
    case "daily":
      return a * 30.44;
    case "weekly":
      return (a * 52) / 12;
    case "quarterly":
      return a / 3;
    case "yearly":
      return a / 12;
    default:
      return a;
  }
};
