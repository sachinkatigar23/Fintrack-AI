import Expense from "../models/Expense.js";
import Income from "../models/Income.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toTransaction = (record, type) => ({
  ...record.toObject(),
  type,
  classification: type === "expense" ? record.category : record.source,
});

// Shared by the list and the CSV export: one combined, filtered, sorted ledger
const loadLedger = async (req) => {
  const type = ["income", "expense"].includes(req.query.type) ? req.query.type : "all";
  const search = req.query.search?.trim();
  const classification = req.query.classification?.trim();
  const sortBy = ["date", "amount", "title"].includes(req.query.sortBy) ? req.query.sortBy : "date";
  const order = req.query.order === "asc" ? 1 : -1;

  const base = { user: req.user.userId };
  if (search) base.title = { $regex: escapeRegex(search), $options: "i" };
  if (req.query.from || req.query.to) {
    base.date = {};
    if (req.query.from) base.date.$gte = new Date(req.query.from);
    if (req.query.to) base.date.$lte = new Date(`${req.query.to}T23:59:59.999`);
  }
  const useClass = classification && classification !== "all";

  const [expenseRecords, incomeRecords] = await Promise.all([
    type === "income" ? [] : Expense.find({ ...base, ...(useClass ? { category: classification } : {}) }),
    type === "expense" ? [] : Income.find({ ...base, ...(useClass ? { source: classification } : {}) }),
  ]);

  const transactions = [
    ...expenseRecords.map((expense) => toTransaction(expense, "expense")),
    ...incomeRecords.map((income) => toTransaction(income, "income")),
  ];

  transactions.sort((a, b) => {
    if (sortBy === "title") return order * a.title.localeCompare(b.title);
    if (sortBy === "amount") return order * (a.amount - b.amount);
    return order * (new Date(a.date) - new Date(b.date)) || order * (new Date(a.createdAt) - new Date(b.createdAt));
  });

  return transactions;
};

// GET /transactions?type=&search=&classification=&sortBy=&order=&page=&limit=&from=&to=
export const getTransactions = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);

    const transactions = await loadLedger(req);

    // Totals for the current filter (shown as IN / OUT on the page)
    const totals = transactions.reduce(
      (acc, t) => {
        if (t.type === "income") acc.in += t.amount;
        else acc.out += t.amount;
        return acc;
      },
      { in: 0, out: 0 }
    );

    const total = transactions.length;
    const start = (page - 1) * limit;

    return res.status(200).json({
      success: true,
      data: {
        transactions: transactions.slice(start, start + limit),
        totals: { in: Math.round(totals.in * 100) / 100, out: Math.round(totals.out * 100) / 100 },
        pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return res.status(500).json({ success: false, message: "Unable to load transactions" });
  }
};

// GET /transactions/export  -> CSV file (opens in Excel / Google Sheets)
export const exportTransactions = async (req, res) => {
  try {
    const transactions = await loadLedger(req);
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const header = ["Date", "Type", "Title", "Category/Source", "Payment method", "Amount", "Notes"];
    const lines = transactions.map((t) =>
      [
        new Date(t.date).toISOString().slice(0, 10),
        t.type,
        t.title,
        t.classification,
        t.paymentMethod,
        (t.type === "expense" ? -t.amount : t.amount).toFixed(2),
        t.notes || "",
      ]
        .map(esc)
        .join(",")
    );

    const csv = "﻿" + [header.map(esc).join(","), ...lines].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fintrack-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error("Export transactions error:", error);
    return res.status(500).json({ success: false, message: "Unable to export transactions" });
  }
};
