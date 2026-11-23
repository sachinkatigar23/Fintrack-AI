import { useState } from "react";
import { LineChart } from "../common/icons.js";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import AINote from "./AINote.jsx";
import { aiApi } from "../../services/financeApi.js";
import { errorMessage } from "../../api/axios.js";
import { useMoney } from "../../hooks/useMoney.js";
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from "../../utils/categories.js";

export default function SimulatorTab() {
  const money = useMoney();
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("Food");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (e) => {
    e.preventDefault();
    if (!Number(amount)) return setError("Enter an amount, e.g. -1000 to reduce or 5000 to increase.");
    setBusy(true);
    setError("");
    try {
      // The simulation never changes your real records
      setResult(await aiApi.simulate({ type, category, amount: Number(amount) }));
    } catch (err) {
      setError(errorMessage(err, "Simulation failed. Try again later."));
    } finally {
      setBusy(false);
    }
  };

  const better = result && result.monthlyDifference >= 0;

  return (
    <div className="grid g2" style={{ alignItems: "start" }}>
      <div className="card card-pad">
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>What-If Simulator</h3>
        <p className="section-sub" style={{ marginBottom: 20 }}>See how changes impact your yearly savings.</p>
        <form onSubmit={run} className="flex flex-col gap-4">
          <label className="field">
            <span>I want to change my</span>
            <select className="select" value={type} onChange={(e) => { setType(e.target.value); setCategory(e.target.value === "income" ? "Salary" : "Food"); }}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <input className="input" list="sim-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={type === "income" ? "e.g. Salary" : "e.g. Food"} />
            <datalist id="sim-cats">
              {(type === "income" ? INCOME_SOURCES : EXPENSE_CATEGORIES).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>By amount (per month)</span>
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. -1000 or 5000" />
          </label>
          {error && <small className="ferr">{error}</small>}
          <button type="submit" className="btn grad block" disabled={busy} style={{ padding: "12px 16px" }}>
            {busy && <span className="spin" />} {busy ? "Simulating..." : "Run Simulation"}
          </button>
        </form>
      </div>

      <div className="card card-pad">
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Projected Impact</h3>
        {!result ? (
          <div className="box text-center" style={{ padding: "40px 16px" }}>
            <span className="ai-ic" style={{ margin: "0 auto 14px", width: 44, height: 44, borderRadius: "50%", background: "var(--sky-soft)", boxShadow: "none" }}>
              <LineChart className="sky" />
            </span>
            <p className="muted" style={{ fontWeight: 500 }}>Run a simulation to see your projected results.</p>
          </div>
        ) : (
          <>
            <div className="grid g2" style={{ gap: 10 }}>
              <div className="box" style={{ color: "var(--text)" }}>
                <div className="lbl-mono">{result.item} now</div>
                <div className="big-mono" style={{ fontSize: 19, marginTop: 6 }}>{money.fmt0(result.currentMonthly)}/mo</div>
              </div>
              <div className="box" style={{ color: "var(--text)" }}>
                <div className="lbl-mono">After change</div>
                <div className="big-mono" style={{ fontSize: 19, marginTop: 6 }}>{money.fmt0(result.newMonthly)}/mo</div>
              </div>
              <div className={`box ${better ? "ok" : "bad"}`}>
                <div className="bh">Monthly savings</div>
                <div className="big-mono" style={{ fontSize: 19 }}>
                  {better ? "+" : "-"}
                  {money.fmt0(Math.abs(result.monthlyDifference))}
                </div>
              </div>
              <div className={`box ${better ? "ok" : "bad"}`}>
                <div className="bh">Yearly impact</div>
                <div className="big-mono" style={{ fontSize: 19 }}>
                  {result.yearlyImpact >= 0 ? "+" : "-"}
                  {money.fmt0(Math.abs(result.yearlyImpact))}
                </div>
              </div>
            </div>

            <div style={{ height: 190, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.chart} barSize={46}>
                  <CartesianGrid vertical={false} stroke="rgba(147,161,188,.12)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#8A97AD", fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: "#8A97AD", fontSize: 10 }} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip formatter={(v) => [money.fmt0(v), "Monthly savings"]} contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-hi)", borderRadius: 10 }} cursor={{ fill: "rgba(124,107,255,.08)" }} />
                  <Bar dataKey="savings" radius={[8, 8, 0, 0]}>
                    <Cell fill="#4FA8E8" />
                    <Cell fill={better ? "#2FD6A6" : "#FF6B7A"} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="box" style={{ marginTop: 12, color: "var(--text)" }}>
              <b style={{ fontSize: 14 }}>{result.title}</b>
              <p className="muted" style={{ marginTop: 6 }}>{result.summary}</p>
              {result.recommendation && (
                <p style={{ marginTop: 8, fontSize: 12.5 }}>
                  <b className="mint">Advice:</b> {result.recommendation}
                </p>
              )}
              <AINote data={result} />
            </div>
            <p className="faint" style={{ fontSize: 11, marginTop: 10 }}>
              Simulation only. Your real records are not changed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
