import mongoose from "mongoose";
import { EXPENSE_CATEGORIES } from "../utils/constants.js";

// A monthly spending limit. category "Overall" = limit for all spending in that month.
const budgetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0.01 },
    category: {
      type: String,
      default: "Overall",
      enum: ["Overall", ...EXPENSE_CATEGORIES],
    },
    // "YYYY-MM"
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  },
  { timestamps: true }
);

budgetSchema.index({ user: 1, month: 1 });

export default mongoose.model("Budget", budgetSchema);
