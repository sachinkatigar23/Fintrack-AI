import RecurringTransaction from "../models/RecurringTransaction.js";
import { processRecurringTransactions } from "../services/recurringService.js";

const pick = (body) => {
  const allowed = ["title", "amount", "type", "classification", "frequency", "nextDate", "paymentMethod", "active"];
  return Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
};

export const listRecurring = async (req, res) => {
  try {
    const records = await RecurringTransaction.find({ user: req.user.userId }).sort({ active: -1, nextDate: 1 });
    return res.json({ success: true, data: { records } });
  } catch (error) {
    console.error("List recurring error:", error);
    return res.status(500).json({ success: false, message: "Unable to load recurring transactions" });
  }
};

export const createRecurring = async (req, res) => {
  try {
    const record = await RecurringTransaction.create({ ...pick(req.body), user: req.user.userId });
    // If the first run date is today or earlier, process it right away
    if (record.active && record.nextDate <= new Date()) {
      await processRecurringTransactions(req.user.userId);
    }
    const fresh = await RecurringTransaction.findById(record._id);
    return res.status(201).json({ success: true, message: "Recurring transaction created", data: { record: fresh } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateRecurring = async (req, res) => {
  try {
    const record = await RecurringTransaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      pick(req.body),
      { returnDocument: "after", runValidators: true }
    );
    if (!record) return res.status(404).json({ success: false, message: "Recurring transaction not found" });
    return res.json({ success: true, message: "Recurring transaction updated", data: { record } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteRecurring = async (req, res) => {
  const record = await RecurringTransaction.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!record) return res.status(404).json({ success: false, message: "Recurring transaction not found" });
  return res.json({ success: true, message: "Recurring transaction deleted" });
};
