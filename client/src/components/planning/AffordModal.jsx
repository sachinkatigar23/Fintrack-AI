import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Sparkles, Plus, PiggyBank } from "../common/icons.js";
import Modal from "../common/Modal.jsx";
import TransactionForm from "../transactions/TransactionForm.jsx";
import { planningApi, collectionApi } from "../../services/financeApi.js";
import { EXPENSE_CATEGORIES } from "../../utils/categories.js";
import { toInputDate, fmtDate } from "../../utils/format.js";
import { errorMessage } from "../../api/axios.js";

// Result box colour for each verdict
const TONE = { yes: "ok", yes_but: "info", skip_goal_savings: "warn", use_savings: "warn", no: "bad" };
const LABEL = {
  yes: "Yes",
  yes_but: "Yes, but…",
  skip_goal_savings: "Only if you skip goal savings",
  use_savings: "Only from your savings",
  no: "Not before payday",
};

const plusMonths = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d;
};

/**
 * "Can I afford this?" - asks the server for a verdict (nothing is saved),
 * then offers "Add as expense" or "Save for it".
 */
export default function AffordModal({ open, onClose, onChanged }) {
  const [form, setForm] = useState({ title: "", amount: "", category: "" });
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ title: "", amount: "", category: "" });
      setResult(null);
    }
  }, [open]);

  const check = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim()) return toast.error("What do you want to buy?");
    if (!amount || amount <= 0) return toast.error("Enter the price");
    setChecking(true);
    try {
      setResult(await planningApi.afford({ title: form.title.trim(), amount, category: form.category || undefined }));
    } catch (err) {
      toast.error(errorMessage(err, "Could not check this purchase"));
    } finally {
      setChecking(false);
    }
  };

  const saveForIt = async () => {
    setSaving(true);
    try {
      const targetDate = result?.suggestedDate ? new Date(result.suggestedDate) : plusMonths(3);
      // a goal date must be after today
      const safeDate = targetDate > new Date() ? targetDate : plusMonths(3);
      await collectionApi("/savings-goals").create({
        name: form.title.trim().slice(0, 80),
        targetAmount: Number(form.amount),
        savedAmount: 0,
        targetDate: toInputDate(safeDate),
      });
      toast.success(`Savings goal "${form.title.trim()}" created for ${fmtDate(safeDate)}`);
      window.dispatchEvent(new Event("fintrack:data-changed"));
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Could not create the goal"));
    } finally {
      setSaving(false);
    }
  };

  // Prefill for "Add as expense" (built once when it opens, so typing in the form isn't reset)
  const prefill = useMemo(
    () =>
      expenseOpen
        ? {
            type: "expense",
            title: form.title.trim(),
            amount: Number(form.amount),
            category: form.category || "Shopping",
            date: new Date(),
            paymentMethod: "upi",
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenseOpen]
  );

  const tone = result ? TONE[result.verdict] || "info" : "info";

  return (
    <>
      <Modal open={open && !expenseOpen} onClose={onClose} title="Can I afford this?" subtitle="Checks your safe-to-spend, bills and goals. Nothing is saved.">
        <form onSubmit={check}>
          <div className="form-grid">
            <label className="field full">
              <span>Item</span>
              <input
                className="input"
                autoFocus
                maxLength={100}
                placeholder="e.g. Running shoes"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Price</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 3500"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="flabel">
                Category<em>(optional)</em>
              </span>
              <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="">Any</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="modal-ft">
            <button type="submit" className="btn primary" disabled={checking}>
              {checking && <span className="spin" />} Check
            </button>
          </div>
        </form>

        {result && (
          <div className={`box ${tone}`} style={{ marginTop: 16 }}>
            <div className="bh">{LABEL[result.verdict] || "Result"}</div>
            <p style={{ fontWeight: 600, color: "var(--text)" }}>{result.headline}</p>
            {result.details?.map((d) => (
              <p key={d} className="muted" style={{ marginTop: 4 }}>
                {d}
              </p>
            ))}
            {result.warnings?.map((w) => (
              <p key={w} className="gold" style={{ marginTop: 6 }}>
                ⚠ {w}
              </p>
            ))}
            {result.tip && (
              <p className="muted" style={{ marginTop: 10, display: "flex", gap: 6 }}>
                <Sparkles style={{ width: 14, height: 14, flex: "none", marginTop: 3 }} />
                <span>{result.tip}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
              <button type="button" className="btn primary sm" onClick={() => setExpenseOpen(true)}>
                <Plus /> Add as expense
              </button>
              <button type="button" className="btn ghost sm" disabled={saving} onClick={saveForIt}>
                {saving ? <span className="spin" /> : <PiggyBank />} Save for it
              </button>
            </div>
          </div>
        )}
      </Modal>

      <TransactionForm
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        type="expense"
        lockType
        record={prefill}
        onSaved={() => {
          setExpenseOpen(false);
          onChanged?.();
          onClose();
        }}
      />
    </>
  );
}
