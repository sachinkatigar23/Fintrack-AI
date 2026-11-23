import mongoose from "mongoose";
import { RECURRING_FREQUENCIES, PAYMENT_METHODS } from "../utils/constants.js";

const recurringSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    amount: { type: Number, required: true, min: 0.01 },
    type: { type: String, enum: ["income", "expense"], required: true },
    // Expense category or income source
    classification: { type: String, required: true },
    frequency: { type: String, enum: RECURRING_FREQUENCIES, default: "monthly" },
    nextDate: { type: Date, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "upi" },
    active: { type: Boolean, default: true },
    lastRunAt: { type: Date },
    // Day of the month the schedule keeps (1-31). Older rules without it use the day of nextDate.
    anchorDay: { type: Number, min: 1, max: 31 },
    // Optional last date; after it the rule is finished (active=false, completedAt set)
    endDate: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

recurringSchema.index({ user: 1, nextDate: 1 });
recurringSchema.index({ active: 1, nextDate: 1 });

export default mongoose.model("RecurringTransaction", recurringSchema);
