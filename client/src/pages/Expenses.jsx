import { useEffect, useMemo, useState } from "react";
import { Plus, ArrowDownRight } from "../components/common/icons.js";
import toast from "react-hot-toast";
import PageHeader from "../components/common/PageHeader.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import AnimatedNumber from "../components/common/AnimatedNumber.jsx";
import TxnRow from "../components/transactions/TxnRow.jsx";
import TransactionForm from "../components/transactions/TransactionForm.jsx";
import { expenseApi } from "../services/financeApi.js";
import { EXPENSE_CATEGORIES, RANK_COLORS, BAR_GRADIENT } from "../utils/categories.js";
import { useMoney } from "../hooks/useMoney.js";
import { errorMessage } from "../api/axios.js";

export default function Expenses() {
  const money = useMoney();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ open: false, record: null });

  const load = () =>
    expenseApi
      .list()
      .then((d) => setExpenses(d.expenses))
      .catch((err) => toast.error(errorMessage(err, "Could not load expenses")))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const total = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  // This month's spending by category (hero tags + bars)
  const thisMonth = useMemo(() => {
    const now = new Date();
    const list = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const byCat = {};
    list.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
    const cats = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount], i) => ({ name, amount, color: RANK_COLORS[i % RANK_COLORS.length] }));
    return { count: list.length, cats };
  }, [expenses]);

  // Category totals for all recorded expenses (tags + bar chart, same scope as the total above)
  const allCats = useMemo(() => {
    const byCat = {};
    expenses.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));
    return Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount], i) => ({ name, amount, color: RANK_COLORS[i % RANK_COLORS.length] }));
  }, [expenses]);

  const maxCat = allCats[0]?.amount || 1;
  const usedCategories = EXPENSE_CATEGORIES.filter((c) => expenses.some((e) => e.category === c));
  const shown = filter === "all" ? expenses : expenses.filter((e) => e.category === filter);

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await expenseApi.remove(item._id);
      setExpenses((list) => list.filter((e) => e._id !== item._id));
      toast.success("Expense deleted");
      window.dispatchEvent(new Event("fintrack:data-changed"));
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete expense"));
    }
  };

  const onSaved = (saved) => {
    setExpenses((list) => {
      const exists = list.some((e) => e._id === saved._id);
      const next = exists ? list.map((e) => (e._id === saved._id ? saved : e)) : [saved, ...list];
      return next.sort((a, b) => new Date(b.date) - new Date(a.date));
    });
  };

  return (
    <>
      <PageHeader eyebrow="MONEY OUT" title="Expenses" description="Keep a clear record of where your money goes.">
        <button type="button" className="btn primary" onClick={() => setForm({ open: true, record: null })}>
          <Plus /> Add expense
        </button>
      </PageHeader>

      <div className="card hero">
        <div className="hero-r">
          <div className="hero-l">
            <div className="muted" style={{ fontSize: 12.5 }}>Total recorded expenses</div>
            <div className="big-mono" style={{ fontSize: 44, margin: "8px 0 12px" }}>
              {loading ? <Skeleton style={{ height: 44, width: 260 }} /> : <AnimatedNumber value={total} format={money.fmt2} />}
            </div>
            <p className="muted" style={{ fontSize: 14 }}>
              {thisMonth.count} expense{thisMonth.count === 1 ? "" : "s"} recorded across {thisMonth.cats.length} categor
              {thisMonth.cats.length === 1 ? "y" : "ies"} this month.
            </p>
            <div className="chips" style={{ marginTop: 18 }}>
              {allCats.slice(0, 4).map((c) => (
                <span key={c.name} className={`tag ${c.color === "coral" ? "neg" : c.color === "mint" ? "pos" : c.color}`}>
                  {c.name.toUpperCase()} {money.fmt2(c.amount)}
                </span>
              ))}
            </div>
          </div>
          {allCats.length > 0 && (
            <div className="bars hide-sm" style={{ width: 330, flex: "none", padding: 0 }}>
              {allCats.slice(0, 3).map((c) => (
                <div className="barc" key={c.name} title={`${c.name}: ${money.fmt2(c.amount)}`}>
                  <div
                    className="bar"
                    style={{ "--h": `${Math.max(6, (c.amount / maxCat) * 118)}px`, background: BAR_GRADIENT[c.color] }}
                  >
                    <b>{money.fmt0(c.amount)}</b>
                  </div>
                  <span className="bl">{c.name.length > 12 ? `${c.name.slice(0, 11)}` : c.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-hd">
          <h3>All expenses</h3>
          <div style={{ flex: 1 }} />
          <select className="select sm" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by category">
            <option value="all">All</option>
            {usedCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="card-bd flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} style={{ height: 46 }} />
            ))}
          </div>
        )}

        {!loading && shown.length === 0 && (
          <EmptyState
            icon={<ArrowDownRight />}
            title="No expenses found"
            text="You haven't recorded any expenses yet. Add one to get started."
            actionLabel="Add your first expense"
            onAction={() => setForm({ open: true, record: null })}
          />
        )}

        {shown.map((e) => (
          <TxnRow key={e._id} item={e} type="expense" showMethod onEdit={(rec) => setForm({ open: true, record: { ...rec, type: "expense" } })} onDelete={remove} />
        ))}
      </div>

      <TransactionForm
        open={form.open}
        record={form.record}
        type="expense"
        lockType
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={onSaved}
      />
    </>
  );
}
