import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CreditCard, ArrowUpRight, ArrowDownRight, Clock, Plus, Sparkles, FileText } from "../components/common/icons.js";
import toast from "react-hot-toast";
import PageHeader from "../components/common/PageHeader.jsx";
import AnimatedNumber from "../components/common/AnimatedNumber.jsx";
import Sparkline from "../components/common/Sparkline.jsx";
import Ring from "../components/common/Ring.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import TransactionForm from "../components/transactions/TransactionForm.jsx";
import TxnRow from "../components/transactions/TxnRow.jsx";
import { dashboardApi, aiApi } from "../services/financeApi.js";
import { useAuth } from "../hooks/useAuth.js";
import { useMoney } from "../hooks/useMoney.js";
import { greeting, monthKey, daysUntil, fmtShortDate } from "../utils/format.js";
import { errorMessage } from "../api/axios.js";

const ICON_BG = {
  sky: "linear-gradient(145deg,#62B6F2,#2E7BC0)",
  mint: "linear-gradient(145deg,#45E2B5,#17A57C)",
  coral: "linear-gradient(145deg,#FF808C,#E5465A)",
  iris: "linear-gradient(145deg,#9B8CFF,#6A56F0)",
};

const monthOptions = () => {
  const now = new Date();
  return [0, 1, 2, 3].map((i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      key: monthKey(d),
      label: i === 0 ? "This month" : i === 1 ? "Last month" : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    };
  });
};

function StatCard({ label, value, icon: Icon, tone, foot, spark, sparkColor, loading, money }) {
  return (
    <div className={`card stat s-${tone}`}>
      <div className="top">
        <span className="lbl">{label}</span>
        <span className="ic" style={{ background: ICON_BG[tone] }}>
          <Icon />
        </span>
      </div>
      <div className="val">{loading ? <Skeleton style={{ height: 30, width: 120 }} /> : <AnimatedNumber value={value} format={money.fmt0} />}</div>
      <div className="foot">{loading ? <Skeleton style={{ height: 12, width: 110 }} /> : foot}</div>
      <Sparkline data={spark} color={sparkColor} />
    </div>
  );
}

function Tile({ label, value, valueClass = "", barPct = 0, barColor = "var(--iris)", foot, loading }) {
  return (
    <div className="card card-pad">
      <div className="lbl" style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>
        {label}
      </div>
      <div className={`big-mono ${valueClass}`} style={{ fontSize: 26, margin: "16px 0 14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {loading ? <Skeleton style={{ height: 28, width: "70%" }} /> : value}
      </div>
      <div className="prog">
        <i style={{ width: `${Math.max(0, Math.min(100, barPct))}%`, background: barColor }} />
      </div>
      <div className="faint" style={{ fontSize: 11.5, marginTop: 12 }}>
        {foot}
      </div>
    </div>
  );
}

const ChartTip = ({ active, payload, label, money }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="menu" style={{ position: "static", padding: "10px 12px", minWidth: 150 }}>
      <b style={{ fontSize: 12 }}>{label}</b>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4" style={{ fontSize: 12, marginTop: 4 }}>
          <span style={{ color: p.color }}>{p.dataKey === "expense" ? "Expenses" : "Income"}</span>
          <span className="mono">{money.fmt0(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const money = useMoney();
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0].key);
  const [range, setRange] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    dashboardApi
      .get({ month, range })
      .then(setData)
      .catch((err) => toast.error(errorMessage(err, "Could not load dashboard")))
      .finally(() => setLoading(false));
  }, [month, range]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    aiApi.brief().then(setBrief).catch(() => setBrief({ lines: ["Money Brief is unavailable right now."] }));
  }, []);

  const firstName = (user?.name || "there").split(" ")[0];
  const d = data || {};
  const tiles = d.tiles || {};
  const rhythm = d.rhythm || [];
  const health = d.health || {};
  const totalExp = rhythm.reduce((s, r) => s + r.expense, 0);
  const totalInc = rhythm.reduce((s, r) => s + r.income, 0);

  const budgetTag = {
    under: ["UNDER BUDGET", "pos"],
    warning: ["NEAR LIMIT", "gold"],
    over: ["OVER BUDGET", "neg"],
    none: ["NO BUDGET SET", "iris"],
  }[d.budgetStatus || "none"];

  const bill = tiles.upcomingBill;
  const billDays = bill ? daysUntil(bill.dueDate) : null;
  const scoreColor = health.score >= 70 ? ["#F5B944", "#FFD27A"] : health.score >= 40 ? ["#F5B944", "#FF9F6B"] : ["#FF6B7A", "#FF9F6B"];

  return (
    <>
      <PageHeader
        eyebrow="YOUR MONEY, SIMPLIFIED"
        title={
          <>
            {greeting()}, <em style={{ fontStyle: "normal" }}>{firstName}</em>.
          </>
        }
        description="Your financial pulse, powered by your real records."
      >
        <select className="select sm" value={month} onChange={(e) => { setLoading(true); setMonth(e.target.value); }} aria-label="Month">
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn primary" onClick={() => setFormOpen(true)}>
          <Plus /> Add transaction
        </button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid g4">
        <StatCard
          label="Available balance"
          value={d.balance}
          icon={CreditCard}
          tone="sky"
          spark={d.sparks?.balance}
          sparkColor="#4FA8E8"
          loading={loading}
          money={money}
          foot={
            d.goalReserve > 0 ? (
              <>
                <span className="tag iris">GOALS</span> {money.fmt0(d.goalReserve)} reserved in goals
              </>
            ) : (
              <>
                <span className="tag pos">LIVE</span> from your records
              </>
            )
          }
        />
        <StatCard
          label="Monthly income"
          value={d.monthlyIncome}
          icon={ArrowUpRight}
          tone="mint"
          spark={d.sparks?.income}
          sparkColor="#2FD6A6"
          loading={loading}
          money={money}
          foot={
            d.incomeSources ? (
              <span className="mint">
                ▲ {d.incomeSources} source{d.incomeSources > 1 ? "s" : ""} <span className="muted">· {d.topIncomeSource}</span>
              </span>
            ) : (
              "No income this month"
            )
          }
        />
        <StatCard
          label="Monthly spend"
          value={d.monthlyExpenses}
          icon={ArrowDownRight}
          tone="coral"
          spark={d.sparks?.expense}
          sparkColor="#FF6B7A"
          loading={loading}
          money={money}
          foot={
            <>
              <span className="coral">
                {d.expenseCount || 0} expense{d.expenseCount === 1 ? "" : "s"}
              </span>
              · {Math.round(d.spendPctOfIncome || 0)}% of income
            </>
          }
        />
        <StatCard
          label="Budget remaining"
          value={d.budgetRemaining ?? 0}
          icon={Clock}
          tone="iris"
          spark={d.sparks?.budget}
          sparkColor="#7C6BFF"
          loading={loading}
          money={money}
          foot={<span className={`tag ${budgetTag[1]}`}>{budgetTag[0]}</span>}
        />
      </div>

      {/* Chart + health + brief */}
      <div className="split" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-hd">
            <h3>Spending rhythm</h3>
            <div className="hd-sp" style={{ flex: 1 }} />
            <div className="chips">
              {[7, 30, 90].map((r) => (
                <button key={r} type="button" className={`chipf${range === r ? " on" : ""}`} onClick={() => setRange(r)}>
                  {r}D
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 255, padding: "18px 18px 0" }}>
            {loading && !data ? (
              <Skeleton style={{ height: "100%" }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rhythm} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gExp" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#FF6B7A" stopOpacity={0.35} />
                      <stop offset="1" stopColor="#FF6B7A" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gInc" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#2FD6A6" stopOpacity={0.22} />
                      <stop offset="1" stopColor="#2FD6A6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" hide />
                  <YAxis hide domain={[0, "auto"]} />
                  <Tooltip content={<ChartTip money={money} />} cursor={{ stroke: "rgba(124,107,255,.35)" }} />
                  <Area type="monotone" dataKey="income" stroke="#2FD6A6" strokeWidth={2} fill="url(#gInc)" />
                  <Area type="monotone" dataKey="expense" stroke="#FF6B7A" strokeWidth={2.4} fill="url(#gExp)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex gap-6" style={{ borderTop: "1px solid var(--line)", padding: "14px 24px", fontSize: 12, color: "var(--text-2)" }}>
            <span className="flex items-center gap-2">
              <i style={{ width: 9, height: 9, borderRadius: 3, background: "var(--coral)", display: "inline-block" }} /> Expenses {money.fmt0(totalExp)}
            </span>
            <span className="flex items-center gap-2">
              <i style={{ width: 9, height: 9, borderRadius: 3, background: "var(--mint)", display: "inline-block" }} /> Income {money.fmt0(totalInc)}
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-hd">
              <h3>Financial health</h3>
              <div style={{ flex: 1 }} />
              <Link to="/insights" className="btn ghost sm">
                View details
              </Link>
            </div>
            <div className="card-bd flex items-center gap-6">
              <Ring value={health.score || 0} size={116} stroke={9} gradient={scoreColor}>
                <b>{loading ? "–" : health.score || 0}</b>
                <span>OUT OF 100</span>
              </Ring>
              <div className="flex-1 flex flex-col gap-3">
                {!health.hasData && <p className="muted" style={{ fontSize: 13 }}>Add records to see your health factors.</p>}
                {(health.positivePoints || []).slice(0, 2).map((p) => (
                  <div key={p} className="dotline" style={{ fontSize: 12.5 }}>
                    <i style={{ background: "var(--mint)" }} />
                    <span className="muted">{p}</span>
                  </div>
                ))}
                {(health.attentionPoints || []).slice(0, 1).map((p) => (
                  <div key={p} className="dotline" style={{ fontSize: 12.5 }}>
                    <i style={{ background: "var(--gold)" }} />
                    <span className="muted">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card ai">
            <div className="ai-hd">
              <span className="ai-ic">
                <Sparkles />
              </span>
              <div>
                <b style={{ fontSize: 14 }}>Money Brief</b>
                <div className="lbl-mono" style={{ fontSize: 9 }}>
                  {brief?.aiGenerated ? "AI GENERATED · " : ""}GENERATED RECENTLY
                </div>
              </div>
            </div>
            <div style={{ paddingBottom: 14 }}>
              {!brief && (
                <div style={{ padding: "0 24px 8px" }}>
                  <Skeleton style={{ height: 12, marginBottom: 8 }} />
                  <Skeleton style={{ height: 12, width: "70%" }} />
                </div>
              )}
              {brief?.lines?.map((line, i) => (
                <div key={line} className="ins" style={{ animationDelay: `${i * 120}ms`, padding: "6px 24px" }}>
                  <span className="d" style={{ background: ["#A99BFF", "#4FA8E8", "#2FD6A6"][i % 3] }} />
                  <p>{line}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Insight tiles */}
      <div className="tiles4" style={{ marginTop: 16 }}>
        <Tile
          label="Month's spend"
          loading={loading}
          value={money.fmt0(tiles.monthSpend)}
          valueClass="coral"
          barPct={tiles.budgetUsedPct}
          barColor={tiles.budgetUsedPct >= 100 ? "var(--coral)" : tiles.budgetUsedPct >= 80 ? "var(--gold)" : "var(--iris)"}
          foot={tiles.hasBudget ? `${Math.round(tiles.budgetUsedPct)}% of budget used` : "No budget set"}
        />
        <Tile
          label="Top category"
          loading={loading}
          value={tiles.topCategory?.name || "–"}
          barPct={tiles.topCategory?.pct || 0}
          barColor="var(--gold)"
          foot={tiles.topCategory ? `${money.fmt0(tiles.topCategory.amount)} spent` : "No spend"}
        />
        <Tile
          label="Upcoming bill"
          loading={loading}
          value={bill ? bill.name : "None pending"}
          barPct={bill ? Math.max(5, 100 - billDays * 10) : 0}
          barColor={billDays !== null && billDays <= 3 ? "var(--coral)" : "var(--gold)"}
          foot={
            bill
              ? `${money.fmt0(bill.amount)} · ${billDays === 0 ? "due today" : `due ${fmtShortDate(bill.dueDate)} (${billDays}d)`}`
              : "All clear"
          }
        />
        <Tile
          label="Projected savings"
          loading={loading}
          value={money.fmt0(tiles.projectedSavings)}
          valueClass={tiles.projectedSavings < 0 ? "coral" : "mint"}
          barPct={tiles.projectedPct}
          barColor="var(--mint)"
          foot="Est. savings by month end"
        />
      </div>

      {/* Recent activity */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-hd">
          <h3>Recent transactions</h3>
          <span className="sub">LATEST 5</span>
          <div style={{ flex: 1 }} />
          <Link to="/transactions" className="btn ghost sm">
            <FileText /> View all
          </Link>
        </div>
        {(d.recent || []).length === 0 && !loading && (
          <p className="faint" style={{ padding: 24, fontSize: 13 }}>
            No transactions yet. Click “Add transaction” to record your first one.
          </p>
        )}
        {(d.recent || []).map((t) => (
          <TxnRow key={t._id} item={t} type={t.type} />
        ))}
      </div>

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} type="expense" onSaved={load} />
    </>
  );
}
