import Bill from "../models/Bill.js";
import Expense from "../models/Expense.js";
import { EXPENSE_CATEGORIES } from "../utils/constants.js";
import { checkBudgetThresholds } from "../services/notificationService.js";

const pick = (body) => {
  const allowed = ["name", "amount", "dueDate", "category", "reminderDays", "status"];
  return Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
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
    const record = await Bill.create({ ...pick(req.body), user: req.user.userId });
    return res.status(201).json({ success: true, message: "Bill added", data: { record } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateBill = async (req, res) => {
  try {
    const record = await Bill.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      pick(req.body),
      { returnDocument: "after", runValidators: true }
    );
    if (!record) return res.status(404).json({ success: false, message: "Bill not found" });
    return res.json({ success: true, message: "Bill updated", data: { record } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /bills/:id/pay  { createExpense?: boolean, paymentMethod? }
// Marks the bill as paid and (by default) records the matching expense
export const payBill = async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.userId });
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    if (bill.status === "paid") return res.status(400).json({ success: false, message: "Bill is already paid" });

    bill.status = "paid";
    bill.paidAt = new Date();

    if (req.body.createExpense !== false) {
      const expense = await Expense.create({
        user: req.user.userId,
        title: bill.name,
        amount: bill.amount,
        category: EXPENSE_CATEGORIES.includes(bill.category) ? bill.category : "Bills & Utilities",
        paymentMethod: req.body.paymentMethod || "upi",
        date: new Date(),
        notes: "Bill payment",
        isRecurring: true,
      });
      bill.expense = expense._id;
      await checkBudgetThresholds(req.user.userId);
    }

    await bill.save();
    return res.json({ success: true, message: "Bill marked as paid", data: { record: bill } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /bills/:id/unpay - undo (removes the auto-created expense)
export const unpayBill = async (req, res) => {
  const bill = await Bill.findOne({ _id: req.params.id, user: req.user.userId });
  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
  if (bill.expense) await Expense.deleteOne({ _id: bill.expense, user: req.user.userId });
  bill.status = "pending";
  bill.paidAt = undefined;
  bill.expense = undefined;
  await bill.save();
  return res.json({ success: true, message: "Bill marked as unpaid", data: { record: bill } });
};

export const deleteBill = async (req, res) => {
  const record = await Bill.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!record) return res.status(404).json({ success: false, message: "Bill not found" });
  return res.json({ success: true, message: "Bill deleted" });
};
