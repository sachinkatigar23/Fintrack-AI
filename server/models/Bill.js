import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0.01 },
    dueDate: { type: Date, required: true },
    category: { type: String, default: "Bills & Utilities" },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    // Days before the due date when the reminder is sent
    reminderDays: { type: Number, default: 3, min: 0, max: 30 },
    // none = one-off bill; otherwise paying it creates the next pending bill
    repeat: { type: String, enum: ["none", "monthly", "quarterly", "yearly"], default: "none" },
    // Day of the month a repeating bill keeps (set from dueDate)
    anchorDay: { type: Number, min: 1, max: 31 },
    paidAt: { type: Date },
    // What was actually paid (can differ from the bill amount)
    paidAmount: { type: Number, min: 0 },
    // Expense created when the bill was marked as paid
    expense: { type: mongoose.Schema.Types.ObjectId, ref: "Expense" },
    // Next pending bill created automatically when a repeating bill was paid
    nextBill: { type: mongoose.Schema.Types.ObjectId, ref: "Bill" },
  },
  { timestamps: true }
);

billSchema.index({ user: 1, dueDate: 1 });

export default mongoose.model("Bill", billSchema);
