import { useState } from "react";
import { Check, RotateCcw, Repeat } from "../components/common/icons.js";
import CollectionPage from "../components/planning/CollectionPage.jsx";
import Modal from "../components/common/Modal.jsx";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../utils/categories.js";
import { fmtDate, daysUntil, toInputDate } from "../utils/format.js";
import { useMoney } from "../hooks/useMoney.js";

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

const REPEATS = [
  ["none", "Doesn't repeat"],
  ["monthly", "Every month"],
  ["quarterly", "Every 3 months"],
  ["yearly", "Every year"],
];

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
  {
    name: "repeat",
    label: "Repeats",
    default: "none",
    options: REPEATS,
    full: true,
    help: (f) => (f.repeat && f.repeat !== "none" ? "When you pay it, the next bill is added automatically." : ""),
  },
];

const statusOf = (bill) => {
  if (bill.status === "paid") return ["PAID", "pos"];
  const d = daysUntil(bill.dueDate);
  if (d < 0) return ["OVERDUE", "neg"];
  if (d <= 3) return [d === 0 ? "DUE TODAY" : "DUE SOON", "gold"];
  return ["UPCOMING", "sky"];
};

const blankPay = { bill: null, helpers: null, amount: "", paidOn: "", paymentMethod: "upi", createExpense: true };

export default function Bills() {
  const money = useMoney();
  const [pay, setPay] = useState(blankPay);
  const [showAllPaid, setShowAllPaid] = useState(false);

  const submitPay = async (e) => {
    e.preventDefault();
    const amount = Number(pay.amount);
    if (!amount || amount <= 0) return;
    const res = await pay.helpers.action(
      pay.bill,
      "pay",
      { amount, paidOn: pay.paidOn, paymentMethod: pay.paymentMethod, createExpense: pay.createExpense },
      (r) => (r?.nextBill ? `Bill paid. Next one added for ${fmtDate(r.nextBill.dueDate)}.` : pay.createExpense ? "Bill paid and recorded as an expense" : "Bill marked as paid")
    );
    if (res) setPay(blankPay);
  };

  return (
    <>
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
          repeat: b.repeat || "none",
        })}
        fromForm={(f) => ({ ...f, reminderDays: Number(f.reminderDays) })}
        groups={(records) => {
          const pending = records.filter((b) => b.status !== "paid").sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
          const paid = records.filter((b) => b.status === "paid").sort((a, b) => new Date(b.paidAt || b.dueDate) - new Date(a.paidAt || a.dueDate));
          const recentPaid = paid.filter((b) => daysUntil(b.paidAt || b.dueDate) >= -30);
          const olderCount = paid.length - recentPaid.length;
          return [
            { key: "overdue", title: "Overdue", items: pending.filter((b) => daysUntil(b.dueDate) < 0) },
            { key: "week", title: "Due in the next 7 days", items: pending.filter((b) => daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 7) },
            { key: "later", title: "Later", items: pending.filter((b) => daysUntil(b.dueDate) > 7) },
            {
              key: "paid",
              title: showAllPaid ? "Paid" : "Paid · last 30 days",
              items: showAllPaid ? paid : recentPaid,
              empty: olderCount ? "No bills paid in the last 30 days." : "",
              action:
                olderCount > 0 ? (
                  <button type="button" className="link" style={{ fontSize: 12 }} onClick={() => setShowAllPaid((v) => !v)}>
                    {showAllPaid ? "Show last 30 days" : `Show all (${olderCount} older)`}
                  </button>
                ) : null,
            },
          ];
        }}
        renderCard={(b, helpers) => {
          const [label, tone] = statusOf(b);
          const d = daysUntil(b.dueDate);
          const repeats = b.repeat && b.repeat !== "none";
          return (
            <>
              <div className="bt">
                <div className="cat">
                  <span className="cic" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                    {ICON}
                  </span>
                  <div>
                    <div className="cn">{b.name}</div>
                    <div className="cs">
                      {b.category}
                      {repeats && (
                        <>
                          {" · "}
                          <Repeat style={{ width: 11, height: 11, verticalAlign: -1 }} /> {REPEATS.find(([v]) => v === b.repeat)?.[1].toLowerCase()}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-between" style={{ marginBottom: 10 }}>
                <span className="lim">{money.fmt2(b.status === "paid" && b.paidAmount ? b.paidAmount : b.amount)}</span>
                <span className={`tag ${tone}`}>{label}</span>
              </div>
              <div className="bf" style={{ marginTop: 0 }}>
                <span>
                  {b.status === "paid"
                    ? `Paid ${b.paidAt ? fmtDate(b.paidAt) : ""}${b.paidAmount && b.paidAmount !== b.amount ? ` · bill was ${money.fmt0(b.amount)}` : ""}`
                    : `Due ${fmtDate(b.dueDate)}${d >= 0 ? ` · in ${d} day${d === 1 ? "" : "s"}` : ` · ${-d} day${d === -1 ? "" : "s"} late`}`}
                </span>
              </div>
              <div style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
                {b.status === "paid" ? (
                  <button type="button" className="btn ghost sm" onClick={() => helpers.action(b, "unpay", {}, "Marked as unpaid")}>
                    <RotateCcw /> Undo payment
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn primary sm"
                    onClick={() =>
                      setPay({ ...blankPay, bill: b, helpers, amount: String(b.amount), paidOn: toInputDate() })
                    }
                  >
                    <Check /> Mark as paid
                  </button>
                )}
              </div>
            </>
          );
        }}
      />

      <Modal open={Boolean(pay.bill)} onClose={() => setPay(blankPay)} title="Pay bill" subtitle={pay.bill ? `${pay.bill.name} · due ${fmtDate(pay.bill.dueDate)}` : ""}>
        <form onSubmit={submitPay}>
          <div className="form-grid">
            <label className="field">
              <span>Amount paid</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={pay.amount}
                onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Paid on</span>
              <input
                className="input"
                type="date"
                max={toInputDate()}
                value={pay.paidOn}
                onChange={(e) => setPay((p) => ({ ...p, paidOn: e.target.value }))}
              />
            </label>
            <label className="field full">
              <span>Payment method</span>
              <select className="select" value={pay.paymentMethod} onChange={(e) => setPay((p) => ({ ...p, paymentMethod: e.target.value }))}>
                {PAYMENT_METHODS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="field full checkline">
              <input type="checkbox" checked={pay.createExpense} onChange={(e) => setPay((p) => ({ ...p, createExpense: e.target.checked }))} />
              <span>Also record as expense</span>
            </label>
          </div>
          {pay.bill?.repeat && pay.bill.repeat !== "none" && (
            <p className="box info form-helper">This bill repeats – the next one will be added automatically.</p>
          )}
          <div className="modal-ft">
            <button type="button" className="btn ghost" onClick={() => setPay(blankPay)}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={!Number(pay.amount) || !pay.paidOn || pay.paidOn > toInputDate()}>
              <Check /> Mark as paid
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
