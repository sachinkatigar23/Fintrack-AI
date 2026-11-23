import { useEffect, useState } from "react";
import { Lightbulb } from "../common/icons.js";
import toast from "react-hot-toast";
import Skeleton from "../common/Skeleton.jsx";
import { analyticsApi } from "../../services/financeApi.js";
import { useMoney } from "../../hooks/useMoney.js";
import { errorMessage } from "../../api/axios.js";

export default function SmartBudgetsTab() {
  const money = useMoney();
  const [data, setData] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    analyticsApi.budgetRecs().then(setData).catch(() => setData({ recommendations: [] }));
  }, []);

  const apply = async () => {
    if (!window.confirm("Apply these suggested budgets for this month? Existing limits for these categories will be updated.")) return;
    setApplying(true);
    try {
      const res = await analyticsApi.applyBudgetRecs();
      toast.success(res.message || "Budgets applied");
      window.dispatchEvent(new Event("fintrack:data-changed"));
    } catch (err) {
      toast.error(errorMessage(err, "Failed to apply budgets"));
    } finally {
      setApplying(false);
    }
  };

  if (!data) return <Skeleton style={{ height: 200 }} />;
  const recs = data.recommendations || [];

  return (
    <div className="card">
      <div className="card-hd" style={{ padding: "20px 24px" }}>
        <div>
          <div className="section-title">
            <Lightbulb className="sky" /> Smart Recommendations
          </div>
          <p className="section-sub">Suggested limits based on your 3-month spending averages.</p>
        </div>
        <div style={{ flex: 1 }} />
        {recs.length > 0 && (
          <button type="button" className="btn primary" onClick={apply} disabled={applying}>
            {applying && <span className="spin" />} Apply All Suggested
          </button>
        )}
      </div>
      <div className="card-bd">
        {recs.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>No spending history yet. Add a few expenses to get suggestions.</p>
        ) : (
          <div className="grid g3">
            {recs.map((r) => (
              <div key={r.category} className="box flex items-center justify-between" style={{ color: "var(--text)" }} title={`3-month average: ${money.fmt0(r.average)}`}>
                <div>
                  <b style={{ fontSize: 13.5 }}>{r.category}</b>
                  {r.shareOfIncome !== null && <div className="faint" style={{ fontSize: 11 }}>{r.shareOfIncome}% of this month's income</div>}
                </div>
                <span className="big-mono sky" style={{ fontSize: 17 }}>{money.fmt0(r.suggestedLimit)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
