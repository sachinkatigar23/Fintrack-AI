import { useEffect, useState } from "react";
import { AlertTriangle, Sparkles, Zap } from "../common/icons.js";
import Skeleton from "../common/Skeleton.jsx";
import { analyticsApi } from "../../services/financeApi.js";
import { useMoney } from "../../hooks/useMoney.js";
import { fmtShortDate } from "../../utils/format.js";

export default function AnomaliesTab() {
  const money = useMoney();
  const [data, setData] = useState(null);

  useEffect(() => {
    analyticsApi.anomalies().then(setData).catch(() => setData({ anomalies: [], transactions: [], leaks: [] }));
  }, []);

  if (!data) return <Skeleton style={{ height: 260 }} />;

  return (
    <div className="stack">
      <div className="card card-pad">
        <div className="section-title" style={{ marginBottom: 18 }}>
          <AlertTriangle className="gold" /> Unusual Spending Spikes
        </div>
        {data.anomalies.length === 0 ? (
          <div className="box ok">
            <p style={{ fontWeight: 600 }}>No significant spending spikes detected.</p>
          </div>
        ) : (
          <div className="grid g2">
            {data.anomalies.map((a) => (
              <div key={a.category} className="box bad">
                <div className="bh">{a.category}</div>
                <p style={{ color: "var(--text)" }}>
                  You spent <b className="coral">{money.fmt0(a.currentSpent)}</b> this month, which is{" "}
                  <b className="coral">{Math.round(a.percentageIncrease)}% higher</b> than your usual {money.fmt0(a.average)} a month.
                </p>
                <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                  If this continues: {money.fmt0(a.difference * 12)} extra in a year.
                </p>
              </div>
            ))}
          </div>
        )}

        {data.transactions?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="flabel" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Zap style={{ width: 13, height: 13 }} /> Unusually large transactions
            </div>
            <div className="flex flex-col gap-2">
              {data.transactions.map((t) => (
                <div key={t.id} className="box flex justify-between items-center" style={{ color: "var(--text)" }}>
                  <span>
                    <b>{t.title}</b>{" "}
                    <span className="faint" style={{ fontSize: 12 }}>
                      · {t.category} · {fmtShortDate(t.date)}
                    </span>
                  </span>
                  <span className="mono coral">
                    {money.fmt0(t.amount)} <span className="faint">({t.times}x usual)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="section-title">
          <Sparkles className="sky" /> Hidden Money Leaks
        </div>
        <p className="section-sub" style={{ marginBottom: 18 }}>
          Frequent small purchases (&lt; {money.fmt0(data.leakThreshold || 150)}) that add up over time.
        </p>
        {data.leaks.length === 0 ? (
          <div className="box ok">
            <p style={{ fontWeight: 600 }}>Your discretionary spending looks tightly controlled!</p>
          </div>
        ) : (
          <div className="grid g3">
            {data.leaks.map((l) => (
              <div key={`${l.title}-${l.category}`} className="box" style={{ color: "var(--text)" }}>
                <b style={{ fontSize: 14 }}>{l.title}</b>
                <div className="faint" style={{ fontSize: 11.5 }}>{l.category}</div>
                <div className="flex justify-between" style={{ marginTop: 10, fontSize: 13 }}>
                  <span className="muted">This month</span>
                  <b>
                    {l.count} times · <span className="coral">{money.fmt0(l.total)}</span>
                  </b>
                </div>
                <div className="box ok" style={{ marginTop: 10, padding: "8px 10px" }}>
                  <p style={{ fontSize: 12 }}>
                    Cutting this saves about <b>{money.fmt0(l.yearlyImpact)}/year</b>.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
