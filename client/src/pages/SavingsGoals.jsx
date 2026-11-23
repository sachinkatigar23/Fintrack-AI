import { useState } from "react";
import { Plus, Minus, History, Check } from "../components/common/icons.js";
import CollectionPage from "../components/planning/CollectionPage.jsx";
import Modal from "../components/common/Modal.jsx";
import { fmtDate, toInputDate, daysUntil } from "../utils/format.js";
import { monthsUntil } from "../utils/schedule.js";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../utils/categories.js";
import { useMoney } from "../hooks/useMoney.js";

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="14" rx="3" />
    <path d="M3 10h18M7 15h3" />
  </svg>
);

const tomorrow = () => toInputDate(new Date(Date.now() + 86400000));

const fields = [
  { name: "name", label: "Goal name", hint: "e.g. Emergency fund", full: true },
  { name: "targetAmount", label: "Target amount", type: "number", hint: "e.g. 50000" },
  { name: "savedAmount", label: "Already saved", type: "number", default: "0", required: false },
  {
    name: "targetDate",
    label: "Target date",
    type: "date",
    required: false,
    full: true,
    // New goals: after today. Editing: an unchanged past date may stay.
    min: (form, record) => (record?.targetDate && toInputDate(record.targetDate) === form.targetDate ? undefined : tomorrow()),
  },
];

const blankMove = { goal: null, kind: "deposit", amount: "", note: "", helpers: null };
const blankUse = { goal: null, helpers: null, createExpense: true, title: "", category: "Shopping", paymentMethod: "upi" };

export default function SavingsGoals() {
  const money = useMoney();
  const [move, setMove] = useState(blankMove);
  const [use, setUse] = useState(blankUse);
  const [history, setHistory] = useState(null);

  const submitMove = async (e) => {
    e.preventDefault();
    const amount = Number(move.amount);
    if (!amount || amount <= 0) return;
    const withdraw = move.kind === "withdrawal";
    const res = await move.helpers.action(
      move.goal,
      withdraw ? "withdraw" : "contribute",
      { amount, note: move.note },
      withdraw ? "Withdrawal recorded" : "Contribution added"
    );
    if (res) setMove(blankMove);
  };

  const submitUse = async (e) => {
    e.preventDefault();
    const res = await use.helpers.action(
      use.goal,
      "use",
      { createExpense: use.createExpense, title: use.title, category: use.category, paymentMethod: use.paymentMethod },
      use.createExpense && use.goal.savedAmount > 0 ? "Goal used and recorded as an expense" : "Goal archived"
    );
    if (res) setUse(blankUse);
  };

  return (
    <>
      <CollectionPage
        title="Savings goals"
        singular="Savings goal"
        description="Track progress toward what matters."
        endpoint="/savings-goals"
        icon={ICON}
        fields={fields}
        toForm={(g) => ({
          name: g.name,
          targetAmount: g.targetAmount,
          savedAmount: g.savedAmount,
          targetDate: g.targetDate ? toInputDate(g.targetDate) : "",
        })}
        fromForm={(f) => ({ ...f, savedAmount: f.savedAmount === "" ? 0 : f.savedAmount })}
        validateForm={(f, record) => {
          if (!f.targetDate) return null;
          const unchanged = record?.targetDate && toInputDate(record.targetDate) === f.targetDate;
          return !unchanged && f.targetDate <= toInputDate() ? "Target date must be after today" : null;
        }}
        renderFormExtra={(f) => {
          const target = Number(f.targetAmount);
          const saved = Number(f.savedAmount) || 0;
          if (!target || !f.targetDate || f.targetDate <= toInputDate()) return null;
          const left = Math.max(0, target - saved);
          if (!left) return <p className="box ok form-helper">You've already saved the full amount. 🎉</p>;
          return (
            <p className="box info form-helper">
              Save <b>{money.fmt0(left / monthsUntil(f.targetDate))}</b> per month to reach this by {fmtDate(f.targetDate)}.
            </p>
          );
        }}
        groups={(records) => [
          { key: "open", title: "Goals", items: records.filter((g) => g.status !== "archived") },
          {
            key: "archived",
            title: "Archived goals",
            items: records.filter((g) => g.status === "archived"),
            collapsible: true,
            defaultCollapsed: true,
          },
        ]}
        renderCard={(g, helpers) => {
          const p = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
          const archived = g.status === "archived";
          const done = g.status === "completed" || p >= 100;
          const overdue = g.status === "active" && g.targetDate && daysUntil(g.targetDate) < 0;
          const stop = (fn) => (e) => {
            e.stopPropagation();
            fn();
          };
          return (
            <>
              <div className="bt">
                <div className="cat">
                  <span className="cic" style={{ background: "var(--mint-soft)", color: "var(--mint)" }}>
                    {ICON}
                  </span>
                  <div>
                    <div className="cn">{g.name}</div>
                    <div className="cs">
                      Target {money.fmt0(g.targetAmount)}
                      {g.targetDate ? ` · by ${fmtDate(g.targetDate)}` : ""}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-between" style={{ marginBottom: 12 }}>
                <span className="lim mint">{p}%</span>
                <span className="flex gap-2">
                  {overdue && <span className="tag neg">OVERDUE</span>}
                  {archived ? (
                    <span className="tag sky">USED</span>
                  ) : done ? (
                    <span className="tag pos">COMPLETED</span>
                  ) : (
                    <span className="tag iris">ACTIVE</span>
                  )}
                </span>
              </div>
              <div className="prog">
                <i style={{ width: `${p}%`, background: "linear-gradient(90deg,#2FD6A6,#7CF0CF)" }} />
              </div>
              <div className="bf">
                <span>{money.fmt0(g.savedAmount)} saved</span>
                <span>
                  {archived
                    ? `Used ${g.archivedAt ? fmtDate(g.archivedAt) : ""}`
                    : done
                      ? "Goal reached 🎉"
                      : `${money.fmt0(Math.max(0, g.targetAmount - g.savedAmount))} to go`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
                {!archived && !done && (
                  <button type="button" className="btn ghost sm" onClick={stop(() => setMove({ ...blankMove, goal: g, helpers }))}>
                    <Plus /> Add
                  </button>
                )}
                {!archived && g.savedAmount > 0 && (
                  <button type="button" className="btn ghost sm" onClick={stop(() => setMove({ ...blankMove, kind: "withdrawal", goal: g, helpers }))}>
                    <Minus /> Withdraw
                  </button>
                )}
                {!archived && (
                  <button type="button" className="btn ghost sm" onClick={stop(() => setUse({ ...blankUse, goal: g, helpers, title: g.name }))}>
                    <Check /> Use this goal
                  </button>
                )}
                <button type="button" className="link" style={{ fontSize: 12, marginLeft: "auto" }} onClick={stop(() => setHistory(g))}>
                  <History style={{ width: 13, height: 13, verticalAlign: -2 }} /> History
                </button>
              </div>
            </>
          );
        }}
      />

      {/* Add money / withdraw */}
      <Modal
        open={Boolean(move.goal)}
        onClose={() => setMove(blankMove)}
        title={move.kind === "withdrawal" ? "Withdraw from goal" : "Add contribution"}
        subtitle={
          move.goal
            ? move.kind === "withdrawal"
              ? `"${move.goal.name}" holds ${money.fmt0(move.goal.savedAmount)}. How much are you taking out?`
              : `How much did you set aside for "${move.goal.name}"?`
            : ""
        }
      >
        <form onSubmit={submitMove} className="flex flex-col gap-4">
          <label className="field">
            <span>Amount</span>
            <input
              className="input"
              type="number"
              min="0"
              max={move.kind === "withdrawal" ? move.goal?.savedAmount : undefined}
              step="0.01"
              autoFocus
              placeholder="e.g. 2000"
              value={move.amount}
              onChange={(e) => setMove((m) => ({ ...m, amount: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="flabel">
              Note<em>(optional)</em>
            </span>
            <input className="input" maxLength={120} value={move.note} onChange={(e) => setMove((m) => ({ ...m, note: e.target.value }))} />
          </label>
          {move.kind === "withdrawal" && Number(move.amount) > (move.goal?.savedAmount || 0) && (
            <p className="box bad form-helper">You can withdraw at most {money.fmt0(move.goal.savedAmount)}.</p>
          )}
          <div className="modal-ft">
            <button
              type="submit"
              className={`btn ${move.kind === "withdrawal" ? "danger" : "primary"}`}
              disabled={!Number(move.amount) || (move.kind === "withdrawal" && Number(move.amount) > (move.goal?.savedAmount || 0))}
            >
              {move.kind === "withdrawal" ? "Withdraw" : "Add contribution"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Use this goal */}
      <Modal
        open={Boolean(use.goal)}
        onClose={() => setUse(blankUse)}
        title="Use this goal"
        subtitle={use.goal ? `Bought what you saved for? "${use.goal.name}" will move to Archived goals.` : ""}
      >
        <form onSubmit={submitUse} className="flex flex-col gap-4">
          <label className="field checkline">
            <input type="checkbox" checked={use.createExpense} onChange={(e) => setUse((u) => ({ ...u, createExpense: e.target.checked }))} />
            <span>Record {use.goal ? money.fmt0(use.goal.savedAmount) : ""} as an expense today</span>
          </label>
          {use.createExpense && (
            <div className="form-grid">
              <label className="field full">
                <span>Title</span>
                <input className="input" maxLength={100} value={use.title} onChange={(e) => setUse((u) => ({ ...u, title: e.target.value }))} />
              </label>
              <label className="field">
                <span>Category</span>
                <select className="select" value={use.category} onChange={(e) => setUse((u) => ({ ...u, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Payment method</span>
                <select className="select" value={use.paymentMethod} onChange={(e) => setUse((u) => ({ ...u, paymentMethod: e.target.value }))}>
                  {PAYMENT_METHODS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <p className="faint" style={{ fontSize: 12 }}>Archived goals no longer count as reserved money or appear in planners.</p>
          <div className="modal-ft">
            <button type="button" className="btn ghost" onClick={() => setUse(blankUse)}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              <Check /> Use goal
            </button>
          </div>
        </form>
      </Modal>

      {/* History */}
      <Modal open={Boolean(history)} onClose={() => setHistory(null)} title="Goal history" subtitle={history ? history.name : ""}>
        {history && (
          <div className="scrollY" style={{ maxHeight: 360 }}>
            {(history.contributions || []).length === 0 && <p className="faint" style={{ fontSize: 13 }}>No contributions or withdrawals yet.</p>}
            {[...(history.contributions || [])]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((c, i) => {
                const out = c.type === "withdrawal";
                return (
                  <div key={i} className="hist-row">
                    <span className={`tag ${out ? "neg" : "pos"}`}>{out ? "WITHDRAWAL" : "DEPOSIT"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>{fmtDate(c.date)}</div>
                      {c.note && <div className="faint" style={{ fontSize: 11.5 }}>{c.note}</div>}
                    </div>
                    <b className={`mono ${out ? "coral" : "mint"}`}>
                      {out ? "-" : "+"}
                      {money.fmt0(c.amount)}
                    </b>
                  </div>
                );
              })}
          </div>
        )}
      </Modal>
    </>
  );
}
