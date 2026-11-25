# FinTrack AI – Upgrade v3 (implementation spec)

Implement **every Part, in order**. Where this spec is silent, choose the simplest option that matches the existing code and list that decision in the final report.

---

## 0. Rules (same as v2)
1. **Git:**
   - Run `git status`. If anything is uncommitted, commit it as `Before upgrade v3`.
   - From `main`, create and switch to branch `feature/upgrade-v3`.
   - Commit after each Part (`Upgrade v3 – Part N: <name>`).
2. **Before editing:**
   - Study the current code first.
   - Keep every existing feature and earlier fix working, including Upgrade v2.
3. **Constraints:**
   - No new npm packages. Use Node built-ins (`crypto`, `dns`) and the existing `nodemailer`.
   - Backward compatible with existing data: new fields must be optional or have safe defaults.
   - Money and date logic goes in pure, testable functions in `server/services` or `server/utils`.
4. **UI:**
   - Use the existing design system (`theme.css` classes and components) and the icons in `icons.js`.
   - Both themes must look right, plus phone width.
5. **Security:**
   - Never print `.env` contents, keys or one-time codes. The single exception is the existing development fallback in `emailService` (see 4.1).
   - Don't start a second server. Ask the user to restart and wait.

---

## Part 1 – Quick add / voice: the spoken date must fill the Date field

**Problem:** when the user says a date ("kal", "parso", "last Monday", "12 Nov"), the Date field doesn't change.

### 1.1 Parser (`server/services/quickAddParser.js`, pure)
Return `date` (YYYY-MM-DD), `dateText` (what was understood, e.g. `"yesterday (24 Nov)"`) and `dateSource: "spoken" | "default"` for every item.

Phrases to support (English, Hinglish and Hindi Devanagari):

| Said | Date |
|---|---|
| today, aaj, आज | today |
| yesterday, kal, कल | yesterday ("kal" means yesterday for a record of something already paid) |
| day before yesterday, parso, parson, परसों | today − 2 |
| "N days ago", "N din pehle", "N दिन पहले" (N as digits or number words) | today − N |
| last week, pichle hafte, पिछले हफ्ते | today − 7 |
| weekday names, e.g. monday/mon, somvar/सोमवार, mangalvar, budhvar, guruvar/brihaspativar, shukravar, shanivar, ravivar/itvaar | most recent past (today if it is that day) |
| "last <weekday>" | the one in the previous week |
| "12 nov", "nov 12", "12th november", "12/11", "12-11", "12/11/2026" | that date |
| "on 5th", "5 tarikh" | the 5th of this month, or of last month if this month's 5th is still ahead |

- **Never a future date:**
  - An explicit date in the future moves back one year (day-month) or one month (day only).
  - "tomorrow", "kal subah" in an obviously future sense, and "agle" → use today, and set `warning: "Future dates can't be added – use Bills for upcoming payments."`
- Remove the date words from the title.
- Add Devanagari number words: एक, दो, तीन, चार, पाँच/पांच, छह/छः, सात, आठ, नौ, दस, बीस, पचास, सौ, हज़ार/हजार, डेढ़, ढाई. With these, "दो सौ" = 200.
- When AI fills gaps: pass today's date, ask for YYYY-MM-DD, then run the same "never future" check.

### 1.2 Client (`QuickAddBar.jsx` / `TransactionForm.jsx`)
- **Date field:**
  - Set it with `setValue("date", value, { shouldValidate: true, shouldDirty: true })`.
  - Make sure the visible `<input type="date">` actually updates. Check how the date input is registered and fix it if it is uncontrolled or controlled the wrong way.
- **"Understood" chip** under the quick-add box, e.g. `₹200 · Food & Dining · Yesterday, 24 Nov · UPI`, with an **Undo** link that restores the values the form had before.
- Fields filled by quick add **glow for about 1.2 s** (a CSS class), so the user sees what changed, including the date.
- Toast: "Filled: amount, category, date (Yesterday, 24 Nov)". If `warning` is set, show it.
- Voice in हिं mode works end to end with Devanagari transcripts.

### 1.3 Tests
At least 12 new `parseQuickAdd` date cases. Every one checks that the result is never in the future. Include:
- "parso 300 auto"
- "do din pehle 500 kirana"
- "last monday 120 chai"
- "12 nov 999 myntra"
- "5 tarikh 2000 rent"
- "कल दो सौ चाय"
- "tomorrow 500 petrol" (warning, today)

---

## Part 2 – Income-specific hints and smart defaults

### 2.1 Title placeholder (rotating every 2.5 s, changes with Expense/Income)
- **Expense:**
  - e.g. Electricity bill
  - e.g. Grocery shopping
  - e.g. Auto rickshaw fare
  - e.g. Movie tickets
  - e.g. Coffee with friends
- **Income:**
  - e.g. Monthly salary
  - e.g. Freelance website project
  - e.g. Rent from tenant
  - e.g. Diwali bonus
  - e.g. Interest on FD
  - e.g. Pocket money from parents
  - e.g. Cashback / refund

### 2.2 Quick-add placeholder per type
- **Expense:** `e.g. 250 petrol kal upi`
- **Income:** `e.g. 35000 salary mila` / `e.g. 5k freelance payment kal`

### 2.3 Notes placeholder per type
- **Expense:** `e.g. Paid with friends, split later`
- **Income:** `e.g. October salary credited`

### 2.4 Defaults
- A new income defaults to source **Salary** and payment method **Bank transfer**.
- A new expense defaults to **Food & Dining** and **UPI**.
- Editing keeps the record's own values.

### 2.5 Smart category or source from the title
- While the user types a title, guess the category (expense) or source (income) with the same keyword dictionary as the quick-add parser. Share it, for example in `client/src/utils/keywords.js`, mirroring the server list.
- Apply the guess **only if the user hasn't changed the category/source field by hand** (use RHF `dirtyFields`).
- Show a small "auto" hint next to the label when the value was guessed.

---

## Part 3 – Logging streak: correct logic and a better card

### 3.1 Definition (put this in the README)
- **Logged day:**
  - A calendar day (Asia/Kolkata) on which the user **created** at least one income or expense themselves: manual add, quick add/voice, receipt scan, or paying a bill.
  - It counts by **when it was logged** (`createdAt`), not by the transaction date.
  - Records the scheduler creates from recurring rules **do not count**.
- Add `createdBy: "user" | "system"` (default `"user"`) to the Expense and Income models. `recurringService` sets `"system"`. Older records whose notes start with "Added automatically" are treated as system records.
- **current:** consecutive logged days ending today. If today isn't logged yet, count up to yesterday instead (the streak is still alive but **at risk**).
- **best:** the longest run in the last 365 days.
- **status:**
  - `active` – today is logged.
  - `at_risk` – yesterday is logged, today isn't.
  - `broken` – the last logged day is before yesterday; current = 0.
  - `new` – never logged.
- **Milestones:** 3, 7, 14, 30, 60, 100. Return `nextMilestone` and `daysToNext`.
  - When a milestone is reached, create a notification ("🔥 7-day logging streak!") with key `streak:<n>:<runStartDate>`.
- **last7:** an array of `{ date, label: "M" | "T" | "W" | …, logged, isToday }`.

### 3.2 API
- Pure `computeStreak(loggedDays[], today)` in `server/services/streakService.js`, plus a DB wrapper.
- `GET /streak` (protect) returns `{ current, best, status, loggedToday, last7, nextMilestone, daysToNext }`.
- `AppLayout` must use this instead of calling `/dashboard?range=7`.

### 3.3 Sidebar card (replaces the current streak box)
- **Top row:**
  - Flame icon, coloured by status: orange for active, gold for at risk, grey for broken or new.
  - Large "**5-day streak**" and small "Best: 12 days" on the right.
- **7 day pills** with weekday initials under them:
  - Logged days are filled with a check.
  - Today is outlined, and gently pulses when it isn't logged yet.
- **Message by status:**
  - active: "Logged today ✓ – see you tomorrow"
  - at_risk: "Log something today to keep your streak"
  - broken: "Streak ended – log today to start again"
  - new: "Log your first record to start a streak"
- **Progress to the next milestone:** "2 days to your 7-day badge" with a thin progress bar.
- When today isn't logged, show a small **"Log now"** button that opens `TransactionForm` (quick add focused).
- Updates instantly on `fintrack:data-changed`.
- On narrow screens (collapsed rail) show only the flame and the number.
- Looks right in both themes.

---

## Part 4 – Verified accounts (email OTP) and email notifications

### 4.1 Email verification when creating an account
- **User model:**
  - `emailVerified` (Boolean, **default `true`**, so existing and demo users stay verified). Registration explicitly sets `false`.
  - `emailOtpHash`, `emailOtpExpires`, `emailOtpAttempts`, `emailOtpSentAt`, `emailOtpSendCount`, `emailOtpWindowStart`, all with `select: false`.
- **Helpers** (`server/utils/otp.js`, pure where possible):
  - `generateOtp()` returns 6 digits from `crypto.randomInt`.
  - `hashOtp()` uses SHA-256.
  - `verifyOtp()` compares with `crypto.timingSafeEqual`.
- **`POST /auth/register {name, email, password}`:**
  1. Existing validators run first.
  2. **Domain check:** `dns.promises.resolveMx` on the email domain with a 4 s timeout.
     - ENOTFOUND or ENODATA → 400 "This email address can't receive mail. Please check it."
     - Timeout or network error → allow (so offline development still works).
  3. **Existing email:**
     - Verified user → 409 "Email is already registered".
     - Unverified user → update the name and password and send a fresh code. This lets someone who typed the wrong code simply register again.
  4. **New user:** create with `emailVerified:false`. Generate the OTP (valid 10 min, attempts 0) and email it.
     - Subject: "Your FinTrack AI verification code".
     - Body: the large code, "valid for 10 minutes", and "If you didn't sign up, ignore this email".
  5. **Response** 201 `{ needsVerification: true, email, emailEnabled: isEmailEnabled() }`. **No tokens.** Never include the OTP in any response.
- **`POST /auth/verify-email {email, otp}`:**
  - Errors:
    - Not found or already verified → 400.
    - Expired → 400 "Code expired – request a new one".
    - 5 or more wrong attempts → 429 "Too many attempts – request a new code".
    - Wrong code → `attempts + 1`, 400 "Incorrect code (N tries left)".
  - On success:
    - Set `emailVerified = true`, clear the OTP fields and set `lastLoginAt`.
    - Issue tokens exactly like login (access token plus refresh cookie).
    - Send the welcome email, create the welcome in-app notification, and write an audit entry `verify-email`.
    - The response has the same shape as login.
- **`POST /auth/resend-otp {email}`:**
  - Only for unverified users. Wait at least 60 s since the last send, and allow at most 5 sends per hour.
  - Respond 200 with a neutral message. Return `retryAfter` seconds when throttled.
- **Login:**
  - Correct password but `emailVerified:false` → 403 `{ code: "EMAIL_NOT_VERIFIED", message: "Please verify your email first – we've sent you a new code." }`.
  - Also send a new code, respecting the 60 s rule.
- **Rate limits:** apply `authLimiter` to `verify-email` and `resend-otp`.
- **Development without email set up:** `sendEmail` already prints to the server console when `EMAIL_USER`/`EMAIL_PASS` are missing. Keep that, so the code can be read in the server terminal. The client shows "Email isn't configured on the server – the code is printed in the server terminal" when `emailEnabled` is false.

### 4.2 Client
- **New page `/verify-email?email=…`** (inside `AuthShell`, public-only route):
  - "Check your email", with the address shown.
  - **6 digit boxes:** auto-advance, Backspace goes to the previous box, and a pasted 6-digit code fills all boxes.
  - **Countdown:** "Code expires in 09:42".
  - **"Resend code"** is disabled for 60 s with a countdown.
  - **"Use a different email"** goes back to Register.
  - On success: log in, go to the dashboard, toast "Email verified – welcome to FinTrack AI!".
- **AuthProvider:**
  - `register()` no longer sets the user when `needsVerification`; the page navigates to verify instead.
  - Add `verifyEmail(email, otp)` and `resendOtp(email)`.
- **Login page:** on `EMAIL_NOT_VERIFIED`, show a toast and navigate to `/verify-email?email=…`.

### 4.3 Email notifications
- **Welcome email** after verification.
- **New sign-in alert:**
  - Sent on each successful **login** (not on refresh).
  - "New sign-in to FinTrack AI", with the date and time (IST), a simple device summary from the user-agent ("Chrome on Windows"; write a small pure helper and test it) and the IP.
  - "If this wasn't you, reset your password: <CLIENT_URL>/forgot-password".
- **Password changed / reset** → "Your FinTrack AI password was changed".
- **User preferences** (Profile → new "Notifications & security" card, `PUT /profile` validated):
  - `loginAlerts` (default true).
  - `emailAlerts` (default true): budget-exceeded and bill-reminder emails.
  - Security emails (OTP, password change) are always sent.
  - `notificationService` must check `emailAlerts` before sending budget/bill emails.
- **One email layout** for all emails: FinTrack AI header, clear title, body, footer "You're receiving this because you have a FinTrack AI account."
- **Admin → Users table:** add a "Verified" tag column.

### 4.4 Demo and seed
- The demo and admin accounts are created with `emailVerified: true`.

---

## Part 5 – Tests, docs and final checks
1. **`node:test` additions:**
   - The parser date cases (Part 1).
   - `computeStreak`:
     - active, at_risk, broken, new
     - best streak
     - system-created records ignored
     - milestone maths
   - OTP helpers: always 6 digits, hash and verify work, a wrong code fails.
   - The user-agent summary helper.
   - `npm test` passes.
2. **README:**
   - Add "Email setup (Gmail App Password)" with the steps and the two `.env` lines.
   - Document the streak definition and the new routes (`/auth/verify-email`, `/auth/resend-otp`, `/streak`).
3. **Verify:**
   - `node --check`, the client `npm run build`, and a clean server start.
   - Full curl flow with a throwaway email: register → (read the code from the dev console if email isn't configured) → wrong code → right code → tokens → login alert → resend throttling.
   - Afterwards, delete only that throwaway user and its data.
   - Regression check of the existing features, including Upgrade v2.
4. **Final report:**
   - What was built in each Part.
   - Every file changed.
   - Decisions taken where the spec was silent.
   - Test results.
   - Anything not verified (for example, the real microphone and real email delivery).