import { useMemo, useState } from "react";
import CollectionPage from "../components/planning/CollectionPage.jsx";
import { EXPENSE_CATEGORIES, iconFor } from "../utils/categories.js";
import { monthKey, monthLabel } from "../utils/format.js";
import { useMoney } from "../hooks/useMoney.js";

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v9l6.5 3.5" />
  </svg>
);

const fields = [
  { name: "name", label: "Budget name", hint: "e.g. Monthly food budget", full: true },
  { name: "amount", label: "Monthly limit", type: "number", hint: "e.g. 5000" },
  { name: "category", label: "Category", default: "Overall", options: ["Overall", ...EXPENSE_CATEGORIES] },
  { name: "month", label: "Month", type: "month", default: () => monthKey() },
];

// Progress bar colour changes as the limit gets closer
const barColor = (p) => (p >= 100 ? "var(--coral)" : p >= 80 ? "var(--gold)" : "linear-gradient(90deg,#9B8CFF,#7C6BFF)");

export default function Budgets() {
  const money = useMoney();
  const [month, setMonth] = useState(monthKey());

  const monthChoices = useMemo(() => {
    const now = new Date();
    return [-1, 0, 1, 2, 3].map((i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i + 1, 1)));
  }, []);

  return (
    <CollectionPage
      title="Budgets"
      singular="Budget"
      description="Set monthly spending limits."
      endpoint="/budgets"
      icon={ICON}
      fields={fields.map((f) => (f.name === "month" ? { ...f, default: () => month } : f))}
      params={{ month }}
      toolbar={
        <select className="select sm" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          {monthChoices.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      }
      renderSummary={(meta) => (
        <div className="grid g3" style={{ marginBottom: 16 }}>
          <div className="card card-pad">
            <div className="lbl-mono">TOTAL LIMIT</div>
            <div className="big-mono" style={{ fontSize: 24, marginTop: 8 }}>{money.fmt0(meta.summary?.totalBudget)}</div>
          </div>
          <div className="card card-pad">
            <div className="lbl-mono">SPENT</div>
            <div className="big-mono coral" style={{ fontSize: 24, marginTop: 8 }}>{money.fmt0(meta.summary?.totalSpent)}</div>
          </div>
          <div className="card card-pad">
            <div className="lbl-mono">REMAINING · {Math.round(meta.summary?.usedPct || 0)}% USED</div>
            <div className={`big-mono ${meta.summary?.remaining < 0 ? "coral" : "mint"}`} style={{ fontSize: 24, marginTop: 8 }}>
              {money.fmt0(meta.summary?.remaining)}
            </div>
          </div>
        </div>
      )}
      renderCard={(b) => {
        const Icon = b.category === "Overall" ? null : iconFor("expense", b.category);
        const p = Math.round(b.usedPct || 0);
        return (
          <>
            <div className="bt">
              <div className="cat">
                <span className="cic" style={{ background: "var(--iris-soft)", color: "#A99BFF" }}>
                  {Icon ? <Icon /> : ICON}
                </span>
                <div>
                  <div className="cn">{b.name}</div>
                  <div className="cs">
                    {b.category} · {monthLabel(b.month)}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between" style={{ marginBottom: 12 }}>
              <span className="lim">{money.fmt0(b.amount)}</span>
              <span className={`tag ${b.status === "over" ? "neg" : b.status === "warning" ? "gold" : "pos"}`}>
                {b.status === "over" ? "OVER LIMIT" : b.status === "warning" ? "NEAR LIMIT" : "ON TRACK"}
              </span>
            </div>
            <div className="prog">
              <i style={{ width: `${Math.min(100, p)}%`, background: barColor(p) }} />
            </div>
            <div className="bf">
              <span>
                {money.fmt0(b.spentAmount)} spent · {b.remaining >= 0 ? `${money.fmt0(b.remaining)} left` : `${money.fmt0(-b.remaining)} over`}
              </span>
              <span className="mono">{p}%</span>
            </div>
          </>
        );
      }}
    />
  );
}
