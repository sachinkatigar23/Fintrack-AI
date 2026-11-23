// ─────────────────────────────────────────────────────────────
// Bill helpers: pure rules + thin DB wrappers.
// ─────────────────────────────────────────────────────────────
import Bill from "../models/Bill.js";
import Expense from "../models/Expense.js";
import { addPeriod } from "../utils/schedule.js";

// A record nobody has edited since it was created
export const isUnedited = (doc) =>
  Boolean(doc?.createdAt && doc?.updatedAt) && new Date(doc.updatedAt).getTime() === new Date(doc.createdAt).getTime();

// Same text after trimming, lower-casing and collapsing spaces ("Wi-Fi  (ACT) " == "wi-fi (act)")
export const normalizeName = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

const REPEAT_TO_FREQUENCY = { monthly: "monthly", quarterly: "quarterly", yearly: "yearly" };

// Due date of the bill after this one (null when the bill does not repeat)
export const nextDueDate = (bill) => {
  const frequency = REPEAT_TO_FREQUENCY[bill?.repeat];
  if (!frequency || !bill.dueDate) return null;
  return addPeriod(bill.dueDate, frequency, bill.anchorDay || new Date(bill.dueDate).getDate());
};

/**
 * Undo a bill payment: back to pending, paid fields cleared.
 * - deleteExpense: also remove the expense the payment created ("unpay")
 * - the automatically created next bill is removed only while it is still
 *   pending and nobody has edited it
 * Returns { removedNextBill }
 */
export const revertBillPayment = async (bill, userId, { deleteExpense = false } = {}) => {
  if (deleteExpense && bill.expense) await Expense.deleteOne({ _id: bill.expense, user: userId });

  let removedNextBill = false;
  if (bill.nextBill) {
    const next = await Bill.findOne({ _id: bill.nextBill, user: userId });
    if (next && next.status === "pending" && isUnedited(next)) {
      await next.deleteOne();
      removedNextBill = true;
    }
  }

  bill.status = "pending";
  bill.paidAt = undefined;
  bill.paidAmount = undefined;
  bill.expense = undefined;
  bill.nextBill = undefined;
  await bill.save();
  return { removedNextBill };
};

// Called after an expense is deleted: a bill paid with that expense becomes unpaid again
export const releaseBillForExpense = async (expenseId, userId) => {
  const bill = await Bill.findOne({ user: userId, expense: expenseId });
  if (!bill) return null;
  await revertBillPayment(bill, userId, { deleteExpense: false });
  return bill;
};
