import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd, FUTURE_WARNING, describeDate, mergeAIItems } from "../services/quickAddParser.js";
import { EXPENSE_CATEGORIES, INCOME_SOURCES, PAYMENT_METHODS } from "../utils/constants.js";

// Wednesday 25 Nov 2026, afternoon
const TODAY = new Date(2026, 10, 25, 15, 0);
const TODAY_ISO = "2026-11-25";

const one = (text, today = TODAY) => {
  const { items } = parseQuickAdd(text, today);
  assert.equal(items.length, 1, `one item for "${text}"`);
  // every case: never a future date
  assert.ok(items[0].date <= TODAY_ISO, `"${text}" gave a future date ${items[0].date}`);
  return items[0];
};

const expectDate = (text, date, extra = {}) => {
  const i = one(text);
  assert.equal(i.date, date, `"${text}" date`);
  assert.equal(i.dateSource, "spoken", `"${text}" dateSource`);
  for (const [k, v] of Object.entries(extra)) assert.equal(i[k], v, `"${text}" ${k}`);
  return i;
};

test('"parso 300 auto" = 2 days ago', () => {
  expectDate("parso 300 auto", "2026-11-23", { amount: 300, category: "Transport", title: "Auto" });
  expectDate("parson 300 auto", "2026-11-23");
  expectDate("day before yesterday 300 auto", "2026-11-23");
});

test('"do din pehle 500 kirana" and other "N days ago" forms', () => {
  expectDate("do din pehle 500 kirana", "2026-11-23", { amount: 500, category: "Food & Dining" });
  expectDate("3 days ago 80 milk", "2026-11-22", { amount: 80 });
  expectDate("teen din pahle 90 chai", "2026-11-22", { amount: 90 });
  expectDate("४ दिन पहले ३०० पेट्रोल", "2026-11-21", { amount: 300, category: "Transport" });
});

test('"last monday 120 chai" = Monday of the previous week', () => {
  const i = expectDate("last monday 120 chai", "2026-11-16", { amount: 120, title: "Chai" });
  assert.ok(!/monday|last/i.test(i.title), "date words are removed from the title");
  expectDate("last sunday 300 pizza", "2026-11-22");
});

test("weekday names: the most recent one, today if it is that day", () => {
  expectDate("monday 60 chai", "2026-11-23");
  expectDate("somvar 60 chai", "2026-11-23");
  expectDate("सोमवार 40 चाय", "2026-11-23");
  expectDate("wednesday 100 bus", TODAY_ISO);
  expectDate("guruvar 200 movie", "2026-11-19");
  expectDate("itvaar 500 shoes", "2026-11-22");
});

test('"12 nov 999 myntra" and other day-month forms', () => {
  expectDate("12 nov 999 myntra", "2026-11-12", { amount: 999, category: "Shopping" });
  expectDate("nov 12 999 myntra", "2026-11-12");
  expectDate("12th november 999 myntra", "2026-11-12");
  expectDate("12/11 doctor 600", "2026-11-12", { amount: 600 });
  expectDate("12-11 doctor 600", "2026-11-12", { amount: 600 });
  expectDate("12/11/2026 doctor 600", "2026-11-12");
});

test("a day-month still ahead this year moves back one year", () => {
  expectDate("30 nov 2000 hotel", "2025-11-30");
  expectDate("15/12 movie 300", "2025-12-15");
});

test('"5 tarikh 2000 rent" and "on 5th": this month, or last month when still ahead', () => {
  expectDate("5 tarikh 2000 rent", "2026-11-05", { amount: 2000, category: "Rent & Housing" });
  expectDate("on 5th 2000 rent", "2026-11-05");
  expectDate("28 tarikh 400 bus", "2026-10-28");
  expectDate("on 28th 400 bus", "2026-10-28");
});

test('"कल दो सौ चाय" = yesterday, ₹200, Food & Dining', () => {
  const i = expectDate("कल दो सौ चाय", "2026-11-24", { amount: 200, category: "Food & Dining" });
  assert.equal(i.dateText, "yesterday (24 Nov)");
});

test("Devanagari number words and date words", () => {
  expectDate("परसों डेढ़ हज़ार किराया", "2026-11-23", { amount: 1500, category: "Rent & Housing" });
  expectDate("आज पाँच सौ बिजली", TODAY_ISO, { amount: 500, category: "Bills & Utilities" });
  expectDate("पिछले हफ्ते ढाई हजार कपड़े", "2026-11-18", { amount: 2500, category: "Shopping" });
  assert.equal(one("कल तीन सौ पचास दूध").amount, 350);
});

test("last week / pichle hafte = 7 days ago", () => {
  expectDate("last week 1500 shoes", "2026-11-18");
  expectDate("pichle hafte 1500 shoes", "2026-11-18");
});

test('"tomorrow 500 petrol" -> today with a warning', () => {
  const i = one("tomorrow 500 petrol");
  assert.equal(i.date, TODAY_ISO);
  assert.equal(i.dateSource, "default");
  assert.equal(i.warning, FUTURE_WARNING);
  assert.equal(i.amount, 500);
  assert.equal(i.title, "Petrol");
});

test('clearly future: "agle hafte", "kal ... dena hai", a future full date', () => {
  for (const text of ["agle hafte 2000 rent", "kal 500 dena hai bijli", "next monday 300 gym", "1/1/2027 trip 5000"]) {
    const i = one(text);
    assert.equal(i.date, TODAY_ISO, text);
    assert.equal(i.warning, FUTURE_WARNING, text);
  }
});

test("no date words -> today, dateSource default", () => {
  const i = one("250 petrol upi");
  assert.equal(i.date, TODAY_ISO);
  assert.equal(i.dateSource, "default");
  assert.equal(i.dateText, "today (25 Nov)");
  assert.equal(i.warning, undefined);
});

test("kal = yesterday, also right after midnight and at month start", () => {
  expectDate("kal 250 petrol", "2026-11-24", { dateText: "yesterday (24 Nov)" });
  const early = new Date(2026, 11, 1, 0, 5);
  const i = parseQuickAdd("kal 250 petrol", early).items[0];
  assert.equal(i.date, "2026-11-30");
});

test("describeDate", () => {
  assert.equal(describeDate(new Date(2026, 10, 25), TODAY), "today (25 Nov)");
  assert.equal(describeDate(new Date(2026, 10, 22), TODAY), "3 days ago (Sun, 22 Nov)");
  assert.equal(describeDate(new Date(2025, 11, 15), TODAY), "15 Dec 2025");
});

test("AI date: used only when the text had no date, and never a future one", () => {
  const opts = { today: TODAY, categories: EXPENSE_CATEGORIES, sources: INCOME_SOURCES, paymentMethods: PAYMENT_METHODS };
  const plain = parseQuickAdd("500 samaan", TODAY).items;
  assert.equal(mergeAIItems(plain, [{ date: "2026-11-20" }], opts).items[0].date, "2026-11-20");
  assert.equal(mergeAIItems(plain, [{ date: "2026-11-27" }], opts).items[0].date, TODAY_ISO);
  const spoken = parseQuickAdd("kal 500 samaan", TODAY).items;
  assert.equal(mergeAIItems(spoken, [{ date: "2026-11-20" }], opts).items[0].date, "2026-11-24");
});
