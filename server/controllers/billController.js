import Bill from "../models/Bill.js";
import Expense from "../models/Expense.js";
import RecurringTransaction from "../models/RecurringTransaction.js";
import { EXPENSE_CATEGORIES } from "../utils/constants.js";
import { checkBudgetThresholds } from "../services/notificationService.js";
import { revertBillPayment, nextDueDate, normalizeName } from "../services/billService.js";

const pick = (body) => {
  const allowed = ["name", "amount", "dueDate", "category", "reminderDays", "status", "repeat"];
  return Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
};

// A bill that an active recurring expense rule already records -> warn about double counting
const doubleCountWarning = async (userId, name) => {
  const key = normalizeName(name);
  if (!key) return null;
  const rules = await RecurringTransaction.find({ user: userId, active: true, type: "expense" }).select("title").lean();
  const rule = rules.find((r) => normalizeName(r.title) === key);
  return rule
    ? `You also have a recurring rule '${rule.title}' that records this automatically – keep only one to avoid double counting.`
    : null;
};

export const listBills = async (req, res) => {
  try {
    // Pending first (soonest due), then paid
    const records = await Bill.find({ user: req.user.userId }).sort({ status: -1, dueDate: 1 });
    return res.json({ success: true, data: { records } });
  } catch (error) {
    console.error("List bills error:", error);
    return res.status(500).json({ success: false, message: "Unable to load bills" });
  }
};

export const createBill = async (req, res) => {
  try {
    const data = pick(req.body);
    if (data.dueDate) data.anchorDay = new Date(data.dueDate).getDate();
    const record = await Bill.create({ ...data, user: req.user.userId });
    const warning = await doubleCountWarning(req.user.userId, record.name);
    return res.status(201).json({ success: true, message: "Bill added", data: { record, warning } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateBill = async (req, res) => {
  try {
    const data = pick(req.body);
    // A new due date also moves the anchor day of a repeating bill
    if (data.dueDate) data.anchorDay = new Date(data.dueDate).getDate();
    const record = await Bill.findOneAndUpdate({ _id: req.params.id, user: req.user.userId }, data, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!record) return res.status(404).json({ success: false, message: "Bill not found" });
    const warning = await doubleCountWarning(req.user.userId, record.name);
    return res.json({ success: true, message: "Bill updated", data: { record, warning } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /bills/:id/pay  { amount?, paidOn?, paymentMethod?, createExpense? }
// Marks the bill as paid, (by default) records the expense with the actual amount and date,
// and creates the next pending bill when the bill repeats.
export const payBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.userId });
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    if (bill.status === "paid") return res.status(400).json({ success: false, message: "Bill is already paid" });

    const paidAmount = Number(req.body.amount) > 0 ? Math.round(Number(req.body.amount) * 100) / 100 : bill.amount;
    const paidAt = req.body.paidOn ? new Date(req.body.paidOn) : new Date();

    bill.status = "paid";
    bill.paidAt = paidAt;
    bill.paidAmount = paidAmount;

    if (req.body.createExpense !== false) {
      const expense = await Expense.create({
        user: req.user.userId,
        title: bill.name,
        amount: paidAmount,
        category: EXPENSE_CATEGORIES.includes(bill.category) ? bill.category : "Bills & Utilities",
        paymentMethod: req.body.paymentMethod || "upi",
        date: paidAt,
        notes: "Bill payment",
        isRecurring: true,
      });
      bill.expense = expense._id;
      await checkBudgetThresholds(req.user.userId, paidAt);
    }

    // Repeating bill: the next one is created as pending, one period later
    let next = null;
    const dueDate = nextDueDate(bill);
    if (dueDate && !bill.nextBill) {
      next = await Bill.create({
        user: req.user.userId,
        name: bill.name,
        category: bill.category,
        amount: bill.amount,
        reminderDays: bill.reminderDays,
        repeat: bill.repeat,
        anchorDay: bill.anchorDay || new Date(bill.dueDate).getDate(),
        dueDate,
      });
      bill.nextBill = next._id;
    }

    await bill.save();
    const message = next
      ? `Bill paid. Next one added for ${dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`
      : "Bill marked as paid";
    return res.json({ success: true, message, data: { record: bill, nextBill: next } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /bills/:id/unpay - undo (removes the auto-created expense and the untouched next bill)
export const unpayBill = async (req, res) => {
  const bill = await Bill.findOne({ _id: req.params.id, user: req.user.userId });
  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
  await revertBillPayment(bill, req.user.userId, { deleteExpense: true });
  return res.json({ success: true, message: "Bill marked as unpaid", data: { record: bill } });
};

export const deleteBill = async (req, res) => {
  const record = await Bill.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!record) return res.status(404).json({ success: false, message: "Bill not found" });
  return res.json({ success: true, message: "Bill deleted" });
};
