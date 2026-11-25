import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd, mergeAIItems, hasDevanagariLetters } from "../services/quickAddParser.js";
import { EXPENSE_CATEGORIES, INCOME_SOURCES, PAYMENT_METHODS } from "../utils/constants.js";

// Monday 23 Nov 2026
const TODAY = new Date(2026, 10, 23, 15, 0);
const one = (text) => {
  const { items } = parseQuickAdd(text, TODAY);
  assert.equal(items.length, 1, `one item for "${text}"`);
  return items[0];
};

test('"250 petrol kal upi"', () => {
  const i = one("250 petrol kal upi");
  assert.deepEqual(
    { type: i.type, title: i.title, amount: i.amount, category: i.category, paymentMethod: i.paymentMethod, date: i.date, confidence: i.confidence },
    { type: "expense", title: "Petrol", amount: 250, category: "Transport", paymentMethod: "upi", date: "2026-11-22", confidence: "high" }
  );
});

test('"do sau chai" = 200', () => {
  const i = one("do sau chai");
  assert.equal(i.amount, 200);
  assert.equal(i.category, "Food & Dining");
  assert.equal(i.title, "Chai");
});

test('"dedh hazaar ka recharge" = 1,500', () => {
  const i = one("dedh hazaar ka recharge");
  assert.equal(i.amount, 1500);
  assert.equal(i.category, "Bills & Utilities");
  assert.equal(i.title, "Recharge");
});

test('"dhai hazaar" = 2,500 and "dedh sau" = 150', () => {
  assert.equal(one("dhai hazaar kiraya").amount, 2500);
  assert.equal(one("dhai hazaar kiraya").category, "Rent & Housing");
  assert.equal(one("dedh sau nashta").amount, 150);
});

test('"salary 35000 mila" is income', () => {
  const i = one("salary 35000 mila");
  assert.equal(i.type, "income");
  assert.equal(i.source, "Salary");
  assert.equal(i.amount, 35000);
  assert.equal(i.paymentMethod, "bankTransfer");
  assert.equal(i.confidence, "high");
});

test('"1.5k myntra card"', () => {
  const i = one("1.5k myntra card");
  assert.equal(i.amount, 1500);
  assert.equal(i.category, "Shopping");
  assert.equal(i.paymentMethod, "card");
  assert.equal(i.title, "Myntra");
});

test('"300 ka khana aur 120 auto" gives two items', () => {
  const { items } = parseQuickAdd("300 ka khana aur 120 auto", TODAY);
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((i) => [i.title, i.amount, i.category]),
    [
      ["Khana", 300, "Food & Dining"],
      ["Auto", 120, "Transport"],
    ]
  );
});

test("Devanagari digits", () => {
  const i = one("५०० का सामान");
  assert.equal(i.amount, 500);
  assert.equal(i.confidence, "medium");
  assert.ok(i.missing.includes("category"));
  assert.ok(hasDevanagariLetters("५०० का सामान"));
  assert.ok(!hasDevanagariLetters("५००"));
});

test("currency words, commas and lakh", () => {
  assert.equal(one("Rs. 1,250 swiggy").amount, 1250);
  assert.equal(one("₹2,499 amazon order").amount, 2499);
  assert.equal(one("2 lakh salary credited").amount, 200000);
  assert.equal(one("paanch sau rupaye petrol").amount, 500);
});

test("payment words", () => {
  assert.equal(one("1200 light bill via gpay").paymentMethod, "upi");
  assert.equal(one("1200 light bill via gpay").category, "Bills & Utilities");
  assert.equal(one("80 chai nakad").paymentMethod, "cash");
  assert.equal(one("5000 rent neft").paymentMethod, "bankTransfer");
  assert.equal(one("999 shoes debit").paymentMethod, "card");
});

test("dates: parso, weekday, last weekday, 12 nov, 12/11, 12th", () => {
  assert.equal(one("1,250 swiggy parso").date, "2026-11-21");
  assert.equal(one("350 movie friday").date, "2026-11-20");
  assert.equal(one("coffee 120 last monday").date, "2026-11-16");
  assert.equal(one("499 udemy course on 12 nov").date, "2026-11-12");
  assert.equal(one("12/11 doctor 600").date, "2026-11-12");
  assert.equal(one("petrol 500 on 12th").date, "2026-11-12");
  assert.equal(one("pizza 450 day before yesterday").date, "2026-11-21");
  assert.equal(one("aaj 60 chai").date, "2026-11-23");
});

test("never returns a future date", () => {
  // these would be in the future this year -> last year / last month
  assert.equal(one("15/12 movie 300").date, "2025-12-15");
  assert.equal(one("hotel 2000 on 5 dec").date, "2025-12-05");
  assert.equal(one("petrol 500 on 25th").date, "2026-10-25");
  for (const text of ["kal 200 auto", "tomorrow 300 pizza", "500 metro", "31/12 trip 4000", "sunday 90 milk"]) {
    assert.ok(one(text).date <= "2026-11-23", `${text} -> ${one(text).date}`);
  }
});

test("income cues and sources", () => {
  assert.equal(one("rent received 8000").source, "Rental");
  assert.equal(one("kiraya mila 8000").source, "Rental");
  assert.equal(one("gift 2000 shagun mila").source, "Gift");
  assert.equal(one("freelance project 12000 credited").source, "Freelance");
  assert.equal(one("cashback 50").type, "income");
});

test("title from leftover words, and fallbacks", () => {
  const i = one("paid 350 for haircut");
  assert.equal(i.title, "Haircut");
  assert.equal(i.confidence, "medium");
  const q = one("350 friday cash");
  assert.equal(q.title, "Quick expense");
  assert.ok(q.missing.includes("title"));
  const low = one("kuch nahi");
  assert.equal(low.confidence, "low");
  assert.ok(low.missing.includes("amount"));
});

test("AI fills only the fields the rules missed, never a future date", () => {
  const { items } = parseQuickAdd("५०० का सामान", TODAY);
  const merged = mergeAIItems(
    items,
    [{ type: "expense", title: "Milk", amount: 9999, category: "food & dining", date: "2026-12-01" }],
    { today: TODAY, categories: EXPENSE_CATEGORIES, sources: INCOME_SOURCES, paymentMethods: PAYMENT_METHODS }
  );
  const m = merged.items[0];
  assert.equal(m.amount, 500); // rules already had it
  assert.equal(m.category, "Food & Dining"); // filled by AI
  assert.equal(m.date, "2026-11-23"); // future AI date ignored
  assert.equal(m.confidence, "high");
  assert.equal(merged.filled, 1);
});
