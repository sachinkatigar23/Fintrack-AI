import SavingsGoal from "../models/SavingsGoal.js";
import { notify } from "../services/notificationService.js";

const pick = (body) => {
  const allowed = ["name", "targetAmount", "savedAmount", "targetDate", "color"];
  const data = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  if (data.targetDate === "") data.targetDate = null;
  return data;
};

const withStatus = (goal) => {
  goal.status = goal.savedAmount >= goal.targetAmount ? "completed" : "active";
  return goal;
};

const completedNotice = (goal) =>
  notify(goal.user, {
    type: "goal",
    title: `Goal reached: ${goal.name} 🎉`,
    message: `You saved ₹${goal.savedAmount.toLocaleString("en-IN")} and completed this goal.`,
    link: "/savings-goals",
    key: `goal:${goal._id}:completed`,
  });

export const listGoals = async (req, res) => {
  try {
    const records = await SavingsGoal.find({ user: req.user.userId }).sort({ status: 1, createdAt: -1 });
    return res.json({ success: true, data: { records } });
  } catch (error) {
    console.error("List goals error:", error);
    return res.status(500).json({ success: false, message: "Unable to load savings goals" });
  }
};

export const createGoal = async (req, res) => {
  try {
    const goal = withStatus(new SavingsGoal({ ...pick(req.body), user: req.user.userId }));
    await goal.save();
    if (goal.status === "completed") await completedNotice(goal);
    return res.status(201).json({ success: true, message: "Goal created", data: { record: goal } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateGoal = async (req, res) => {
  try {
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Savings goal not found" });
    Object.assign(goal, pick(req.body));
    withStatus(goal);
    await goal.save();
    if (goal.status === "completed") await completedNotice(goal);
    return res.json({ success: true, message: "Goal updated", data: { record: goal } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// POST /savings-goals/:id/contribute  { amount, note }
export const addContribution = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Contribution must be greater than 0" });
    }
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.userId });
    if (!goal) return res.status(404).json({ success: false, message: "Savings goal not found" });

    goal.savedAmount = Math.round((goal.savedAmount + amount) * 100) / 100;
    goal.contributions.push({ amount, note: String(req.body.note || "").slice(0, 120) });
    withStatus(goal);
    await goal.save();
    if (goal.status === "completed") await completedNotice(goal);

    return res.json({ success: true, message: "Contribution added", data: { record: goal } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteGoal = async (req, res) => {
  const record = await SavingsGoal.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!record) return res.status(404).json({ success: false, message: "Savings goal not found" });
  return res.json({ success: true, message: "Goal deleted" });
};
