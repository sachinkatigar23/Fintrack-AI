// Same rules as server/utils/schedule.js (used for form previews only - the server decides).
// Monthly / quarterly / yearly steps keep the anchor day: Jan 31 -> Feb 28 -> Mar 31.

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

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
  const anchor = anchorDay || d.getDate();
  const total = d.getFullYear() * 12 + d.getMonth() + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return new Date(y, m, Math.min(anchor, daysInMonth(y, m)), d.getHours(), d.getMinutes());
};

// "Save ₹X per month to reach this by <date>": months remaining = max(1, ceil(days / 30.44))
export const monthsUntil = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86400000);
  return Math.max(1, Math.ceil(days / 30.44));
};
