import fs from "fs";
import Expense from "../models/Expense.js";
import { EXPENSE_CATEGORIES } from "../utils/constants.js";
import { checkBudgetThresholds } from "../services/notificationService.js";
import { generateJSON } from "../services/aiService.js";
import { storeFile } from "../services/storageService.js";
import { releaseBillForExpense } from "../services/billService.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Only these fields may be written by the client
const pick = (body) => {
  const allowed = ["title", "amount", "category", "paymentMethod", "date", "notes", "receiptUrl"];
  return Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
};

// GET /expenses?search=&category=&from=&to=&sort=date|amount&order=asc|desc
export const getExpenses = async (req, res) => {
  try {
    const { search, category, from, to, sort = "date", order = "desc" } = req.query;
    const filter = { user: req.user.userId };

    if (search?.trim()) filter.title = { $regex: escapeRegex(search.trim()), $options: "i" };
    if (category && category !== "all") filter.category = category;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(`${to}T23:59:59.999`);
    }

    const sortField = sort === "amount" ? "amount" : "date";
    const dir = order === "asc" ? 1 : -1;

    const expenses = await Expense.find(filter).sort({ [sortField]: dir, createdAt: -1 });
    return res.status(200).json({ success: true, data: { expenses } });
  } catch (error) {
    console.error("Get expenses error:", error);
    return res.status(500).json({ success: false, message: "Unable to load expenses" });
  }
};

export const createExpense = async (req, res) => {
  try {
    const expense = await Expense.create({ ...pick(req.body), user: req.user.userId });
    await checkBudgetThresholds(req.user.userId, expense.date);
    return res.status(201).json({ success: true, message: "Expense added", data: { expense } });
  } catch (error) {
    console.error("Create expense error:", error);
    return res.status(400).json({ success: false, message: error.message || "Unable to add expense" });
  }
};

export const updateExpense = async (req, res) => {
  try {
    // Ownership check: the record must belong to the logged-in user
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      pick(req.body),
      { returnDocument: "after", runValidators: true }
    );
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });
    await checkBudgetThresholds(req.user.userId, expense.date);
    return res.status(200).json({ success: true, message: "Expense updated", data: { expense } });
  } catch (error) {
    console.error("Update expense error:", error);
    return res.status(400).json({ success: false, message: error.message || "Unable to update expense" });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });
    // An expense created by paying a bill: that bill becomes unpaid again
    const bill = await releaseBillForExpense(expense._id, req.user.userId);
    return res.status(200).json({
      success: true,
      message: bill ? `Expense deleted. Bill '${bill.name}' is marked unpaid again.` : "Expense deleted",
      billReset: bill ? { id: bill._id, name: bill.name } : null,
    });
  } catch (error) {
    console.error("Delete expense error:", error);
    return res.status(500).json({ success: false, message: "Unable to delete expense" });
  }
};

// POST /expenses/:id/receipt  (multipart, field "receipt")
export const uploadReceipt = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Image or PDF receipt is required" });

  const receiptUrl = await storeFile(req.file, "receipts");
  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, user: req.user.userId },
    { receiptUrl },
    { returnDocument: "after" }
  );
  if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });
  return res.json({ success: true, message: "Receipt uploaded", data: { expense } });
};

// POST /expenses/scan-receipt  (multipart, field "receipt")
// Scan Receipt with AI: reads the image and auto-fills title, amount, category and date
export const scanReceipt = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Receipt image or PDF is required" });

  // Keep the file so it can be attached to the new expense
  const localPath = req.file.path;
  const mimeType = req.file.mimetype;
  const isPdf = mimeType === "application/pdf";

  // "₹1,234.50" / "Rs. 1234" / "INR 1,234" / 1234.5 -> 1234.5
  const cleanAmount = (value) => {
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : "";
    const s = String(value ?? "").replace(/₹|\bRs\.?|\bINR\b|,|\s/gi, "");
    const match = s.match(/\d+(?:\.\d+)?/);
    const n = match ? Number(match[0]) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : "";
  };

  // Only one of the allowed categories (case-insensitive match), otherwise "Other"
  const cleanCategory = (value) => {
    const v = String(value ?? "").trim().toLowerCase();
    if (!v) return "";
    return EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === v) || "Other";
  };

  // Only a real calendar date written as YYYY-MM-DD
  const cleanDate = (value) => {
    const v = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : "";
  };

  try {
    const result = await generateJSON(
      `Read this ${isPdf ? "PDF" : "image"} of a shop/restaurant bill, invoice or UPI/payment screenshot and extract:
1. "title": the merchant, shop or payee name (short)
2. "amount": the final amount actually paid (Grand Total / Net Total / amount paid), as a plain number without currency symbols or commas, e.g. 1234.5
3. "category": exactly one of ${JSON.stringify(EXPENSE_CATEGORIES)}
4. "date": the bill or payment date as YYYY-MM-DD, or "" if not visible (Indian dates are usually DD/MM/YYYY)
Use "" for any value you cannot read.
Return JSON: {"title": string, "amount": number, "category": string, "date": string}`,
      { today: new Date().toISOString().slice(0, 10) },
      { imagePath: localPath, mimeType },
      { timeoutMs: 60000, retries: 2, lenientJSON: true, useFallbackModel: true }
    );

    const receiptUrl = await storeFile(req.file, "receipts");
    const title = String(result?.title ?? "").trim().slice(0, 100);
    const amount = cleanAmount(result?.amount);
    const category = cleanCategory(result?.category);
    const date = cleanDate(result?.date);
    const scanned = Boolean(title || amount || date);

    return res.json({
      success: true,
      message: scanned
        ? "Receipt scanned"
        : "Receipt attached, but no details could be read from it. Please fill them in.",
      data: { title, amount, category: scanned ? category : "", date, receiptUrl, scanned },
    });
  } catch (error) {
    // AI not configured or failed: still attach the file so nothing is lost
    const receiptUrl = await storeFile(req.file, "receipts").catch(() => "");
    if (!receiptUrl && fs.existsSync(localPath)) fs.unlink(localPath, () => {});
    const disabled = error.code === "AI_DISABLED";
    if (!disabled) console.error("Receipt scan error:", error.message);

    const raw = `${error?.status || ""} ${error?.message || ""}`;
    let reason = "The AI could not read this receipt.";
    if (/\b(503|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(raw))
      reason = "The AI service is busy right now. Please try again in a minute.";
    else if (/timed out/i.test(raw)) reason = "The AI took too long to read this receipt.";
    else if (error instanceof SyntaxError) reason = "The AI reply could not be understood.";
    else if (/\b(400)\b|INVALID_ARGUMENT|unsupported/i.test(raw)) reason = "This file type could not be read by the AI.";

    return res.status(disabled ? 200 : 502).json({
      success: disabled,
      message: disabled
        ? "Receipt attached. AI scanning is off (no API key), please fill in the details."
        : `Receipt attached. ${reason} Please enter the details manually.`,
      data: { receiptUrl, scanned: false },
    });
  }
};
