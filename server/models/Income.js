import mongoose from "mongoose";
import { INCOME_SOURCES, PAYMENT_METHODS } from "../utils/constants.js";

export { INCOME_SOURCES };
export const INCOME_PAYMENT_METHODS = PAYMENT_METHODS;

const incomeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    amount: { type: Number, required: true, min: 0.01 },
    source: { type: String, required: true, enum: INCOME_SOURCES },
    paymentMethod: { type: String, required: true, enum: PAYMENT_METHODS, default: "bankTransfer" },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    isRecurring: { type: Boolean, default: false },
  },
  { timestamps: true }
);

incomeSchema.index({ user: 1, date: -1 });

export default mongoose.model("Income", incomeSchema);
