import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSubscriptions, merchantKey } from "../services/subscriptionService.js";

const TODAY = new Date(2026, 10, 23, 12, 0);
const on = (m, d, extra = {}) => ({ date: new Date(2026, m, d, 10), paymentMethod: "upi", ...extra });
const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

const netflix = [6, 7, 8, 9].map((m) => on(m, 10, { title: "Netflix", amount: 199, category: "Entertainment", paymentMethod: "card" }));
netflix.push(on(10, 10, { title: "NETFLIX payment #8812", amount: 249, category: "Entertainment", paymentMethod: "card" }));

test("merchantKey removes digits, punctuation and filler words", () => {
  assert.equal(merchantKey("UPI autopay to Netflix #2024!"), "netflix");
  assert.equal(merchantKey("Spotify Premium - monthly renewal"), "spotify premium");
  assert.equal(merchantKey("Payment 123"), "");
});

test("monthly subscription with a price change", () => {
  const { items, totals } = detectSubscriptions(netflix, TODAY, [], [], { avgMonthlyIncome: 50000 });
  assert.equal(items.length, 1);
  const n = items[0];
  assert.equal(n.key, "netflix");
  assert.equal(n.frequency, "monthly");
  assert.equal(n.confidence, "high");
  assert.equal(n.status, "detected");
  assert.equal(n.kind, "subscription");
  assert.equal(n.typical, 199);
  assert.equal(n.lastAmount, 249);
  assert.equal(n.occurrences, 5);
  assert.deepEqual({ from: n.priceChange.from, to: n.priceChange.to }, { from: 199, to: 249 });
  assert.equal(Math.round(n.priceChange.pct), 25);
  assert.deepEqual(ymd(n.nextExpected), [2026, 12, 10]);
  assert.equal(n.monthlyCost, 249);
  assert.equal(n.yearlyCost, 2988);
  assert.equal(totals.monthly, 249);
  assert.equal(totals.pctOfIncome, 0.5);
});

test("quarterly payment", () => {
  const gym = [2, 5, 8].map((m) => on(m, 4, { title: "Gym", amount: 2999, category: "Health" }));
  const { items } = detectSubscriptions(gym, TODAY);
  assert.equal(items.length, 1);
  assert.equal(items[0].frequency, "quarterly");
  assert.equal(items[0].kind, "regular payment");
  assert.equal(items[0].monthlyCost, 999.67);
  assert.deepEqual(ymd(items[0].nextExpected), [2026, 12, 4]);
});

test("irregular groceries are not a subscription", () => {
  const groceries = [1, 3, 9, 14, 20, 26, 31].map((d, i) =>
    on(9, d, { title: i % 2 ? "DMart groceries" : "dmart groceries", amount: 400 + d * 17, category: "Food & Dining" })
  );
  groceries.push(on(10, 2, { title: "DMart groceries", amount: 950, category: "Food & Dining" }));
  assert.equal(detectSubscriptions(groceries, TODAY).items.length, 0);
});

test("tracked when an active recurring rule has the same name", () => {
  const { items } = detectSubscriptions(netflix, TODAY, [{ title: "Netflix", active: true }]);
  assert.equal(items[0].status, "tracked");
  // a paused rule does not count
  assert.equal(detectSubscriptions(netflix, TODAY, [{ title: "Netflix", active: false }]).items[0].status, "detected");
});

test("missed when no charge came more than 10 days after the expected date", () => {
  const spotify = [7, 8].map((m) => on(m, 15, { title: "Spotify", amount: 119, category: "Entertainment" }));
  const { items, totals } = detectSubscriptions(spotify, TODAY);
  assert.equal(items[0].confidence, "medium");
  assert.equal(items[0].status, "missed");
  // probably cancelled -> not in the totals
  assert.equal(totals.monthly, 0);
});

test("dismissed items move to hidden; reminders follow the saved preference", () => {
  const { items, hidden } = detectSubscriptions(netflix, TODAY, [], [{ key: "netflix", dismissed: true, remind: false }]);
  assert.equal(items.length, 0);
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].remind, false);
});

test("records less than 5 days apart are merged into one payment", () => {
  const split = [
    on(8, 1, { title: "Wifi", amount: 400, category: "Bills & Utilities" }),
    on(8, 3, { title: "Wifi", amount: 399, category: "Bills & Utilities" }),
    on(9, 1, { title: "Wifi", amount: 799, category: "Bills & Utilities" }),
    on(10, 1, { title: "Wifi", amount: 799, category: "Bills & Utilities" }),
  ];
  const { items } = detectSubscriptions(split, TODAY);
  assert.equal(items.length, 1);
  assert.equal(items[0].occurrences, 3);
  assert.equal(items[0].typical, 799);
});
