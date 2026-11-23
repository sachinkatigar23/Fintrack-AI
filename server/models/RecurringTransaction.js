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
  },
  { timestamps: true }
);

recurringSchema.index({ user: 1, nextDate: 1 });
recurringSchema.index({ active: 1, nextDate: 1 });

export default mongoose.model("RecurringTransaction", recurringSchema);
