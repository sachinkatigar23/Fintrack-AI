import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Gauge, HelpCircle, Receipt, Repeat, AlertTriangle, Wallet } from "../components/common/icons.js";
import PageHeader from "../components/common/PageHeader.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import AffordModal from "../components/planning/AffordModal.jsx";
import { planningApi } from "../services/financeApi.js";
import { useMoney } from "../hooks/useMoney.js";
import { fmtShortDate } from "../utils/format.js";
import { errorMessage } from "../api/axios.js";
import { stsStatusTag } from "../components/planning/stsStatus.js";

export default function SafeToSpend() {
  const money = useMoney();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [afford, setAfford] = useState(false);

  const load = useCallback(() => {
    planningApi
      .safeToSpend()
      .then(setData)
      .catch((err) => toast.error(errorMessage(err, "Could not calculate safe to spend")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("fintrack:data-changed", load);
    return () => window.removeEventListener("fintrack:data-changed", load);
  }, [load]);

  const s = data || {};
  const [tagText, tagTone] = data ? stsStatusTag(s, money) : ["", "iris"];
  const setup = s.status === "setup";

  return (
    <>
      <PageHeader eyebrow="PLANNING SPACE" title="Safe to spend" description="What you can spend today without touching bills, goals or your safety buffer.">
        <Link to="/profile#money-settings" className="btn ghost">
          Money settings
        </Link>
        <button type="button" className="btn primary" onClick={() => setAfford(true)}>
          <HelpCircle /> Can I afford this?
        </button>
      </PageHeader>

      {/* Hero */}
      <div className="card sts-hero">
        {loading ? (
          <Skeleton style={{ height: 120 }} />
        ) : setup ? (
          <div className="flex items-start gap-4">
            <span className="sts-ic">
              <Wallet />
            </span>
            <div>
              <span className="tag iris">SET UP</span>
              <h2 className="sts-title" style={{ marginTop: 10 }}>Let's find your safe-to-spend number</h2>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 6, maxWidth: "62ch", lineHeight: 1.6 }}>
                FinTrack needs to know how much money you have. Add your income on the{" "}
                <Link to="/income" className="link">Income</Link> page, or set your starting balance and salary day in{" "}
                <Link to="/profile#money-settings" className="link">Profile → Money settings</Link>.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="lbl-mono">SAFE TO SPEND TODAY</div>
              <h2 className="sts-title">
                You can safely spend <b className={s.leftToday > 0 ? "mint" : "coral"}>{money.fmt0(s.leftToday)}</b> today
              </h2>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
                until payday on {fmtShortDate(s.payday)} · {s.daysLeft} day{s.daysLeft === 1 ? "" : "s"} left
              </p>
              <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 12 }}>
                <span className={`tag ${tagTone}`}>{tagText}</span>
                {s.limitedBy === "budget" && <span className="tag sky">LIMITED BY YOUR MONTHLY BUDGET</span>}
                {s.spentToday > 0 && <span className="faint" style={{ fontSize: 12 }}>{money.fmt0(s.spentToday)} spent today</span>}
              </div>
            </div>
            <div className="sts-side">
              <div>
                <div className="lbl-mono">DAILY ALLOWANCE</div>
                <div className="big-mono" style={{ fontSize: 20, marginTop: 4 }}>{money.fmt0(s.dailyAllowance)}</div>
              </div>
              <div>
                <div className="lbl-mono">SPENDABLE UNTIL PAYDAY</div>
                <div className={`big-mono ${s.spendable < 0 ? "coral" : ""}`} style={{ fontSize: 20, marginTop: 4 }}>{money.fmt0(s.spendable)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!loading && s.balance < s.goalReserve && (
        <div className="box warn flex items-center gap-3" style={{ marginTop: 16 }}>
          <AlertTriangle style={{ width: 16, height: 16, flex: "none" }} />
          <p>
            Your goals hold more than your recorded balance – set your starting balance in{" "}
            <Link to="/profile#money-settings" className="link">Profile</Link>.
          </p>
        </div>
      )}

      {!loading && s.status === "short" && (
        <div className="box bad flex items-center gap-3" style={{ marginTop: 16 }}>
          <AlertTriangle style={{ width: 16, height: 16, flex: "none" }} />
          <p>
            You may run short by {money.fmt0(s.shortBy)} before payday. Consider postponing a bill, pausing goal savings this month or lowering
            your safety buffer.
          </p>
        </div>
      )}

      <div className="grid g2" style={{ marginTop: 16, alignItems: "start" }}>
        {/* Why this number? */}
        <div className="card">
          <div className="card-hd">
            <h3>Why this number?</h3>
          </div>
          <div className="card-bd">
            {loading ? (
              <Skeleton style={{ height: 220 }} />
            ) : (
              <div className="sts-lines">
                {(s.breakdown || []).map((line) => (
                  <div key={line.key} className={`sts-line${line.sign === "=" ? " total" : ""}`}>
                    <span className="sgn">{line.sign === "-" ? "−" : line.sign}</span>
                    <span className="lb">{line.label}</span>
                    <span className={`mono ${line.sign === "=" && line.amount < 0 ? "coral" : ""}`}>
                      {line.key === "days" ? line.value : money.fmt0(line.amount)}
                    </span>
                  </div>
                ))}
                <div className="sts-line total">
                  <span className="sgn">=</span>
                  <span className="lb">Daily allowance</span>
                  <span className="mono">{money.fmt0(s.dailyAllowance)}</span>
                </div>
                {s.goalPlan?.length > 0 && (
                  <p className="faint" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
                    Planned goal savings this cycle: {s.goalPlan.map((g) => `${g.name} ${money.fmt0(g.due)}`).join(" · ")}
                  </p>
                )}
                {s.limitedBy === "budget" && (
                  <p className="faint" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
                    Your monthly budget leaves {money.fmt0(s.budgetLeftToday)} for today, which is lower than your money allows.
                  </p>
                )}
                <p className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
                  <Link to="/profile#money-settings" className="link">Change starting balance, salary day or safety buffer</Link>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Before payday */}
        <div className="card">
          <div className="card-hd">
            <h3>Before payday</h3>
            <span className="sub">{s.timeline?.length || 0} ITEMS</span>
          </div>
          <div className="card-bd">
            {loading ? (
              <Skeleton style={{ height: 220 }} />
            ) : !s.timeline?.length ? (
              <p className="faint" style={{ fontSize: 13 }}>No bills or recurring payments before payday.</p>
            ) : (
              <div className="sts-timeline">
                {s.timeline.map((item, i) => (
                  <div key={`${item.kind}-${item.id || item.name}-${i}`} className="sts-tl">
                    <span className="sts-tl-ic" style={{ color: item.kind === "bill" ? "var(--gold)" : "var(--sky)" }}>
                      {item.kind === "bill" ? <Receipt /> : <Repeat />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                      <div className="faint" style={{ fontSize: 11.5 }}>
                        {item.kind === "bill" ? "Bill" : "Recurring"} · {fmtShortDate(item.date)}
                        {item.overdue && <span className="coral"> · overdue</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono coral" style={{ fontSize: 13 }}>−{money.fmt0(item.amount)}</div>
                      <div className={`mono ${item.leftAfter < 0 ? "coral" : "faint"}`} style={{ fontSize: 11 }}>
                        {money.fmt0(item.leftAfter)} left
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="faint" style={{ fontSize: 11.5, marginTop: 16, display: "flex", gap: 6, alignItems: "center" }}>
        <Gauge style={{ width: 13, height: 13 }} /> "Money left" starts from your balance minus money reserved in goals.
      </p>

      <AffordModal open={afford} onClose={() => setAfford(false)} onChanged={load} />
    </>
  );
}
