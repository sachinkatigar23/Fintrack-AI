import { useEffect, useMemo, useState } from "react";
import { Plus, ArrowUpRight } from "../components/common/icons.js";
import toast from "react-hot-toast";
import PageHeader from "../components/common/PageHeader.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import AnimatedNumber from "../components/common/AnimatedNumber.jsx";
import Ring from "../components/common/Ring.jsx";
import TxnRow from "../components/transactions/TxnRow.jsx";
import TransactionForm from "../components/transactions/TransactionForm.jsx";
import { incomeApi, dashboardApi } from "../services/financeApi.js";
import { useMoney } from "../hooks/useMoney.js";
import { errorMessage } from "../api/axios.js";

export default function Income() {
  const money = useMoney();
  const [incomes, setIncomes] = useState([]);
  const [month, setMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ open: false, record: null });

  const load = () =>
    Promise.all([incomeApi.list(), dashboardApi.get({ range: 7 })])
      .then(([i, d]) => {
        setIncomes(i.incomes);
        setMonth(d);
      })
      .catch((err) => toast.error(errorMessage(err, "Could not load income")))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = incomes.reduce((s, i) => s + i.amount, 0);
    const sources = new Set(incomes.map((i) => i.source)).size;
    const months = new Set(incomes.map((i) => new Date(i.date).toISOString().slice(0, 7))).size || 1;
    return { total, sources, avg: total / months };
  }, [incomes]);

  const monthlyIncome = month?.monthlyIncome || 0;
  const monthlySpend = month?.monthlyExpenses || 0;
  const keptPct = monthlyIncome ? Math.max(0, ((monthlyIncome - monthlySpend) / monthlyIncome) * 100) : 0;
  const netSaved = monthlyIncome - monthlySpend;

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await incomeApi.remove(item._id);
      toast.success("Income deleted");
      window.dispatchEvent(new Event("fintrack:data-changed"));
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete income"));
    }
  };

  return (
    <>
      <PageHeader eyebrow="MONEY IN" title="Income" description="Every rupee coming in, tracked at the source.">
        <button type="button" className="btn primary" onClick={() => setForm({ open: true, record: null })}>
          <Plus /> Add income
        </button>
      </PageHeader>

      <div className="card hero">
        <div className="hero-r">
          <div className="hero-l">
            <div className="muted" style={{ fontSize: 12.5 }}>Total recorded income</div>
            <div className="big-mono mint" style={{ fontSize: 44, margin: "8px 0 14px" }}>
              {loading ? <Skeleton style={{ height: 44, width: 260 }} /> : <AnimatedNumber value={stats.total} format={money.fmt2} />}
            </div>
            <p className="muted" style={{ fontSize: 14 }}>
              {month?.incomeSources || 0} source{month?.incomeSources === 1 ? "" : "s"} this month. You're keeping {keptPct.toFixed(1)}% of it.
            </p>
          </div>
          <Ring value={keptPct} size={140} stroke={11} gradient={["#2FD6A6", "#7CF0CF"]}>
            <b className="mint" style={{ fontSize: 28 }}>{keptPct.toFixed(1)}%</b>
            <span>KEPT</span>
          </Ring>
        </div>
      </div>

      <div className="grid g3" style={{ marginTop: 16 }}>
        <div className="card card-pad">
          <div className="lbl-mono" style={{ color: "var(--text-2)" }}>SOURCES</div>
          <div className="big-mono" style={{ fontSize: 28, margin: "10px 0 6px" }}>{stats.sources}</div>
          <div className="muted" style={{ fontSize: 12 }}>{incomes.length} total records</div>
        </div>
        <div className="card card-pad">
          <div className="lbl-mono" style={{ color: "var(--text-2)" }}>AVG / MONTH</div>
          <div className="big-mono" style={{ fontSize: 28, margin: "10px 0 6px" }}>{money.fmt2(stats.avg)}</div>
          <div className="muted" style={{ fontSize: 12 }}>Based on {incomes.length} records</div>
        </div>
        <div className="card card-pad">
          <div className="lbl-mono" style={{ color: "var(--text-2)" }}>NET SAVED</div>
          <div className={`big-mono ${netSaved < 0 ? "coral" : ""}`} style={{ fontSize: 28, margin: "10px 0 6px" }}>
            {money.fmt2(netSaved)}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>After {money.fmt2(monthlySpend)} spent this month</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-hd">
          <h3>All income</h3>
          <span className="sub">{incomes.length} RECORDS</span>
        </div>

        {loading && (
          <div className="card-bd flex flex-col gap-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} style={{ height: 46 }} />
            ))}
          </div>
        )}

        {!loading && incomes.length === 0 && (
          <EmptyState
            icon={<ArrowUpRight />}
            title="No income found"
            text="You haven't recorded any income yet. Add your salary or other earnings to get started."
            actionLabel="Add your first income"
            onAction={() => setForm({ open: true, record: null })}
          />
        )}

        {incomes.map((i) => (
          <TxnRow key={i._id} item={i} type="income" showMethod onEdit={(rec) => setForm({ open: true, record: { ...rec, type: "income" } })} onDelete={remove} />
        ))}
      </div>

      <TransactionForm
        open={form.open}
        record={form.record}
        type="income"
        lockType
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={load}
      />
    </>
  );
}
