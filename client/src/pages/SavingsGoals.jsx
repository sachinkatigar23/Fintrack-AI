import { useState } from "react";
import { Plus } from "../components/common/icons.js";
import CollectionPage from "../components/planning/CollectionPage.jsx";
import Modal from "../components/common/Modal.jsx";
import { fmtDate } from "../utils/format.js";
import { useMoney } from "../hooks/useMoney.js";

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="6" width="18" height="14" rx="3" />
    <path d="M3 10h18M7 15h3" />
  </svg>
);

const fields = [
  { name: "name", label: "Goal name", hint: "e.g. Emergency fund", full: true },
  { name: "targetAmount", label: "Target amount", type: "number", hint: "e.g. 50000" },
  { name: "savedAmount", label: "Already saved", type: "number", default: "0", required: false },
  { name: "targetDate", label: "Target date", type: "date", required: false, full: true },
];

export default function SavingsGoals() {
  const money = useMoney();
  const [contrib, setContrib] = useState({ goal: null, amount: "", helpers: null });

  const submitContribution = async (e) => {
    e.preventDefault();
    const amount = Number(contrib.amount);
    if (!amount || amount <= 0) return;
    await contrib.helpers.action(contrib.goal, "contribute", { amount }, "Contribution added");
    setContrib({ goal: null, amount: "", helpers: null });
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
        fromForm={(f) => ({ ...f, savedAmount: f.savedAmount === "" ? 0 : f.savedAmount })}
        renderCard={(g, helpers) => {
          const p = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
          const done = g.status === "completed" || p >= 100;
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
                {done ? <span className="tag pos">COMPLETED</span> : <span className="tag iris">ACTIVE</span>}
              </div>
              <div className="prog">
                <i style={{ width: `${p}%`, background: "linear-gradient(90deg,#2FD6A6,#7CF0CF)" }} />
              </div>
              <div className="bf">
                <span>{money.fmt0(g.savedAmount)} saved</span>
                <span>{done ? "Goal reached 🎉" : `${money.fmt0(Math.max(0, g.targetAmount - g.savedAmount))} to go`}</span>
              </div>
              {!done && (
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ marginTop: 14 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setContrib({ goal: g, amount: "", helpers });
                  }}
                >
                  <Plus /> Add contribution
                </button>
              )}
            </>
          );
        }}
      />

      <Modal
        open={Boolean(contrib.goal)}
        onClose={() => setContrib({ goal: null, amount: "", helpers: null })}
        title="Add contribution"
        subtitle={contrib.goal ? `How much did you set aside for "${contrib.goal.name}"?` : ""}
      >
        <form onSubmit={submitContribution}>
          <label className="field">
            <span>Amount</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              autoFocus
              placeholder="e.g. 2000"
              value={contrib.amount}
              onChange={(e) => setContrib((c) => ({ ...c, amount: e.target.value }))}
            />
          </label>
          <div className="modal-ft">
            <button type="submit" className="btn primary" disabled={!Number(contrib.amount)}>
              Add contribution
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
