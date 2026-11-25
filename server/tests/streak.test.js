import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak, dayKey, MILESTONES } from "../services/streakService.js";

// Wednesday 25 Nov 2026, evening
const TODAY = new Date(2026, 10, 25, 20, 0);
// "YYYY-MM-DD" for n days before TODAY
const ago = (n) => dayKey(new Date(2026, 10, 25 - n));
const run = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ago(from + i));

test("new: never logged", () => {
  const s = computeStreak([], TODAY);
  assert.equal(s.status, "new");
  assert.equal(s.current, 0);
  assert.equal(s.best, 0);
  assert.equal(s.loggedToday, false);
  assert.equal(s.nextMilestone, 3);
  assert.equal(s.daysToNext, 3);
});

test("active: today logged, counts back from today", () => {
  const s = computeStreak(run(0, 4), TODAY);
  assert.equal(s.status, "active");
  assert.equal(s.loggedToday, true);
  assert.equal(s.current, 5);
  assert.equal(s.runStart, ago(4));
});

test("at_risk: yesterday logged, today not yet - the streak still counts", () => {
  const s = computeStreak(run(1, 6), TODAY);
  assert.equal(s.status, "at_risk");
  assert.equal(s.loggedToday, false);
  assert.equal(s.current, 6);
});

test("broken: last logged day before yesterday -> current 0", () => {
  const s = computeStreak(run(2, 9), TODAY);
  assert.equal(s.status, "broken");
  assert.equal(s.current, 0);
  assert.equal(s.best, 8);
});

test("best: the longest run in the last 365 days", () => {
  const days = [...run(0, 2), ...run(10, 21), ...run(400, 430)];
  const s = computeStreak(days, TODAY);
  assert.equal(s.current, 3);
  // 12 in a row (10..21); the 31-day run is older than 365 days
  assert.equal(s.best, 12);
});

test("days are counted once and future days are ignored", () => {
  const s = computeStreak([ago(0), ago(0), ago(1), dayKey(new Date(2026, 10, 26))], TODAY);
  assert.equal(s.current, 2);
  assert.equal(s.last7.filter((d) => d.logged).length, 2);
});

test("milestone maths", () => {
  assert.deepEqual(MILESTONES, [3, 7, 14, 30, 60, 100]);
  let s = computeStreak(run(0, 4), TODAY);
  assert.equal(s.nextMilestone, 7);
  assert.equal(s.daysToNext, 2);
  assert.equal(s.milestoneReached, null);

  s = computeStreak(run(0, 6), TODAY);
  assert.equal(s.milestoneReached, 7);
  assert.equal(s.nextMilestone, 14);
  assert.equal(s.daysToNext, 7);

  // reached only when today is logged (an at-risk 7 is not a new badge)
  assert.equal(computeStreak(run(1, 7), TODAY).milestoneReached, null);
  // past the last milestone
  s = computeStreak(run(0, 119), TODAY);
  assert.equal(s.nextMilestone, null);
  assert.equal(s.daysToNext, 0);
});

test("last7: weekday initials, logged flags and today", () => {
  const s = computeStreak([ago(0), ago(2)], TODAY);
  assert.equal(s.last7.length, 7);
  assert.deepEqual(
    s.last7.map((d) => d.label),
    ["T", "F", "S", "S", "M", "T", "W"]
  );
  assert.deepEqual(
    s.last7.map((d) => d.logged),
    [false, false, false, false, true, false, true]
  );
  assert.equal(s.last7[6].isToday, true);
  assert.equal(s.last7[6].date, "2026-11-25");
  assert.equal(s.last7.filter((d) => d.isToday).length, 1);
});

test("records created by the scheduler don't count", async () => {
  const { loggedDaysFrom, isUserLogged } = await import("../services/streakService.js");
  const at = (n, extra = {}) => ({ createdAt: new Date(2026, 10, 25 - n, 10), ...extra });
  const records = [
    at(0, { createdBy: "user" }),
    at(1, { createdBy: "system", notes: "Added automatically by a recurring rule" }),
    at(2, { notes: "Added automatically by a recurring rule" }), // older record without createdBy
    at(3), // older manual record without createdBy
    at(3, { createdBy: "user", notes: "Bill payment" }), // paying a bill counts
  ];
  assert.equal(isUserLogged(records[1]), false);
  assert.equal(isUserLogged(records[2]), false);
  assert.equal(isUserLogged(records[3]), true);
  const days = loggedDaysFrom(records);
  assert.deepEqual(days.sort(), [ago(3), ago(0)].sort());
  // yesterday was only a recurring record -> no streak carries over
  const s = computeStreak(days, TODAY);
  assert.equal(s.current, 1);
  assert.equal(s.status, "active");
});
