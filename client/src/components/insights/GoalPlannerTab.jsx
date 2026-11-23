import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Target } from "../common/icons.js";
import Skeleton from "../common/Skeleton.jsx";
import { analyticsApi } from "../../services/financeApi.js";
import { useMoney } from "../../hooks/useMoney.js";
import { fmtDate } from "../../utils/format.js";

export default function GoalPlannerTab() {
  const money = useMoney();
  const [data, setData] = useState(null);

  useEffect(() => {
    analyticsApi.goals().then(setData).catch(() => setData({ goals: [], currentMonthlySavings: 0 }));
  }, []);

  if (!data) return <Skeleton style={{ height: 220 }} />;

  return (
    <div className="card card-pad">
      <div className="section-title">
        <Target className="iris" /> AI Goal Projections
      </div>
      <p className="section-sub" style={{ marginBottom: 18 }}>
        Based on your actual monthly savings of {money.fmt0(data.currentMonthlySavings)}.
      </p>

      {data.goals.length === 0 ? (
        <div className="box text-center" style={{ padding: "40px 16px" }}>
          <span className="ai-ic" style={{ margin: "0 auto 14px", width: 44, height: 44, borderRadius: "50%" }}>
            <Target />
          </span>
          <b style={{ color: "var(--text)" }}>No active savings goals found.</b>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            Based on your actual monthly savings of {money.fmt0(data.currentMonthlySavings)}. <Link to="/savings-goals" className="link">Create a goal</Link>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.goals.map((g) => (
            <div key={g.goalId} className="box flex flex-wrap items-center justify-between gap-4" style={{ color: "var(--text)" }}>
              <div style={{ minWidth: 220, flex: 1 }}>
                <b style={{ fontSize: 15 }}>{g.name}</b>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  {money.fmt0(g.savedAmount)} of {money.fmt0(g.targetAmount)} · {money.fmt0(g.remainingAmount)} remaining
                  {g.targetDate ? ` · by ${fmtDate(g.targetDate)} (${g.monthsRemaining} mo)` : ""}
                </p>
                <div className="prog" style={{ marginTop: 10 }}>
                  <i style={{ width: `${g.progressPct}%`, background: "linear-gradient(90deg,#2FD6A6,#7CF0CF)" }} />
                </div>
              </div>
              <div className={`box ${g.isSufficient ? "ok" : "warn"}`} style={{ minWidth: 230 }}>
                <div className="bh">Required pace</div>
                {g.requiredMonthly !== null ? (
                  <p className="big-mono" style={{ fontSize: 20 }}>
                    {money.fmt0(g.requiredMonthly)}
                    <span style={{ fontSize: 12, fontWeight: 400 }}> /month</span>
                  </p>
                ) : (
                  <p style={{ fontSize: 13 }}>No target date set</p>
                )}
                <p style={{ fontSize: 12, marginTop: 6 }}>
                  {g.isSufficient
                    ? g.monthsAtCurrentPace
                      ? `On track. At your pace you'll finish in about ${g.monthsAtCurrentPace} month(s).`
                      : "On track."
                    : g.averageMonthlySavings > 0
                      ? `Your average saving (${money.fmt0(g.averageMonthlySavings)}/mo) is below the pace needed.`
                      : "You are not saving anything right now. Reduce spending to start."}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
