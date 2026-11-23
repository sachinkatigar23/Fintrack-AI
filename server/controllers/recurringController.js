import RecurringTransaction from "../models/RecurringTransaction.js";
import { processRecurringTransactions, recurringMonthlySummary, anchorOf } from "../services/recurringService.js";
import { startOfDay, endOfDay } from "../utils/dates.js";
import { addPeriod } from "../utils/schedule.js";

const fmtDay = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const pick = (body) => {
  const allowed = ["title", "amount", "type", "classification", "frequency", "nextDate", "endDate", "paymentMethod", "active"];
  const data = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  if (data.endDate === "") data.endDate = null;
  return data;
};

// endDate must not be before nextDate (compared by calendar day)
const endBeforeNext = (nextDate, endDate) =>
  Boolean(nextDate && endDate) && startOfDay(new Date(endDate)) < startOfDay(new Date(nextDate));

const END_MESSAGE = "End date can't be before the next date";

export const listRecurring = async (req, res) => {
  try {
    const records = await RecurringTransaction.find({ user: req.user.userId }).sort({ active: -1, nextDate: 1 });
    return res.json({ success: true, data: { records, summary: recurringMonthlySummary(records) } });
  } catch (error) {
    console.error("List recurring error:", error);
    return res.status(500).json({ success: false, message: "Unable to load recurring transactions" });
  }
};

export const createRecurring = async (req, res) => {
  try {
    const data = pick(req.body);
    if (endBeforeNext(data.nextDate, data.endDate)) return res.status(400).json({ success: false, message: END_MESSAGE });
    // The schedule keeps the day of the month of the first date (Jan 31 -> Feb 28 -> Mar 31)
    data.anchorDay = new Date(data.nextDate).getDate();

    const record = await RecurringTransaction.create({ ...data, user: req.user.userId });
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
    const record = await RecurringTransaction.findOne({ _id: req.params.id, user: req.user.userId });
    if (!record) return res.status(404).json({ success: false, message: "Recurring transaction not found" });

    const data = pick(req.body);
    const nextDate = data.nextDate ?? record.nextDate;
    const endDate = "endDate" in data ? data.endDate : record.endDate;
    if (endBeforeNext(nextDate, endDate)) return res.status(400).json({ success: false, message: END_MESSAGE });

    // A new next date also moves the anchor day
    if (data.nextDate) data.anchorDay = new Date(data.nextDate).getDate();
    // Resuming a finished rule clears its "completed" mark
    if (data.active === true) data.completedAt = null;

    Object.assign(record, data);
    await record.save();
    return res.json({ success: true, message: "Recurring transaction updated", data: { record } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /recurring-transactions/:id/skip - move nextDate one period forward without recording anything
export const skipRecurring = async (req, res) => {
  try {
    const record = await RecurringTransaction.findOne({ _id: req.params.id, user: req.user.userId });
    if (!record) return res.status(404).json({ success: false, message: "Recurring transaction not found" });
    if (!record.active) return res.status(400).json({ success: false, message: "Only active rules can be skipped" });

    const skipped = record.nextDate;
    if (!record.anchorDay) record.anchorDay = anchorOf(record);
    record.nextDate = addPeriod(record.nextDate, record.frequency, record.anchorDay);

    // Skipping past the end date finishes the rule
    let message = `Skipped ${fmtDay(skipped)}. Next run ${fmtDay(record.nextDate)}.`;
    if (record.endDate && record.nextDate > endOfDay(record.endDate)) {
      record.active = false;
      record.completedAt = new Date();
      message = `Skipped ${fmtDay(skipped)}. That was the last payment, so the rule has ended.`;
    }
    await record.save();
    return res.json({ success: true, message, data: { record } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteRecurring = async (req, res) => {
  const record = await RecurringTransaction.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!record) return res.status(404).json({ success: false, message: "Recurring transaction not found" });
  return res.json({ success: true, message: "Recurring transaction deleted" });
};
