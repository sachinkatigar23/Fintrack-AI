import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Copy, AlertTriangle } from "../components/common/icons.js";
import CollectionPage from "../components/planning/CollectionPage.jsx";
import { EXPENSE_CATEGORIES, iconFor } from "../utils/categories.js";
import { monthKey, monthLabel } from "../utils/format.js";
import { useMoney } from "../hooks/useMoney.js";
import api, { errorMessage } from "../api/axios.js";

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v9l6.5 3.5" />
  </svg>
);

// Latest month a budget can be planned for (12 months ahead)
const maxMonth = () => {
  const now = new Date();
  return monthKey(new Date(now.getFullYear(), now.getMonth() + 12, 1));
};

const fields = [
  { name: "name", label: "Budget name", hint: "e.g. Monthly food budget", full: true },
  { name: "amount", label: "Monthly limit", type: "number", hint: "e.g. 5000" },
  { name: "category", label: "Category", default: "Overall", options: ["Overall", ...EXPENSE_CATEGORIES] },
  { name: "month", label: "Month", type: "month", default: () => monthKey(), max: () => maxMonth() },
  {
    name: "repeat",
    label: "Repeat every month",
    type: "checkbox",
    default: true,
    full: true,
    help: "Creates the same budget automatically at the start of each new month.",
  },
];

// Progress bar colour changes as the limit gets closer
const barColor = (p) => (p >= 100 ? "var(--coral)" : p >= 80 ? "var(--gold)" : "linear-gradient(90deg,#9B8CFF,#7C6BFF)");

export default function Budgets() {
  const money = useMoney();
  const [month, setMonth] = useState(monthKey());
  const [copying, setCopying] = useState(false);

  const monthChoices = useMemo(() => {
    const now = new Date();
    return [-1, 0, 1, 2, 3].map((i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i + 1, 1)));
  }, []);

  const copyPrevious = async (helpers) => {
    setCopying(true);
    try {
      const res = await api.post("/budgets/copy-previous", null, { params: { month } });
      toast.success(res.data?.message || "Budgets copied");
      helpers.reload();
    } catch (err) {
      toast.error(errorMessage(err, "Could not copy budgets"));
    } finally {
      setCopying(false);
    }
  };

  return (
    <CollectionPage
      title="Budgets"
      singular="Budget"
      description="Set monthly spending limits."
      endpoint="/budgets"
      icon={ICON}
      fields={fields.map((f) => (f.name === "month" ? { ...f, default: () => month } : f))}
      params={{ month }}
      toForm={(b) => ({ name: b.name, amount: b.amount, category: b.category, month: b.month, repeat: Boolean(b.repeat) })}
      validateForm={(f) => (f.month && f.month > maxMonth() ? "A budget can be set at most 12 months ahead" : null)}
      toolbar={
        <select className="select sm" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
          {monthChoices.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      }
      renderTop={(meta, records, helpers) => (
        <>
          {records.length === 0 && meta.previousMonthCount > 0 && (
            <div className="box info flex flex-wrap items-center gap-3" style={{ marginBottom: 16 }}>
              <p style={{ flex: 1, minWidth: 220 }}>
                {monthLabel(month)} has no budgets yet. {monthLabel(meta.previousMonth)} had {meta.previousMonthCount}.
              </p>
              <button type="button" className="btn primary sm" disabled={copying} onClick={() => copyPrevious(helpers)}>
                {copying ? <span className="spin" /> : <Copy />} Copy last month's budgets
              </button>
            </div>
          )}
          {meta.consistency && (
            <div className="box warn flex items-center gap-3" style={{ marginBottom: 16 }}>
              <AlertTriangle style={{ width: 16, height: 16, flex: "none" }} />
              <p>
                Your category budgets add up to {money.fmt0(meta.consistency.categoryTotal)}, more than your Overall budget of{" "}
                {money.fmt0(meta.consistency.overall)}.
              </p>
            </div>
          )}
        </>
      )}
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
        const overPace = b.period === "current" && b.paceStatus === "over_pace";
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
                    {b.repeat ? " · repeats" : ""}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between" style={{ marginBottom: 12 }}>
              <span className="lim">{money.fmt0(b.amount)}</span>
              <span className="flex gap-2">
                {overPace && <span className="tag gold">OVER PACE</span>}
                <span className={`tag ${b.status === "over" ? "neg" : b.status === "warning" ? "gold" : "pos"}`}>
                  {b.status === "over" ? "OVER LIMIT" : b.status === "warning" ? "NEAR LIMIT" : "ON TRACK"}
                </span>
              </span>
            </div>
            <div className="prog" style={{ position: "relative" }}>
              <i style={{ width: `${Math.min(100, p)}%`, background: barColor(p) }} />
              {b.period === "current" && (
                <span className="pace-mark" style={{ left: `${Math.min(100, b.elapsedPct || 0)}%` }} title="Where you'd be at an even pace" />
              )}
            </div>
            <div className="bf">
              <span>
                {money.fmt0(b.spentAmount)} spent · {b.remaining >= 0 ? `${money.fmt0(b.remaining)} left` : `${money.fmt0(-b.remaining)} over`}
              </span>
              <span className="mono">{p}%</span>
            </div>
            {b.period === "current" && (
              <div className="bf" style={{ marginTop: 6 }}>
                <span className={b.projectedSpend > b.amount ? "coral" : ""}>Projected {money.fmt0(b.projectedSpend)} by month end</span>
                <span className="mono">{money.fmt0(b.dailyLeft)}/day left</span>
              </div>
            )}
            {b.period === "past" && (
              <div className="bf" style={{ marginTop: 6 }}>
                <span className={b.endedUnder ? "mint" : "coral"}>
                  Ended {money.fmt0(b.endedBy)} {b.endedUnder ? "under" : "over"}
                </span>
              </div>
            )}
          </>
        );
      }}
    />
  );
}
