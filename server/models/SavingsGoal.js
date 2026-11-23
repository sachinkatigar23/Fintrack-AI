import mongoose from "mongoose";

const contributionSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    // The amount is always positive; withdrawals are marked by type
    type: { type: String, enum: ["deposit", "withdrawal"], default: "deposit" },
    date: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 120, default: "" },
  },
  { _id: false }
);

const savingsGoalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    targetAmount: { type: Number, required: true, min: 0.01 },
    savedAmount: { type: Number, default: 0, min: 0 },
    targetDate: { type: Date },
    color: { type: String, default: "mint" },
    // archived = the money was used ("I bought the laptop"); not reserved, not planned
    status: { type: String, enum: ["active", "completed", "archived"], default: "active" },
    archivedAt: { type: Date },
    // Expense recorded when the goal was used (optional)
    usedExpense: { type: mongoose.Schema.Types.ObjectId, ref: "Expense" },
    contributions: { type: [contributionSchema], default: [] },
  },
  { timestamps: true }
);

savingsGoalSchema.index({ user: 1, targetDate: 1 });

export default mongoose.model("SavingsGoal", savingsGoalSchema);
