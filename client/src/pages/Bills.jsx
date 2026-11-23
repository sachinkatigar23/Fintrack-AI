import { Check, RotateCcw } from "../components/common/icons.js";
import CollectionPage from "../components/planning/CollectionPage.jsx";
import { EXPENSE_CATEGORIES } from "../utils/categories.js";
import { fmtDate, daysUntil, toInputDate } from "../utils/format.js";
import { useMoney } from "../hooks/useMoney.js";

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

const fields = [
  { name: "name", label: "Bill name", hint: "e.g. Electricity", full: true },
  { name: "amount", label: "Amount", type: "number", hint: "e.g. 1200" },
  { name: "dueDate", label: "Due date", type: "date", default: () => toInputDate() },
  { name: "category", label: "Category", default: "Bills & Utilities", options: EXPENSE_CATEGORIES },
  {
    name: "reminderDays",
    label: "Remind me",
    default: "3",
    options: [
      ["0", "On the due date"],
      ["1", "1 day before"],
      ["3", "3 days before"],
      ["7", "7 days before"],
    ],
  },
];

const statusOf = (bill) => {
  if (bill.status === "paid") return ["PAID", "pos"];
  const d = daysUntil(bill.dueDate);
  if (d < 0) return ["OVERDUE", "neg"];
  if (d <= 3) return [d === 0 ? "DUE TODAY" : "DUE SOON", "gold"];
  return ["UPCOMING", "sky"];
};

export default function Bills() {
  const money = useMoney();
  return (
    <CollectionPage
      title="Bills"
      singular="Bill"
      description="Keep upcoming payments visible."
      endpoint="/bills"
      icon={ICON}
      fields={fields}
      toForm={(b) => ({
        name: b.name,
        amount: b.amount,
        dueDate: toInputDate(b.dueDate),
        category: b.category,
        reminderDays: String(b.reminderDays ?? 3),
      })}
      fromForm={(f) => ({ ...f, reminderDays: Number(f.reminderDays) })}
      renderCard={(b, helpers) => {
        const [label, tone] = statusOf(b);
        const d = daysUntil(b.dueDate);
        return (
          <>
            <div className="bt">
              <div className="cat">
                <span className="cic" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                  {ICON}
                </span>
                <div>
                  <div className="cn">{b.name}</div>
                  <div className="cs">{b.category}</div>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between" style={{ marginBottom: 10 }}>
              <span className="lim">{money.fmt2(b.amount)}</span>
              <span className={`tag ${tone}`}>{label}</span>
            </div>
            <div className="bf" style={{ marginTop: 0 }}>
              <span>
                {b.status === "paid"
                  ? `Paid ${b.paidAt ? fmtDate(b.paidAt) : ""}`
                  : `Due ${fmtDate(b.dueDate)}${d >= 0 ? ` · in ${d} day${d === 1 ? "" : "s"}` : ` · ${-d} day${d === -1 ? "" : "s"} late`}`}
              </span>
            </div>
            <div style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
              {b.status === "paid" ? (
                <button type="button" className="btn ghost sm" onClick={() => helpers.action(b, "unpay", {}, "Marked as unpaid")}>
                  <RotateCcw /> Undo payment
                </button>
              ) : (
                <button type="button" className="btn primary sm" onClick={() => helpers.action(b, "pay", {}, "Bill paid and recorded as an expense")}>
                  <Check /> Mark as paid
                </button>
              )}
            </div>
          </>
        );
      }}
    />
  );
}
