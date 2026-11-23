import { useEffect, useState } from "react";
import { RefreshCw } from "../common/icons.js";
import AINote from "./AINote.jsx";
import { aiApi } from "../../services/financeApi.js";
import { errorMessage } from "../../api/axios.js";
import { monthLabel } from "../../utils/format.js";

const gradeStyle = (g = "") =>
  g.startsWith("A")
    ? { background: "rgba(47,214,166,.14)", color: "var(--mint)" }
    : g.startsWith("B")
      ? { background: "rgba(79,168,232,.14)", color: "var(--sky)" }
      : g.startsWith("C")
        ? { background: "rgba(245,185,68,.14)", color: "var(--gold)" }
        : { background: "rgba(255,107,122,.14)", color: "var(--coral)" };

export default function RecapTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (refresh = false) => {
    setLoading(true);
    setError("");
    aiApi
      .recap(refresh ? { refresh: 1 } : undefined)
      .then(setData)
      .catch((err) => setError(errorMessage(err, "Could not generate the report card")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card card-pad">
      <div className="text-center" style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Your AI Financial Report Card</h3>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          A high-level summary of your financial health and progress this month{data?.month ? ` (${monthLabel(data.month)})` : ""}.
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3" style={{ padding: 40 }}>
          <span className="spin dark" style={{ width: 30, height: 30, borderWidth: 3 }} />
          <p className="faint" style={{ fontSize: 12.5 }}>Analysing this month's records...</p>
        </div>
      )}

      {!loading && error && <div className="box bad"><p>{error}</p></div>}

      {!loading && data?.empty && (
        <div className="box text-center">
          <p className="muted">No records for this month yet. Add income and expenses to get your report card.</p>
        </div>
      )}

      {!loading && data && !data.empty && (
        <>
          <div className="grid g2" style={{ alignItems: "stretch" }}>
            <div className="box flex flex-col items-center justify-center" style={{ minHeight: 200 }}>
              <div className="lbl-mono" style={{ color: "var(--text-2)", marginBottom: 14 }}>OVERALL GRADE</div>
              <div className="grade" style={gradeStyle(data.grade)}>
                {data.grade}
              </div>
              <div className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>Health score {data.healthScore}/100</div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="box ok">
                <div className="bh">Top win</div>
                <p style={{ fontWeight: 500 }}>{data.topWin}</p>
              </div>
              <div className="box warn">
                <div className="bh">Area for improvement</div>
                <p style={{ fontWeight: 500 }}>{data.topImprovement}</p>
              </div>
            </div>
          </div>

          <div className="box info" style={{ marginTop: 16, padding: "20px 22px" }}>
            <div className="bh">Advice for next month</div>
            <p style={{ fontSize: 15, fontWeight: 500 }}>{data.advice}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2" style={{ marginTop: 18 }}>
            {data.metrics?.map((m) => (
              <span key={m} className="pill">
                {m}
              </span>
            ))}
          </div>

          <div className="flex flex-col items-center" style={{ marginTop: 14 }}>
            <button type="button" className="btn ghost sm" onClick={() => load(true)}>
              <RefreshCw /> Regenerate
            </button>
            <AINote data={data} />
          </div>
        </>
      )}
    </div>
  );
}
