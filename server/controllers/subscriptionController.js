import RecurringTransaction from "../models/RecurringTransaction.js";
import { getSubscriptions, setPref, nextFutureDate, merchantKey } from "../services/subscriptionService.js";
import { processRecurringTransactions } from "../services/recurringService.js";
import { EXPENSE_CATEGORIES } from "../utils/constants.js";

// GET /subscriptions -> { items (not dismissed), hidden (dismissed), totals }
export const listSubscriptions = async (req, res) => {
  try {
    const data = await getSubscriptions(req.user.userId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Subscriptions error:", error);
    return res.status(500).json({ success: false, message: "Unable to find subscriptions" });
  }
};

// POST /subscriptions/dismiss { key } - "Not a subscription"
export const dismissSubscription = async (req, res) => {
  try {
    await setPref(req.user.userId, req.body.key, { dismissed: true });
    return res.json({ success: true, message: "Hidden. You can restore it from the Hidden list." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /subscriptions/restore { key }
export const restoreSubscription = async (req, res) => {
  try {
    await setPref(req.user.userId, req.body.key, { dismissed: false });
    return res.json({ success: true, message: "Restored" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /subscriptions/remind { key, remind }
export const setReminder = async (req, res) => {
  try {
    await setPref(req.user.userId, req.body.key, { remind: Boolean(req.body.remind) });
    return res.json({ success: true, message: req.body.remind ? "Reminders on" : "Reminders off" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /subscriptions/track { key } - create a recurring rule from a detected subscription.
// From then on the charge is recorded automatically by the recurring rule.
export const trackSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { items, hidden } = await getSubscriptions(userId);
    const item = [...items, ...hidden].find((i) => i.key === req.body.key);
    if (!item) return res.status(404).json({ success: false, message: "Subscription not found" });

    const active = await RecurringTransaction.find({ user: userId, active: true }).select("title").lean();
    if (active.some((r) => merchantKey(r.title) === item.key)) {
      return res.status(409).json({ success: false, message: `A recurring rule for ${item.name} is already active.` });
    }

    const nextDate = nextFutureDate(item);
    const record = await RecurringTransaction.create({
      user: userId,
      title: item.name.slice(0, 100),
      amount: item.lastAmount,
      type: "expense",
      classification: EXPENSE_CATEGORIES.includes(item.category) ? item.category : "Other",
      frequency: item.frequency,
      nextDate,
      anchorDay: new Date(item.lastDate).getDate(),
      paymentMethod: item.paymentMethod,
    });
    // nextDate is always after today, so nothing is recorded now; this only keeps the processor in step
    if (record.nextDate <= new Date()) await processRecurringTransactions(userId);

    return res.status(201).json({
      success: true,
      message: `${item.name} is now tracked. It will be recorded automatically from ${nextDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`,
      data: { record },
    });
  } catch (error) {
    console.error("Track subscription error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};
