import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Printer } from "../components/common/icons.js";
import toast from "react-hot-toast";
import PageHeader from "../components/common/PageHeader.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import AnimatedNumber from "../components/common/AnimatedNumber.jsx";
import { analyticsApi, transactionApi } from "../services/financeApi.js";
import { useMoney } from "../hooks/useMoney.js";
import { errorMessage } from "../api/axios.js";
import { toInputDate } from "../utils/format.js";

const RANGES = [
  ["month", "This month"],
  ["lastMonth", "Last month"],
  ["quarter", "Last 3 months"],
  ["year", "This year"],
  ["all", "All recorded data"],
];

// from / to dates for the CSV export of the same range
const rangeDates = (period) => {
  const now = new Date();
  const first = (y, m) => new Date(y, m, 1);
  switch (period) {
    case "month":
      return { from: toInputDate(first(now.getFullYear(), now.getMonth())), to: toInputDate(now) };
    case "lastMonth":
      return { from: toInputDate(first(now.getFullYear(), now.getMonth() - 1)), to: toInputDate(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "quarter":
      return { from: toInputDate(first(now.getFullYear(), now.getMonth() - 2)), to: toInputDate(now) };
    case "year":
      return { from: toInputDate(first(now.getFullYear(), 0)), to: toInputDate(now) };
    default:
      return {};
  }
};

export default function Reports() {
  const money = useMoney();
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsApi
      .get(period)
      .then(setData)
      .catch((err) => toast.error(errorMessage(err, "Could not load report")))
      .finally(() => setLoading(false));
  }, [period]);

  const exportCsv = async () => {
    try {
      const res = await transactionApi.exportCsv(rangeDates(period));
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fintrack-report-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err, "Export failed"));
    }
  };

  const cats = data?.categories || [];
  const tiles = [
    ["INCOME", data?.totalIncome, "mint"],
    ["EXPENSES", data?.totalExpenses, "coral"],
    ["NET BALANCE", data?.balance, data?.balance < 0 ? "coral" : ""],
  ];

  return (
    <>
      <PageHeader eyebrow="ANALYSIS" title="Financial reports" description="Totals use the selected time range.">
        <select className="select sm" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Time range" style={{ minWidth: 180 }}>
          {RANGES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button type="button" className="btn ghost" onClick={exportCsv} title="Download CSV (opens in Excel)">
          <Download /> CSV / Excel
        </button>
        <button type="button" className="btn ghost" onClick={() => window.print()} title="Print or save as PDF">
          <Printer /> PDF
        </button>
      </PageHeader>

      <div className="grid g3">
        {tiles.map(([label, value, tone]) => (
          <div key={label} className="card card-pad">
            <div className="lbl-mono" style={{ color: "var(--text-2)", fontWeight: 600 }}>
              {label}
            </div>
            <div className={`big-mono ${tone}`} style={{ fontSize: 30, marginTop: 12 }}>
              {loading ? <Skeleton style={{ height: 30, width: 150 }} /> : <AnimatedNumber value={value} format={money.fmt0} />}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-hd">
          <h3>Expenses by category</h3>
          {data?.savingsRate ? <span className="sub">SAVINGS RATE {data.savingsRate.toFixed(1)}%</span> : null}
        </div>
        {!loading && cats.length === 0 && (
          <p className="faint" style={{ padding: 24, fontSize: 13 }}>
            No expenses in this period.
          </p>
        )}
        {cats.map((c) => (
          <div key={c.name} style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
            <div className="flex justify-between" style={{ marginBottom: 12 }}>
              <b style={{ fontSize: 13.5, fontWeight: 600 }}>
                {c.name} <span className="faint mono" style={{ fontSize: 11, fontWeight: 400 }}>· {c.pct.toFixed(1)}% · {c.count} txn</span>
              </b>
              <span className="mono" style={{ fontWeight: 600 }}>{money.fmt0(c.amount)}</span>
            </div>
            <div className="prog" style={{ height: 6 }}>
              <i style={{ width: `${c.pct}%`, background: "var(--coral)" }} />
            </div>
          </div>
        ))}
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-hd">
            <h3>Income vs expenses</h3>
            <span className="sub">LAST 6 MONTHS</span>
          </div>
          <div style={{ height: 280, padding: "18px 12px 8px" }}>
            {loading && !data ? (
              <Skeleton style={{ height: "100%" }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.trend || []} barGap={4}>
                  <CartesianGrid vertical={false} stroke="rgba(147,161,188,.12)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#8A97AD", fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#8A97AD", fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={40} />
                  <Tooltip
                    formatter={(v, n) => [money.fmt0(v), n === "income" ? "Income" : "Expenses"]}
                    contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-hi)", borderRadius: 12, color: "var(--text)" }}
                    cursor={{ fill: "rgba(124,107,255,.08)" }}
                  />
                  <Legend formatter={(v) => (v === "income" ? "Income" : "Expenses")} />
                  <Bar dataKey="income" fill="#2FD6A6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" fill="#FF6B7A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-hd">
            <h3>Income by source</h3>
          </div>
          <div className="leg" style={{ paddingTop: 16 }}>
            {(data?.sources || []).length === 0 && <p className="faint" style={{ fontSize: 13 }}>No income in this period.</p>}
            {(data?.sources || []).map((s, i) => (
              <div key={s.name} className="leg-i">
                <span className="sw" style={{ background: ["#2FD6A6", "#4FA8E8", "#7C6BFF", "#F5B944", "#FF6B7A"][i % 5] }} />
                <span className="ln">{s.name}</span>
                <span className="lv">{money.fmt0(s.amount)}</span>
                <span className="lp">{data.totalIncome ? Math.round((s.amount / data.totalIncome) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
