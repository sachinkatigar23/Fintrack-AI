import { test } from "node:test";
import assert from "node:assert/strict";
import { addPeriod, occurrencesBetween, monthlyEquivalent } from "../utils/schedule.js";

const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

test("monthly from Jan 31 keeps the anchor day: Feb 28 then Mar 31", () => {
  const jan31 = new Date(2026, 0, 31);
  const feb = addPeriod(jan31, "monthly", 31);
  assert.deepEqual(ymd(feb), [2026, 2, 28]);
  assert.deepEqual(ymd(addPeriod(feb, "monthly", 31)), [2026, 3, 31]);
});

test("monthly in a leap year: Jan 31 -> Feb 29", () => {
  assert.deepEqual(ymd(addPeriod(new Date(2028, 0, 31), "monthly", 31)), [2028, 2, 29]);
});

test("yearly from Feb 29 goes to Feb 28 in a non-leap year", () => {
  assert.deepEqual(ymd(addPeriod(new Date(2024, 1, 29), "yearly", 29)), [2025, 2, 28]);
  // and back to Feb 29 four years later
  assert.deepEqual(ymd(addPeriod(new Date(2024, 1, 29), "yearly", 29, 4)), [2028, 2, 29]);
});

test("negative steps and other frequencies", () => {
  assert.deepEqual(ymd(addPeriod(new Date(2026, 2, 31), "monthly", 31, -1)), [2026, 2, 28]);
  assert.deepEqual(ymd(addPeriod(new Date(2026, 10, 30), "quarterly", 30)), [2027, 2, 28]);
  assert.deepEqual(ymd(addPeriod(new Date(2026, 10, 23), "weekly")), [2026, 11, 30]);
  assert.deepEqual(ymd(addPeriod(new Date(2026, 10, 30), "daily")), [2026, 12, 1]);
  // without an anchor the day of the date is used
  assert.deepEqual(ymd(addPeriod(new Date(2026, 0, 15), "monthly")), [2026, 2, 15]);
});

test("occurrencesBetween respects from <= d < to and the end date", () => {
  const all = occurrencesBetween(new Date(2026, 0, 31), "monthly", 31, new Date(2026, 0, 1), new Date(2027, 0, 1));
  assert.equal(all.length, 12);
  assert.deepEqual(ymd(all[1]), [2026, 2, 28]);

  const ended = occurrencesBetween(new Date(2026, 0, 31), "monthly", 31, new Date(2026, 0, 1), new Date(2026, 11, 31), new Date(2026, 3, 30));
  assert.deepEqual(ended.map(ymd), [
    [2026, 1, 31],
    [2026, 2, 28],
    [2026, 3, 31],
    [2026, 4, 30],
  ]);

  // "from" skips earlier dates; "to" is exclusive
  const window = occurrencesBetween(new Date(2026, 0, 1), "monthly", 1, new Date(2026, 2, 1), new Date(2026, 4, 1));
  assert.deepEqual(window.map(ymd), [
    [2026, 3, 1],
    [2026, 4, 1],
  ]);
});

test("occurrencesBetween has a hard cap of 400", () => {
  const many = occurrencesBetween(new Date(2020, 0, 1), "daily", 1, new Date(2020, 0, 1), new Date(2030, 0, 1));
  assert.equal(many.length, 400);
});

test("monthlyEquivalent", () => {
  assert.equal(monthlyEquivalent(100, "daily"), 3044);
  assert.equal(Math.round(monthlyEquivalent(120, "weekly") * 100) / 100, 520);
  assert.equal(monthlyEquivalent(500, "monthly"), 500);
  assert.equal(monthlyEquivalent(3000, "quarterly"), 1000);
  assert.equal(monthlyEquivalent(1200, "yearly"), 100);
});
