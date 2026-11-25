// Formatting helpers (Indian number style: ₹1,00,000)

export const makeMoney = (currency = "INR") => {
  const nf0 = new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const safe = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
  return {
    // ₹29,787
    fmt0: (n) => nf0.format(safe(n)),
    // ₹4,942.00
    fmt2: (n) => nf2.format(safe(n)),
    // +₹8,000.00 / -₹171.00
    signed: (n, type) => `${type === "income" ? "+" : "-"}${nf2.format(Math.abs(safe(n)))}`,
    symbol: nf0.formatToParts(0).find((p) => p.type === "currency")?.value || "₹",
  };
};

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export const fmtShortDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

export const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtShortDate(d);
};

// <input type="date"> value
export const toInputDate = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthLabel = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

export const daysUntil = (d) => {
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(d);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

export const pct = (n, digits = 1) => `${(Number(n) || 0).toFixed(digits)}%`;

// "Today, 25 Nov" / "Yesterday, 24 Nov" / "Mon, 23 Nov" (+ year when not this year) from YYYY-MM-DD or a Date
export const friendlyDate = (value) => {
  if (!value) return "";
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  const diff = -daysUntil(d);
  const dm = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
  if (diff === 0) return `Today, ${dm}`;
  if (diff === 1) return `Yesterday, ${dm}`;
  return `${d.toLocaleDateString("en-IN", { weekday: "short" })}, ${dm}`;
};
