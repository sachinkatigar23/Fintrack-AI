# FinTrack AI – Upgrade v2 (implementation spec)

This document is the single source of truth for the upgrade. Implement **every part, in order**.
Where this spec is silent, choose the simplest option that matches the existing code and list that decision in the final report.

---

## 0. Rules for the implementer (read first)

1. **Safety first**
   - Run `git status`. If there are uncommitted changes, commit them as `Before upgrade v2`.
   - Create and switch to branch `feature/upgrade-v2`.
   - Commit after each Part (`Upgrade v2 – Part N: <name>`). If you get interrupted, continue from the next unfinished Part.
2. **Study the current code before editing.** Some files were modified after the original build (for example `server/services/aiService.js`, `scanReceipt()` in `expenseController.js`, `onScan()` in `TransactionForm.jsx`, and `server/services/recurringService.js`). Keep those fixes working.
3. **Backward compatible.** The database already holds real data, so every new field must be optional or have a default. Never delete or rewrite existing user data, except through the user actions described here.
4. **No new npm packages.**
   - Voice uses the browser's built-in Web Speech API.
   - Tests use Node's built-in `node:test`.
5. **Architecture rules:**
   - Every money calculation lives in `server/services/*` as **pure functions** (input → output, no DB) plus thin DB-loading wrappers.
   - Controllers only load data, call services and send responses.
   - AI is only used to *explain* numbers or to *parse* free text, always through `server/services/aiService.js` (`explainOrFallback`, or `generateJSON` with the options added in the receipt fix: `timeoutMs`, `retries`, `lenientJSON`, `useFallbackModel`). Every AI path needs a rule-based fallback.
   - Every new route sits under `/api/v1` and uses `protect` and express-validator. Every query is scoped to `req.user.userId`.
6. **UI rules:**
   - Use the existing design system: `theme.css` classes (`card`, `stat`, `bcard`, `prog`, `tag`, `box ok/warn/bad/info`, `chipf`, `btn primary/ghost/danger/sm`, `select`, `input`, `field`, `form-grid`, `lbl-mono`, `big-mono`, `section-title`) and the existing components (`PageHeader`, `CollectionPage`, `Modal`, `EmptyState`, `Skeleton`, `Ring`, `TxnRow`, `TransactionForm`).
   - Add new icons only in `client/src/components/common/icons.js`, using `pick()` with fallbacks.
   - Money is formatted with `useMoney()`.
   - Both dark and light themes must look right.
   - After any change to data, fire `window.dispatchEvent(new Event("fintrack:data-changed"))`.
7. **Dates:**
   - Use `server/utils/dates.js`. Day boundaries are local time (Asia/Kolkata).
   - "Today" means start of today to end of today.
8. **Testing data.** You may run `npm run seed`; it only resets the two demo accounts. Never print `.env` contents or keys.
9. **The finished app must start with no errors**, and all existing features must still work (see the Part 7 regression list).

---

## Part 1 – Foundations and logic fixes

### 1.1 Shared schedule helper: `server/utils/schedule.js` (pure)
- `addPeriod(date, frequency, anchorDay, steps = 1)`:
  - Frequencies: `daily | weekly | monthly | quarterly | yearly`; `steps` may be negative.
  - For monthly, quarterly and yearly, the day of month is `min(anchorDay, daysInTargetMonth)`. This fixes the JavaScript overflow bug: Jan 31 → Feb 28 → Mar 31, not Mar 3.
  - Yearly from Feb 29 goes to Feb 28 in non-leap years.
- `occurrencesBetween(startDate, frequency, anchorDay, from, to, endDate?)` returns every occurrence `d` with `from <= d < to`, starting from `startDate`. Respect `endDate`, with a hard cap of 400.
- `monthlyEquivalent(amount, frequency)`:
  - daily × 30.44
  - weekly × 52/12
  - monthly × 1
  - quarterly ÷ 3
  - yearly ÷ 12
- Replace `nextOccurrence()` in `recurringService.js` with `addPeriod()`. Keep the classification-fallback fix (invalid category → "Other" with a note).

### 1.2 RecurringTransaction model: add `anchorDay`, `endDate`, `completedAt`
- **`anchorDay`** (1–31):
  - Set from `nextDate` on create, and whenever `nextDate` is edited.
  - Existing rules without it use the day of their current `nextDate`.
- **`endDate`** (optional):
  - When the next occurrence would fall after `endDate`, the processor sets `active=false` and `completedAt=now`, and stops.
  - Send one notification: "<title> has finished (last payment on …)".
- Validation: `endDate >= nextDate`.

### 1.3 Profile "Money settings" (User model + Profile page)
- New User fields:
  - `openingBalance` (Number, default 0): money you already had when you started using FinTrack.
  - `salaryDay` (1–31, default 1): used when there is no recurring income rule.
  - `safetyBuffer` (Number ≥ 0, default 0): an amount never counted as spendable.
- `PUT /profile` accepts and validates these fields.
- New "Money settings" card on the Profile page, with short helper text for each field.
- Currency select: add helper text "Only the symbol changes – amounts are not converted." Pass the user's currency code into the AI system rules instead of hard-coding INR.

### 1.4 Balance definition (one formula everywhere)
- **Available balance = openingBalance + all income − all expenses.**
- Use it in `dashboardController`, `analyticsController` and the AI context.
- Dashboard balance card footer: when goals hold money, show "₹X reserved in goals".

### 1.5 No future-dated income or expenses
- Server validators (create and update) reject a `date` later than the end of today with: "Date can't be in the future. Use Bills or Recurring for upcoming payments."
- Client:
  - The date input `max` is today.
  - A future date from the receipt scan or voice parse is ignored (today is used instead).

### 1.6 Deleting an expense created by paying a bill
- When an expense is deleted and a Bill has `expense = <that id>`, set that bill back to `pending` and unset `paidAt`, `paidAmount` and `expense`.
- If that bill auto-created a `nextBill` that is still pending and unedited, delete it too (same rule as "unpay" in 2.3).
- The response message says: "Bill '<name>' is marked unpaid again."

### 1.7 Small corrections
- `CollectionPage` empty-state button: "Create your first budget" (singular), not "budgets". Use the `singular` prop.
- Notification types: add `subscription` and `planning` to `NOTIFICATION_TYPES` and to the icon/colour map in `NotificationBell.jsx`.
- Sidebar: when the items don't fit the window, the list scrolls, while the streak card and Log out stay visible.

---

## Part 2 – Planning section upgrades

### 2.1 Budgets
- **a) Pace and projection** (current month only; computed in `analyticsService.getBudgetPerformance` and returned per item):
  - `daysElapsed` = today's day of month; `daysInMonth`; `elapsedPct = daysElapsed / daysInMonth × 100`.
  - `projectedSpend = spent / daysElapsed × daysInMonth`.
  - `paceStatus = "over_pace"` when `usedPct > elapsedPct + 10` and `spent > 0`; otherwise `"on_pace"`.
  - `dailyLeft = max(0, remaining) / daysLeftIncludingToday`.
  - Card shows "Projected ₹X by month end", "₹Y/day left" and an "OVER PACE" tag when relevant.
  - Past months show "Ended ₹X under/over".
- **b) Consistency warning:** when an `Overall` budget exists and the category budgets add up to more than it, show a warning box on the Budgets page: "Your category budgets add up to ₹A, more than your Overall budget of ₹B."
- **c) Repeat every month:**
  - New field `repeat` (Boolean, default `false`, so old budgets behave as before). The form checkbox "Repeat every month" is checked by default for new budgets.
  - Daily scheduler job, plus once at startup: for each previous-month budget with `repeat: true`, create the same budget for the current month if that category has none yet.
  - On the Budgets page, when the selected month is empty and the previous month had budgets, show a "Copy last month's budgets" button (`POST /budgets/copy-previous?month=YYYY-MM`).
- **d) Duplicates:** the same user + month + category is also blocked on **update** (409).
- **e) Month limit:** a month cannot be more than 12 months ahead.

### 2.2 Savings goals
- **a) Contributions and withdrawals:** add `type: "deposit" | "withdrawal"` to contribution entries (default `deposit`; the amount stays positive).
  - `POST /savings-goals/:id/withdraw { amount, note }`: the amount must be ≤ `savedAmount`. Status is recalculated: a goal goes back to `active` if it drops below its target.
- **b) "Use this goal"** (for example, "I bought the laptop"):
  - `POST /savings-goals/:id/use { createExpense, title, category, paymentMethod }`.
  - Optionally creates an expense for `savedAmount`, dated today.
  - Sets `status="archived"` and `archivedAt`, and stores `usedExpense`.
  - Archived goals don't count as reserved money and are left out of planners.
  - The UI shows them in a collapsed "Archived goals" section.
- **c) History:** each goal card has a "History" link that opens a modal listing contributions and withdrawals (newest first).
- **d) Form helper:** while typing the target, saved amount and date, show live text: "Save ₹X per month to reach this by <date>".
  - `X = (target − saved) / monthsRemaining`, where `monthsRemaining = max(1, ceil(days / 30.44))`.
  - Validation: on create, `targetDate` must be after today. On update, a past date is allowed only if it wasn't changed.
- **e) Overdue goals:** an active goal whose target date has passed shows an "OVERDUE" tag.
- **f) Status enum:** `active | completed | archived`.

### 2.3 Bills
- **a) Repeat:** new field `repeat` (`none | monthly | quarterly | yearly`, default `none`) plus `anchorDay`.
  - When a repeating bill is paid, automatically create the next pending bill with the same name, category, amount, `reminderDays` and `repeat`, due one period later (`addPeriod`). Store it in `nextBill`.
  - Undo payment ("unpay"): delete `nextBill` only if it is still pending and unedited (`updatedAt == createdAt`).
- **b) Pay dialog** (replaces the one-click pay):
  - Fields: "Amount paid" (defaults to the bill amount), "Paid on" (≤ today), payment method, and "Also record as expense" (checked).
  - Store `paidAmount`. The expense uses the actual amount and date.
- **c) Grouping:** sections for Overdue, Due in the next 7 days, Later, and Paid. Paid shows the last 30 days, with a "Show all" toggle for older ones.
- **d) Double-counting warning:** creating or editing a bill whose name matches (case-insensitive, trimmed) an **active recurring expense** returns `warning`. The client shows it as a toast: "You also have a recurring rule '<title>' that records this automatically – keep only one to avoid double counting."

### 2.4 Recurring
- **a) End:** the form adds an "Ends" option: Never / On date / After N payments. "After N" is converted to an `endDate` with `addPeriod(nextDate, frequency, anchorDay, N-1)`. Cards show "ENDS <date>" or an "ENDED" tag.
- **b) Skip next:** `POST /recurring-transactions/:id/skip` moves `nextDate` forward one period without creating a record. Add a "Skip next" button.
- **c) Summary strip:** shows Monthly recurring income, Monthly recurring expenses and Net per month, using `monthlyEquivalent` over active rules.
- **d) Frequencies:** daily, weekly, monthly, quarterly, yearly. Add quarterly to constants and validators.

### 2.5 Planning navigation order
- PLANNING: **Safe to spend**, Budgets, Savings goals, Bills, Recurring, **Subscriptions**.

---

## Part 3 – Safe to Spend and "Can I afford this?" (flagship)

### 3.1 `server/services/planningService.js`

**Pure function `computeSafeToSpend(input)`.**

Its input is everything already loaded: user settings, balance, goals, bills, recurring rules, today's expenses, budget performance, recent expenses and today's date.

Its output:

```
{
  status: "setup" | "short" | "tight" | "comfortable",
  payday, daysLeft,
  balance, goalReserve, billsDue[], billsDueTotal,
  recurringDue[], recurringDueTotal, goalPlan[], goalContributionsDue,
  buffer, spendable, spentToday,
  dailyAllowance, leftToday, limitedBy: "money" | "budget",
  shortBy, avgDailySpend, breakdown[], timeline[]
}
```

**Calculation:**

1. **payday:**
   - Use the earliest `nextDate` among active recurring **income** rules within the next 45 days.
   - Otherwise use the next occurrence of `user.salaryDay`, clamped to the length of the month.
   - If today is the salary day, use next month's.
2. **daysLeft** = days from today up to the day before payday, counting today (minimum 1).
3. **balance** = openingBalance + all income − all expenses (as in 1.4).
4. **goalReserve** = sum of `savedAmount` for goals with status `active` or `completed`. This money is still in the account but is not spendable.
5. **billsDue** = pending bills with `dueDate < payday`, including overdue ones.
6. **recurringDue** = occurrences of active recurring **expense** rules between `nextDate` and payday.
   - Rules due earlier but not yet processed are included, because they are not recorded yet. Respect `endDate`.
   - **Dedupe:** skip an occurrence when a counted pending bill has the same normalized name, an amount within 10%, and a due date within 5 days.
7. **goalContributionsDue**, for each active goal with a future `targetDate`:
   - `requiredMonthly = remaining / monthsRemaining`.
   - `contributedThisCycle` = deposits − withdrawals dated on or after `cycleStart`, where `cycleStart = addPeriod(payday, monthly, anchor, -1)`.
   - `due = max(0, requiredMonthly − contributedThisCycle)`. Sum all goals' `due`.
8. **buffer** = `user.safetyBuffer`.
9. **spendable** = balance − goalReserve − billsDueTotal − recurringDueTotal − goalContributionsDue − buffer.
10. **spentToday** = today's expenses. **dailyAllowance** = max(0, spendable + spentToday) / daysLeft. **leftToday** = max(0, dailyAllowance − spentToday).
    (Adding back today's spending keeps the allowance stable during the day.)
11. **Budget limit:** if the current month has a budget:
    - `budgetDaily = max(0, budgetRemaining + spentTodayTracked) / daysLeftInMonthIncludingToday`.
    - `budgetLeftToday = max(0, budgetDaily − spentTodayTracked)`.
    - If this is lower, `leftToday = budgetLeftToday` and `limitedBy = "budget"`.
12. **status:**
    - `setup`: no income records, `openingBalance == 0`, and balance ≤ 0.
    - `short`: spendable < 0, with `shortBy = −spendable`.
    - `tight`: dailyAllowance < 0.8 × avgDailySpend.
    - `comfortable`: otherwise.
    - `avgDailySpend` = last 30 days of expenses where `isRecurring=false` and the category is not Rent & Housing or Bills & Utilities, divided by 30.
13. **breakdown:** ordered lines for "Why this number?" (balance, − reserved in goals, − bills before payday, − recurring before payday, − planned goal savings, − safety buffer, = spendable, ÷ days left).
    **timeline:** upcoming bills and recurring items sorted by date, each with "money left after this".

Also add a DB wrapper `getSafeToSpend(userId)` and `GET /planning/safe-to-spend`.

### 3.2 "Can I afford this?" – `POST /planning/afford { title, amount, category? }`

Uses the same computed values. The verdict is the first rule that matches:

- **A. `yes`:** amount ≤ leftToday → "Yes – it fits in today's ₹X."
- **B. `yes_but`:** amount ≤ spendable → "Yes, but your daily safe-to-spend drops from ₹A to ₹B until payday." (B = (spendable − amount) / daysLeft)
- **C. `skip_goal_savings`:** amount ≤ max(0, spendable) + goalContributionsDue → "Only if you skip ₹Y of this month's goal savings – <nearest goal> slips about N days."
  - `Y = amount − max(0, spendable)` and `N = ceil(Y / (sum requiredMonthly / 30.44))`.
- **D. `use_savings`:** amount ≤ max(0, spendable) + goalContributionsDue + goalReserve → "Only by taking ₹Z out of your goal savings."
  - `Z = amount − max(0, spendable) − goalContributionsDue`. Name the goals it would come from.
- **E. `no`:** "You'd be ₹S short before payday." (S = amount − max(0, spendable))
  - `suggestedDate`: `monthlyNet` = average (income − expenses) over the last 3 full months that have data.
  - If `monthlyNet > 0`: `months = ceil(S / monthlyNet)`, and `suggestedDate = addPeriod(payday, monthly, anchor, months-1)` → "You could afford it around <date>."
  - Otherwise `suggestedDate=null`, with "You aren't saving each month right now – reduce spending first."
- **Budget warnings** (added to any verdict):
  - Category budget remaining < amount → "This is ₹X over your <Category> budget."
  - Overall budget remaining < amount → a similar warning.
- **Response:**
  ```
  { verdict, headline, details[], warnings[], numbers{...}, suggestedDate, tip, aiGenerated }
  ```
  - `tip` is one sentence from `explainOrFallback` (rule-based fallback). The AI never changes the numbers or the verdict.
- Nothing is saved by this endpoint.

### 3.3 UI
- **New page `/safe-to-spend`** (PLANNING, "Safe to spend"):
  - Hero: "You can safely spend **₹640** today", with "until payday on 1 Dec · 8 days left", a status tag (COMFORTABLE / TIGHT / SHORT BY ₹X / SET UP), and when relevant "Limited by your monthly budget".
  - "Why this number?" card showing the breakdown.
  - "Before payday" card showing the timeline.
  - "Can I afford this?" button.
  - Link to Profile → Money settings.
  - `setup` state: explains how to add income or a starting balance.
  - If the balance is below `goalReserve`: show "Your goals hold more than your recorded balance – set your starting balance in Profile."
- **Afford modal:** fields for item, price and an optional category. The result box is coloured by verdict (`ok` / `info` / `warn` / `bad`) and shows the headline, details, warnings and tip, plus two buttons:
  - "Add as expense" opens `TransactionForm` prefilled.
  - "Save for it" creates a savings goal with name = item, target = price, and target date = `suggestedDate` (or +3 months).
- **Dashboard:** a compact "Safe to spend today" card at the top of the right column, above Financial health. It shows the amount, days to payday, a status tag and a "Can I afford this?" button.
- **Notification:** a daily 09:00 job. When the status is `short`: "Heads up: you may run short by ₹X before payday (<date>)" (key `planning:short:<YYYY-MM-DD>`).
- **AI Coach:** add a safe-to-spend summary and subscription totals to `buildContext`. Add a rule-based intent for "how much can I spend / afford" that answers with safe-to-spend.

---

## Part 4 – Subscription Detective

### 4.1 `server/services/subscriptionService.js`: pure `detectSubscriptions(expenses, today, recurringRules, prefs)`
1. Use expenses from the last 400 days.
2. **merchantKey**:
   - Lowercase the title and remove digits, punctuation and these words: payment, paid, bill, subscription, sub, monthly, yearly, renewal, upi, autopay, auto, debit, txn, ref, to, for, the, a.
   - Collapse spaces. Skip the expense if the key ends up empty.
3. Group by key and keep groups with **≥ 2** records. Sort by date and merge records less than 5 days apart.
4. **Frequency:** take the median interval. Weekly is 6–8 days, monthly 26–35, quarterly 84–98, yearly 350–380; anything else is not a subscription. At least 75% of intervals must fall within the class range.
5. **Amount:**
   - `typical` = median amount.
   - Stable when every amount is within ±15% of `typical`, or only the last one differs.
   - **priceChange** when the last amount differs from the previous one by more than 2% and at least ₹1: `{ from, to, pct, date }`.
6. **confidence:** `high` with ≥ 3 occurrences, regular and stable; `medium` with 2 occurrences and stable. Discard anything else.
7. **nextExpected:**
   - Monthly, quarterly and yearly: `addPeriod(lastDate, freq, anchorDay=lastDate's day)`.
   - Weekly: last date + 7 days.
   - **status:**
     - `tracked`: an active recurring rule has the same normalized title.
     - `missed`: today > nextExpected + 10 days ("No charge since <date> – cancelled?").
     - `detected`: otherwise.
8. **kind:** `subscription` for Entertainment, Education, Shopping and Bills & Utilities; `regular payment` for other categories.
9. Return items with `monthlyCost`, `yearlyCost`, `occurrences`, `lastAmount`, `lastDate`, `paymentMethod` and `category`, plus totals: monthly, yearly and percentage of average monthly income.

### 4.2 Model `SubscriptionPref { user, key, dismissed: Boolean, remind: Boolean (default true) }`
- Unique index on `{ user, key }`.

### 4.3 API (`/subscriptions`, protect)
- `GET /subscriptions` returns `{ items (not dismissed), hidden (dismissed), totals }`.
- `POST /subscriptions/dismiss { key }` and `POST /subscriptions/restore { key }`.
- `POST /subscriptions/track { key }` creates a RecurringTransaction from the detected item:
  - Title = display name, amount = last amount, classification = category, frequency.
  - `nextDate` = the next future occurrence, and `anchorDay` is set.
  - 409 if a rule with that title is already active.
  - Explain in the UI that from then on the charge is recorded automatically.
- `POST /subscriptions/remind { key, remind }`.

### 4.4 Scheduler
- Daily at 09:00, for users with expenses in the last 60 days, detect and notify:
  - Renewal within 3 days: "Netflix renews on 5 Dec (₹249)", key `sub:<key>:<nextExpected>`.
  - Price change: "Netflix went up from ₹199 to ₹249 (+25%)", key `subprice:<key>:<date>`.
- Skip dismissed items and items with `remind=false`.

### 4.5 UI page `/subscriptions` (PLANNING, "Subscriptions")
- **Header:** "Subscriptions & regular payments" with the description "Found automatically from your expenses."
- **Summary tiles:** Monthly cost, Yearly cost, % of income, Count.
- **Cards** show:
  - Name, category and a frequency tag.
  - Typical amount and yearly cost.
  - "Renews in N days" / "Due today" / "Missed – cancelled?".
  - Price-change badge: "₹199 → ₹249 (+25%)".
  - Status tag (TRACKED / DETECTED / MISSED) and confidence.
  - Actions: Track as recurring, Reminders on/off, Not a subscription.
- **"Hidden"** collapsed list with Restore.
- **Empty state:** "We look for at least 2 payments to the same merchant at a regular interval (weekly, monthly, quarterly or yearly)."

---

## Part 5 – Voice and Hinglish quick add

### 5.1 `server/services/quickAddParser.js`: pure `parseQuickAdd(text, today)` → `{ items: [...] }`

The input is split on " and ", " aur ", "," and ";". Each segment is parsed into:

```
{ type, title, amount, category | source, paymentMethod, date, confidence, missing[] }
```

- **Amount:**
  - Digits, including decimals and commas.
  - Devanagari digits ०–९.
  - "₹", "rs", "rs.", "rupees", "rupaye" and "inr" are stripped.
  - Multipliers: "k" (×1,000), "lakh"/"lac" (×100,000).
  - Number words: one–ten, twenty, fifty, hundred, thousand; ek, do, teen, char/chaar, paanch/panch, chhe, saat, aath, nau, das, bees, pachaas; sau (×100), hazaar/hazar (×1,000).
  - "dedh" = 1.5 and "dhai" = 2.5 (so "dedh sau" = 150, "dhai hazaar" = 2,500).
- **Date:**
  - aaj/today → today.
  - kal/yesterday → yesterday. In expense context "kal" means yesterday; never return a future date.
  - parso / "day before yesterday" → −2 days.
  - A weekday name or "last <weekday>" → the most recent past one.
  - "12th", "12 nov" or "12/11" → this year; if that is in the future, last year.
  - Default: today.
- **Type:** income cues (received, got, credited, salary, mila, mile, aaya, income, refund, cashback, earned) → `income`; otherwise `expense`.
- **Payment:**
  - upi, gpay, google pay, phonepe, paytm, bhim → `upi`
  - card, credit, debit → `card`
  - cash, nakad, nagad → `cash`
  - neft, imps, bank, transfer → `bankTransfer`
- **Category keywords (English and Hinglish):**
  - **Food & Dining:** chai, tea, coffee, nashta, khana, lunch, dinner, breakfast, swiggy, zomato, biryani, pizza, groceries, grocery, sabzi, doodh, milk, kirana, dmart, bigbasket, blinkit, zepto.
  - **Transport:** petrol, diesel, fuel, uber, ola, rapido, auto, rickshaw, bus, metro, cab, toll, parking.
  - **Bills & Utilities:** recharge, bijli, electricity, light bill, wifi, broadband, mobile bill, gas cylinder, water bill, dth.
  - **Shopping:** amazon, flipkart, myntra, meesho, kapde, clothes, shoes, shirt.
  - **Entertainment:** movie, film, netflix, hotstar, spotify, pvr, game.
  - **Health:** dawai, medicine, doctor, hospital, pharmacy, gym.
  - **Education:** fees, book, kitab, course, udemy, coaching, exam.
  - **Travel:** train, flight, hotel, irctc, trip.
  - **Rent & Housing:** rent, kiraya, pg, hostel.
  - **Income sources:**
    - salary → Salary
    - freelance, project, client → Freelance
    - "rent received", "kiraya mila" → Rental
    - gift, shagun → Gift
    - interest, dividend → Investment
    - business, dukan, sale → Business
- **Title:** the matched keyword in Title Case (e.g. "Petrol"). Otherwise the leftover words after removing numbers and fillers (paid, spent, for, on, ka, ki, ke, ko, liya, diya, kharcha, by, via, using, se, me, mein), up to 40 characters. Fallback: "Quick expense" / "Quick income".
- **confidence:**
  - `high`: amount found and category found.
  - `medium`: amount found only.
  - `low`: no amount.

### 5.2 `POST /ai/parse-transaction { text }` (protect, aiLimiter, text up to 300 characters)
- Run `parseQuickAdd` first.
- For any item that is not `high` (or when the text has Devanagari letters), and AI is enabled:
  - Call `generateJSON` with `{ timeoutMs: 20000, retries: 1, lenientJSON: true, useFallbackModel: true }`, giving it the allowed category/source lists and today's date. It must never return a future date.
  - Clean the result like the receipt scan, and fill only the fields the rules missed.
- Return `{ items, source: "rules" | "ai" | "mixed" }`. **Nothing is saved.**

### 5.3 Client
- **`TransactionForm`:** add a "Quick add" row above the scan box.
  - A text input with placeholder "e.g. 250 petrol kal upi" and Enter to parse.
  - A mic button and an EN / हिं toggle (`en-IN` / `hi-IN`).
  - **Speech:**
    - Use `window.SpeechRecognition || window.webkitSpeechRecognition` with `interimResults`.
    - While listening, show a pulsing state and the live transcript. On the final result, parse automatically.
    - When speech isn't supported, hide the mic but keep the text box, with a hint: "Voice works in Chrome and Edge".
    - Permission denied → toast "Allow microphone access".
  - **Applying the result:**
    - Fill the form with `setValue(..., { shouldValidate: true, shouldDirty: true })` and toast "Filled: …".
    - Switch between Expense and Income automatically, unless the form is locked. On the locked Expenses page, income gives the toast "This sounds like income – add it from the Income page".
    - When there are several items, fill the first and show "+N more" chips. After saving, the next chip loads into a fresh form.
- **Top bar:** a mic "Quick add" icon button (next to the theme toggle) opens `TransactionForm` with listening already started (prop `autoVoice`).

---

## Part 6 – Demo data, tests and documentation

### 6.1 Seed (demo accounts only)
Extend `server/scripts/seed.js` so every new feature has something to show:
- **Demo user:** `openingBalance` 25000, `salaryDay` 1.
- **Netflix:** monthly for 5 months, price 199 → 249 in the latest month.
- **Spotify:** ₹119 monthly.
- **Gym:** quarterly ₹2,999.
- **Budgets:** current-month budgets with `repeat: true`.
- **Bill:** a repeating monthly bill ("Wi-Fi (ACT)").
- **Recurring:** a "Phone EMI" ₹2,500 monthly rule with an end date (6 payments).
- **Goals:** one with contributions and one withdrawal.

### 6.2 Tests: `server/tests/*.test.js` with `node:test` and `node:assert`
Add `"test": "node --test"` to `server/package.json` (with no path, Node finds every `*.test.js` file automatically, on Node 20 and 22). Cover:
- **schedule:**
  - Jan 31 monthly → Feb 28 → Mar 31.
  - Feb 29 yearly → Feb 28.
  - `endDate` is respected.
  - `monthlyEquivalent`.
- **computeSafeToSpend:**
  - comfortable, tight, short and setup cases.
  - Budget-limited case.
  - Bill/recurring dedupe.
  - Goal cycle contributions.
- **afford:** one case for each verdict A–E, plus budget warnings and `suggestedDate`.
- **detectSubscriptions:**
  - Monthly with a price change.
  - Quarterly.
  - Irregular groceries not detected.
  - Tracked status.
  - Missed status.
- **parseQuickAdd** (at least 12 cases), including:
  - "250 petrol kal upi"
  - "do sau chai"
  - "dedh hazaar ka recharge"
  - "salary 35000 mila"
  - "1.5k myntra card"
  - "300 ka khana aur 120 auto"
  - Devanagari digits
  - Never returns a future date.
- `npm test` must pass.

### 6.3 README
Add a section "How FinTrack AI calculates things" with each formula in plain English:
- Safe to spend
- Afford verdicts
- Subscription detection
- Budget pace
- Recurring anchor day
- Balance

Also list the new API routes.

---

## Part 7 – Final verification (must all pass)
1. `node --check` passes on all server files. The client builds with `npm run build`. The server starts with no errors.
2. **Regression check** (everything still works): login/register/refresh, dashboard, transactions (search, filter, export), add/edit/delete expense and income, receipt scan, budgets, goals, bills, recurring, notifications, reports, every AI Insights tab, profile, admin, dark/light theme.
3. **New features**, checked with the demo account via curl and by reasoning about the UI:
   - safe-to-spend numbers add up to the breakdown
   - each afford verdict
   - subscriptions show Netflix with a price change
   - the quick-add examples
   - repeating bill creates the next bill
   - budget copy and repeat
   - goal withdraw and use
   - recurring skip and end
4. **Final report:**
   - What was built in each Part
   - Every file added or changed
   - Decisions taken where the spec was silent
   - Test results
   - Anything that could not be verified