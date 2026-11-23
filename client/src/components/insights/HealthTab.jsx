import { useEffect, useState } from "react";
import { Sparkles } from "../common/icons.js";
import Skeleton from "../common/Skeleton.jsx";
import { analyticsApi } from "../../services/financeApi.js";
import { useMoney } from "../../hooks/useMoney.js";

export default function HealthTab() {
  const money = useMoney();
  const [data, setData] = useState(null);

  useEffect(() => {
    analyticsApi.get("month").then(setData).catch(() => setData({}));
  }, []);

  if (!data) return <Skeleton style={{ height: 260 }} />;

  const h = data.healthData || {};
  const tiles = [
    ["INCOME", money.fmt0(data.totalIncome)],
    ["EXPENSES", money.fmt0(data.totalExpenses)],
    ["FINANCIAL HEALTH", h.hasData ? `${h.score}/100` : "No data"],
  ];

  return (
    <div className="stack">
      <div className="grid g3">
        {tiles.map(([label, value]) => (
          <div key={label} className="card card-pad">
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: "var(--text-2)" }}>{label}</div>
            <div className="big-mono" style={{ fontSize: 30, marginTop: 12 }}>{value}</div>
            <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>This month</div>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <div className="section-title" style={{ marginBottom: 18 }}>
          <Sparkles className="mint" /> Health Factors
        </div>
        <div className="grid g2">
          <div className="box" style={{ color: "var(--text)" }}>
            <div className="bh mint">On track</div>
            <div className="flex flex-col gap-3">
              {(h.positivePoints || []).length === 0 && <p className="faint">Keep tracking data to see insights.</p>}
              {(h.positivePoints || []).map((p) => (
                <div key={p} className="dotline">
                  <i style={{ background: "var(--mint)" }} />
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="box" style={{ color: "var(--text)" }}>
            <div className="bh gold">Needs attention</div>
            <div className="flex flex-col gap-3">
              {(h.attentionPoints || []).length === 0 && <p className="faint">Nothing critical right now!</p>}
              {(h.attentionPoints || []).map((p) => (
                <div key={p} className="dotline">
                  <i style={{ background: "var(--gold)" }} />
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Explainable score: shows exactly how the number was built */}
        {h.hasData && (
          <div className="box" style={{ marginTop: 16, color: "var(--text)" }}>
            <div className="bh iris">Why am I seeing this score?</div>
            <div className="flex flex-col gap-2" style={{ fontSize: 13 }}>
              <div className="flex justify-between">
                <span className="muted">Starting point</span>
                <span className="mono">50</span>
              </div>
              {(h.factors || []).map((f) => (
                <div key={f.label} className="flex justify-between">
                  <span className="muted">
                    {f.label} <span className="faint">({f.value})</span>
                  </span>
                  <span className={`mono ${f.impact >= 0 ? "mint" : "coral"}`}>
                    {f.impact >= 0 ? "+" : ""}
                    {Number(f.impact).toFixed(1)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <b>Score (0 - 100)</b>
                <b className="mono">{h.score}</b>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
