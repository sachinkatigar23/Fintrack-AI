import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Paperclip, Check } from "../common/icons.js";
import Modal from "../common/Modal.jsx";
import QuickAddBar from "./QuickAddBar.jsx";
import { expenseApi, incomeApi } from "../../services/financeApi.js";
import { EXPENSE_CATEGORIES, INCOME_SOURCES, PAYMENT_METHODS } from "../../utils/categories.js";
import { toInputDate } from "../../utils/format.js";
import { errorMessage, fileUrl } from "../../api/axios.js";

// Client-side validation (the server validates again)
const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title is too long"),
  amount: z.coerce.number({ invalid_type_error: "Enter a valid amount" }).positive("Amount must be greater than 0").max(100000000, "Amount is too large"),
  date: z
    .string()
    .min(1, "Date is required")
    .refine((v) => v <= toInputDate(), "Date can't be in the future. Use Bills or Recurring for upcoming payments."),
  classification: z.string().min(1, "Please choose one"),
  paymentMethod: z.string().min(1),
  notes: z.string().max(500, "Notes are too long").optional(),
});

const HINTS = ["e.g. Electricity bill", "e.g. Grocery shopping", "e.g. Auto rickshaw fare", "e.g. Movie tickets", "e.g. Coffee with friends"];

const blank = (type) => ({
  title: "",
  amount: "",
  date: toInputDate(),
  classification: type === "income" ? "Salary" : "Food & Dining",
  paymentMethod: type === "income" ? "bankTransfer" : "upi",
  notes: "",
});

/**
 * Add / edit an expense or income.
 * props: open, onClose, type ("expense"|"income"), lockType, record (when editing; without _id it pre-fills a new one),
 *        onSaved(record, type), autoVoice (start Quick add listening when opened)
 */
export default function TransactionForm({ open, onClose, type: initialType = "expense", lockType = false, record, onSaved, autoVoice = false }) {
  const [type, setType] = useState(initialType);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hint, setHint] = useState(0);
  const fileRef = useRef(null);
  const editing = Boolean(record?._id);
  // Quick add: items still waiting after the first one ("+N more"), and an item waiting for a type switch
  const [queue, setQueue] = useState([]);
  const pendingRef = useRef(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: blank(initialType) });

  // Fill the form whenever it opens
  useEffect(() => {
    if (!open) return;
    const t = record?.type || initialType;
    setType(t);
    setQueue([]);
    pendingRef.current = null;
    setReceiptUrl(record?.receiptUrl || "");
    reset(
      record
        ? {
            title: record.title,
            amount: String(record.amount),
            date: toInputDate(record.date),
            classification: t === "income" ? record.source : record.category,
            paymentMethod: record.paymentMethod || "upi",
            notes: record.notes || "",
          }
        : blank(t)
    );
  }, [open, record, initialType, reset]);

  // Rotating placeholder hints in the title box
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 2500);
    return () => clearInterval(t);
  }, [open]);

  const switchType = (t) => {
    if (lockType || editing) return;
    setType(t);
    setValue("classification", t === "income" ? "Salary" : "Food & Dining");
    setValue("paymentMethod", t === "income" ? "bankTransfer" : "upi");
  };

  // ───────── Quick add ─────────
  const fillFields = (item) => {
    const opts = { shouldValidate: true, shouldDirty: true };
    const filled = [];
    const income = item.type === "income";
    if (item.title) {
      setValue("title", String(item.title).slice(0, 100), opts);
      if (!item.missing?.includes("title")) filled.push("title");
    }
    if (Number(item.amount) > 0) {
      setValue("amount", String(item.amount), opts);
      filled.push(`amount ${item.amount}`);
    }
    const cls = income ? item.source : item.category;
    if (cls && (income ? INCOME_SOURCES : EXPENSE_CATEGORIES).includes(cls)) {
      setValue("classification", cls, opts);
      filled.push(cls);
    }
    if (PAYMENT_METHODS.some(([v]) => v === item.paymentMethod)) setValue("paymentMethod", item.paymentMethod, opts);
    // A future date is ignored: today stays
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(item.date || "")) && item.date <= toInputDate()) {
      setValue("date", item.date, opts);
      if (item.date !== toInputDate()) filled.push(item.date);
    }
    toast.success(`Filled: ${filled.join(", ") || "what we could"}${item.missing?.length ? " – please check the rest" : ""}`);
  };

  // After a type switch the category list changes; fill once the new options are rendered
  useEffect(() => {
    if (!open || !pendingRef.current) return;
    const item = pendingRef.current;
    pendingRef.current = null;
    fillFields(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, open]);

  const applyItem = (item) => {
    const t = item.type === "income" ? "income" : "expense";
    if (t !== type) {
      pendingRef.current = item;
      setType(t);
      setValue("classification", t === "income" ? "Salary" : "Food & Dining");
      setValue("paymentMethod", t === "income" ? "bankTransfer" : "upi");
      return;
    }
    fillFields(item);
  };

  const onQuickItems = (items) => {
    let list = items.filter((i) => i && (i.amount || i.title));
    if (!list.length) return toast("Couldn't find an amount – try “250 petrol”", { icon: "🤔" });
    if (lockType) {
      const other = list.filter((i) => i.type !== type);
      list = list.filter((i) => i.type === type);
      if (other.length) {
        toast(
          type === "expense"
            ? "This sounds like income – add it from the Income page"
            : "This sounds like an expense – add it from the Expenses page",
          { icon: "ℹ️" }
        );
      }
      if (!list.length) return;
    }
    const [first, ...rest] = list;
    applyItem(first);
    setQueue(rest);
  };

  const itemLabel = (i) => `${i.amount ? `₹${Number(i.amount).toLocaleString("en-IN")} ` : ""}${i.title}`;

  // Scan Receipt with AI: auto-fill title, amount, category (and date)
  const onScan = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Receipt must be 5 MB or smaller");

    setScanning(true);
    try {
      const res = await expenseApi.scanReceipt(file);
      const d = res.data || {};
      if (d.receiptUrl) setReceiptUrl(d.receiptUrl);
      const opts = { shouldValidate: true, shouldDirty: true };
      const filled = [];
      if (d.scanned) {
        const title = String(d.title ?? "").trim();
        const amount = Number(d.amount);
        if (title) {
          setValue("title", title.slice(0, 100), opts);
          filled.push("title");
        }
        if (Number.isFinite(amount) && amount > 0) {
          setValue("amount", String(amount), opts);
          filled.push("amount");
        }
        if (EXPENSE_CATEGORIES.includes(d.category)) {
          setValue("classification", d.category, opts);
          filled.push("category");
        }
        // A future date (misread receipt) is ignored: today stays
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(d.date ?? "")) && d.date <= toInputDate()) {
          setValue("date", d.date, opts);
          filled.push("date");
        }
      }
      if (filled.length) toast.success(`Filled: ${filled.join(", ")}. Please check the details.`);
      else toast(res.message || "Receipt attached. Please fill in the details.");
    } catch (err) {
      const d = err.response?.data?.data;
      if (d?.receiptUrl) setReceiptUrl(d.receiptUrl);
      toast.error(errorMessage(err, "Could not scan the receipt"));
    } finally {
      setScanning(false);
    }
  };

  const onSubmit = async (values) => {
    const payload = {
      title: values.title,
      amount: Number(values.amount),
      date: values.date,
      paymentMethod: values.paymentMethod,
      notes: values.notes || "",
      ...(type === "income" ? { source: values.classification } : { category: values.classification, receiptUrl }),
    };

    try {
      const apiFor = type === "income" ? incomeApi : expenseApi;
      const res = editing ? await apiFor.update(record._id, payload) : await apiFor.create(payload);
      const saved = res.expense || res.income;
      toast.success(`${type === "income" ? "Income" : "Expense"} ${editing ? "updated" : "added"}`);
      window.dispatchEvent(new Event("fintrack:data-changed"));
      onSaved?.(saved, type);

      // Quick add with several items: load the next one into a fresh form
      if (!editing && queue.length) {
        const [next, ...rest] = queue;
        const t = lockType ? type : next.type === "income" ? "income" : "expense";
        setReceiptUrl("");
        reset(blank(t));
        setQueue(rest);
        if (t !== type) {
          pendingRef.current = next;
          setType(t);
        } else {
          setTimeout(() => fillFields(next), 0);
        }
        return;
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save"));
    }
  };

  const options = type === "income" ? INCOME_SOURCES : EXPENSE_CATEGORIES;

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${type}` : null}>
      {!lockType && !editing && (
        <div className="chips" style={{ marginBottom: 16 }}>
          <button type="button" className={`chipf${type === "expense" ? " on" : ""}`} onClick={() => switchType("expense")}>
            Expense
          </button>
          <button type="button" className={`chipf${type === "income" ? " on" : ""}`} onClick={() => switchType("income")}>
            Income
          </button>
        </div>
      )}

      {!editing && (
        <>
          {/* no type chips when locked: leave room for the close button */}
          <div style={lockType ? { marginTop: 22 } : undefined}>
            <QuickAddBar autoVoice={autoVoice} onItems={onQuickItems} />
          </div>
          {queue.length > 0 && (
            <div className="qa-queue">
              <span className="tag iris">+{queue.length} MORE</span>
              {queue.map((i, n) => (
                <span key={n} className="chipf" title="Loads after you save this one">
                  {itemLabel(i)}
                </span>
              ))}
              <span className="faint" style={{ fontSize: 11 }}>next after saving</span>
            </div>
          )}
        </>
      )}

      {type === "expense" && (
        <div className="scanbox">
          <span className="sic">
            <Paperclip />
          </span>
          <div className="flex-1">
            <b>Scan Receipt with AI</b>
            <span>{receiptUrl ? "Receipt attached." : "Auto-fill title, amount, and category."}</span>
            {receiptUrl && (
              <a className="link" style={{ fontSize: 11, marginLeft: 6 }} href={fileUrl(receiptUrl)} target="_blank" rel="noreferrer">
                View
              </a>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onScan} />
          <button type="button" className="btn primary sm" disabled={scanning} onClick={() => fileRef.current?.click()}>
            {scanning ? <span className="spin" /> : receiptUrl ? <Check /> : null}
            {scanning ? "Scanning" : "Upload"}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-grid">
          <label className="field full">
            <span>Title</span>
            <input className={`input${errors.title ? " err" : ""}`} placeholder={HINTS[hint]} {...register("title")} />
            {errors.title && <small className="ferr">{errors.title.message}</small>}
          </label>

          <label className="field">
            <span>Amount</span>
            <input className={`input${errors.amount ? " err" : ""}`} type="number" step="0.01" min="0" placeholder="0.00" {...register("amount")} />
            {errors.amount && <small className="ferr">{errors.amount.message}</small>}
          </label>

          <label className="field">
            <span>Date</span>
            <input className={`input${errors.date ? " err" : ""}`} type="date" max={toInputDate()} {...register("date")} />
            {errors.date && <small className="ferr">{errors.date.message}</small>}
          </label>

          <label className="field">
            <span>{type === "income" ? "Source" : "Category"}</span>
            <select className="select" {...register("classification")}>
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Payment method</span>
            <select className="select" {...register("paymentMethod")}>
              {PAYMENT_METHODS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="field full">
            <span className="flabel">
              Notes<em>(optional)</em>
            </span>
            <textarea className="textarea" {...register("notes")} />
            {errors.notes && <small className="ferr">{errors.notes.message}</small>}
          </label>
        </div>

        <div className="modal-ft">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={isSubmitting || scanning}>
            {isSubmitting && <span className="spin" />}
            {editing ? "Save changes" : `Add ${type}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
