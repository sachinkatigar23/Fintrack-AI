import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Plus, Search, FileText } from "../components/common/icons.js";
import toast from "react-hot-toast";
import PageHeader from "../components/common/PageHeader.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import TxnRow from "../components/transactions/TxnRow.jsx";
import TransactionForm from "../components/transactions/TransactionForm.jsx";
import { transactionApi, expenseApi, incomeApi } from "../services/financeApi.js";
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from "../utils/categories.js";
import { useDebounce } from "../hooks/useDebounce.js";
import { useMoney } from "../hooks/useMoney.js";
import { errorMessage } from "../api/axios.js";

const SORTS = [
  ["date:desc", "Newest first"],
  ["date:asc", "Oldest first"],
  ["amount:desc", "Highest amount"],
  ["amount:asc", "Lowest amount"],
  ["title:asc", "Title A-Z"],
];

export default function Transactions() {
  const money = useMoney();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [type, setType] = useState("all");
  const [classification, setClassification] = useState("all");
  const [sort, setSort] = useState("date:desc");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ open: false, record: null, type: "expense" });
  const debounced = useDebounce(search);

  // Global search box in the top bar sends ?search=
  useEffect(() => {
    const q = params.get("search");
    if (q !== null) setSearch(q);
  }, [params]);

  const query = useCallback(() => {
    const [sortBy, order] = sort.split(":");
    return { search: debounced, type, classification, sortBy, order, page, limit: 15 };
  }, [debounced, type, classification, sort, page]);

  const load = useCallback(() => {
    setLoading(true);
    transactionApi
      .list(query())
      .then(setResult)
      .catch((err) => toast.error(errorMessage(err, "Could not load transactions")))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debounced, type, classification, sort]);

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      const res = await (item.type === "income" ? incomeApi : expenseApi).remove(item._id);
      toast.success(res?.billReset ? res.message : "Transaction deleted");
      window.dispatchEvent(new Event("fintrack:data-changed"));
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete"));
    }
  };

  const exportCsv = async () => {
    try {
      const { page: _p, limit: _l, ...rest } = query();
      const res = await transactionApi.exportCsv(rest);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fintrack-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported. Open the file in Excel or Google Sheets.");
    } catch (err) {
      toast.error(errorMessage(err, "Export failed"));
    }
  };

  const classOptions =
    type === "income" ? INCOME_SOURCES : type === "expense" ? EXPENSE_CATEGORIES : [...EXPENSE_CATEGORIES, ...INCOME_SOURCES.filter((s) => s !== "Other")];

  const list = result?.transactions || [];
  const pg = result?.pagination;

  return (
    <>
      <PageHeader eyebrow="FULL LEDGER" title="Transactions" description="Search and review all your income and expenses.">
        <button type="button" className="btn ghost" onClick={exportCsv}>
          <Download /> Export
        </button>
        <button type="button" className="btn primary" onClick={() => setForm({ open: true, record: null, type: "expense" })}>
          <Plus /> Add
        </button>
      </PageHeader>

      <div className="card card-pad">
        <div className="flex flex-wrap gap-3">
          <div className="searchbar" style={{ flex: 1, minWidth: 220, width: "auto", borderRadius: 999 }}>
            <Search />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (params.get("search") !== null) setParams({}, { replace: true });
              }}
              placeholder="Search by title..."
              aria-label="Search by title"
            />
          </div>
          <select className="select sm" value={type} onChange={(e) => { setType(e.target.value); setClassification("all"); }} aria-label="Type">
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select className="select sm" value={classification} onChange={(e) => setClassification(e.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="select sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="chips" style={{ marginTop: 16 }}>
          {[
            ["all", "All"],
            ["income", "Income"],
            ["expense", "Expense"],
          ].map(([v, l]) => (
            <button key={v} type="button" className={`chipf${type === v ? " on" : ""}`} onClick={() => { setType(v); setClassification("all"); }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-hd">
          <h3>Results</h3>
          <span className="sub">{pg?.total ?? 0} FOUND</span>
          <div style={{ flex: 1 }} />
          <div className="flex gap-6 text-right">
            <div>
              <div className="lbl-mono" style={{ fontSize: 8.5 }}>IN</div>
              <div className="amt pos" style={{ fontSize: 14 }}>+{money.fmt2(result?.totals?.in)}</div>
            </div>
            <div>
              <div className="lbl-mono" style={{ fontSize: 8.5 }}>OUT</div>
              <div className="amt neg" style={{ fontSize: 14 }}>-{money.fmt2(result?.totals?.out)}</div>
            </div>
          </div>
        </div>

        {loading && !result && (
          <div className="card-bd flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} style={{ height: 46 }} />
            ))}
          </div>
        )}

        {!loading && list.length === 0 && (
          <EmptyState
            icon={<FileText />}
            title={debounced || type !== "all" || classification !== "all" ? "No matching transactions" : "No transactions yet"}
            text={debounced ? "Try a different search or clear the filters." : "Add your income and expenses to build your ledger."}
            actionLabel="Add transaction"
            onAction={() => setForm({ open: true, record: null, type: "expense" })}
          />
        )}

        {list.map((t) => (
          <TxnRow key={`${t.type}-${t._id}`} item={t} type={t.type} onEdit={(rec) => setForm({ open: true, record: rec, type: rec.type })} onDelete={remove} />
        ))}

        {pg && pg.totalPages > 1 && (
          <div className="pager">
            <span>
              Page {pg.page} of {pg.totalPages}
            </span>
            <div className="flex gap-2">
              <button type="button" className="btn ghost sm" disabled={pg.page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button type="button" className="btn ghost sm" disabled={pg.page >= pg.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <TransactionForm
        open={form.open}
        record={form.record}
        type={form.type}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={load}
      />
    </>
  );
}
