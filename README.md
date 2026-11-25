# FinTrack AI

**An AI-Powered Personal Finance Management System** · *Manage Smarter. Spend Better.*

MERN stack (MongoDB, Express.js, React, Node.js). BCA Full Stack Development project, 2026-27.

---

## 1. What you need

| Software | Notes |
|---|---|
| Node.js 20 or newer | `node -v` to check |
| MongoDB Community Server | running on your PC (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas URL |
| VS Code | recommended editor |

> **MongoDB must be running.** On Windows: press `Win + R` → type `services.msc` → find **MongoDB Server** → click **Start** (set *Startup type* to *Automatic* so it starts with Windows).
> If Compass says `connect ECONNREFUSED 127.0.0.1:27017`, this service is stopped.

---

## 2. Run the backend (server)

```bash
cd server
npm install
```

Create the file `server/.env` (copy `server/.env.example` and fill in the values):

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/fintrack
JWT_SECRET=any_long_random_text
JWT_REFRESH_SECRET=another_long_random_text
GEMINI_API_KEY=your_gemini_key        # optional - AI features
GEMINI_MODEL=gemini-3.6-flash
```

> Already have an old `server/.env`? Copy it in and just add the two lines `CLIENT_URL=http://localhost:5173` and `GEMINI_MODEL=gemini-3.6-flash`.

Optional demo data (creates **only** two demo accounts, never touches other users):

```bash
npm run seed
```

Start the API:

```bash
npm run dev
```

You should see `✅ MongoDB Connected` and `🚀 Server running on port 5000`.

---

## 3. Run the frontend (client)

Open a **second** terminal:

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173** (use `localhost`, not `127.0.0.1`, so the login cookie works).

### Demo accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| User (Aditya) | `demo@fintrack.ai` | `Demo@1234` |
| Admin | `admin@fintrack.ai` | `Admin@1234` |

Make any existing account an admin: `cd server` → `npm run make-admin -- you@example.com`, then log out and in again.

---

## 4. Features

**Core finance**
- Register / login with JWT access token (15 min) + refresh token (7 days, HTTP-only cookie), auto refresh, logout
- Forgot / reset password by email link, change password, profile (name, currency, photo), dark / light theme
- Dashboard: greeting, Available balance / Monthly income / Monthly spend / Budget remaining cards with trend lines, Spending Rhythm chart (7D / 30D / 90D), Financial Health ring, AI Money Brief, insight tiles, logging streak, month selector
- Transactions ledger: search (debounced), type / category filters, sorting, pagination, IN / OUT totals, CSV export
- Expenses (category, payment method, receipt upload) and Income (source, payment method)
- **Scan Receipt with AI** - upload a bill photo and the title, amount, category and date are filled in automatically
- **Safe to spend**: what you can spend today until payday, with "Why this number?" and "Before payday", plus **Can I afford this?**
- **Subscription Detective**: finds subscriptions and regular payments in your expenses, price changes and renewal reminders
- **Quick add** by text or voice in English / Hinglish ("250 petrol kal upi", "do sau chai"), mic button in the top bar
- Budgets per month with spent / remaining / % used, pace and month-end projection, "Repeat every month", copy last month, alerts at 80% and 100%
- Savings goals with contributions, withdrawals, history, "Use this goal" and archived goals
- Bills with due-date reminders, a pay dialog (amount, date, method), repeating bills and grouping (overdue / next 7 days / later / paid)
- Recurring income / expenses processed automatically by a scheduler (daily / weekly / monthly / quarterly / yearly), end date or "after N payments", skip next, pause / resume
- Profile → Money settings: starting balance, salary day, safety buffer
- Notification centre (bell) for budget alerts, bill reminders, recurring runs and goals (+ email when configured)
- Reports: income, expenses, net balance, category breakdown, 6-month chart, income by source, CSV / Excel and PDF (print)
- Admin panel: platform statistics, user list, make admin, block / unblock, delete user, recent activity (audit log)

**AI Financial Intelligence** (all numbers are calculated by the backend; the AI only explains them)
- Explainable Financial Health Score (with "Why am I seeing this score?" breakdown)
- Spending anomaly detection, unusually large transactions and money-leak detection
- AI Goal Planner, Smart Budgets (one-click apply), Monthly AI Report Card
- Ask AI Coach (chat with your own finances) and What-If Simulator

> Without a `GEMINI_API_KEY` every AI feature still works using rule-based explanations built from the same calculated figures.

---

## 5. Project structure

```
fintrack-ai/
├── client/                 React + Vite + Tailwind CSS
│   └── src/
│       ├── api/            Axios instance + token refresh interceptor
│       ├── components/     common, layout, transactions, planning, insights, auth
│       ├── context/        AuthContext / AuthProvider, ThemeContext / ThemeProvider
│       ├── hooks/          useAuth, useTheme, useMoney, useDebounce
│       ├── layouts/        AppLayout (top bar + sidebar)
│       ├── pages/          Dashboard, Transactions, Expenses, Income, Budgets, ...
│       ├── services/       API helper functions
│       ├── utils/          formatting, categories
│       └── theme.css       FinTrack AI design system (dark + light)
└── server/                 Node.js + Express + MongoDB (Mongoose)
    ├── config/             database connection
    ├── controllers/        request handling / business logic
    ├── middleware/         auth (JWT), roles, validation, uploads, rate limits, errors
    ├── models/             User, Expense, Income, Budget, SavingsGoal, Bill,
    │                       RecurringTransaction, Notification, AuditLog, SubscriptionPref
    ├── routes/v1/          versioned REST API  (/api/v1/...)
    ├── services/           analytics, planning (safe to spend), subscriptions, quick add,
    │                       budgets, bills, AI (Gemini), notifications, email, scheduler, storage
    ├── tests/              node:test unit tests (npm test)
    ├── validators/         express-validator rules
    ├── utils/              JWT / bcrypt helpers, dates, schedule, constants
    └── scripts/            seed.js (demo data), makeAdmin.js
```

### Main API routes (`/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `GET /auth/me`, `POST /auth/forgot-password`, `/auth/reset-password`, `PUT /auth/change-password` |
| Expenses | `GET/POST /expenses`, `PUT/DELETE /expenses/:id`, `POST /expenses/scan-receipt`, `POST /expenses/:id/receipt` |
| Income | `GET/POST /income`, `PUT/DELETE /income/:id` |
| Ledger | `GET /transactions`, `GET /transactions/export` |
| Planning | `/budgets` (+ `POST /budgets/copy-previous?month=YYYY-MM`), `/savings-goals` (+ `/:id/contribute`, `/:id/withdraw`, `/:id/use`), `/bills` (+ `/:id/pay`, `/:id/unpay`), `/recurring-transactions` (+ `/:id/skip`) |
| Safe to spend | `GET /planning/safe-to-spend`, `POST /planning/afford` `{ title, amount, category? }` (nothing is saved) |
| Subscriptions | `GET /subscriptions`, `POST /subscriptions/dismiss`, `/subscriptions/restore`, `/subscriptions/track` `{ key }`, `POST /subscriptions/remind` `{ key, remind }` |
| Insights | `GET /dashboard`, `GET /analytics`, `/analytics/anomalies`, `/analytics/goals`, `/analytics/budgets/recommend`, `POST /analytics/budgets/apply` |
| AI | `GET /ai/brief`, `GET /ai/recap`, `POST /ai/chat`, `POST /ai/simulate`, `POST /ai/parse-transaction` `{ text }` (quick add, nothing is saved), `GET /ai/status` |
| Other | `/notifications`, `/profile` (incl. `openingBalance`, `salaryDay`, `safetyBuffer`), `/admin/*` (admin role only) |

### Tests

```
cd server
npm test
```

Uses Node's built-in test runner (`node:test`) for the pure calculation functions: schedules, Safe to spend, "Can I afford this?", subscription detection and the quick-add parser.

---

## How FinTrack AI calculates things

All money figures are calculated on the server from your own records (`server/services/*`, pure functions with tests). The AI only explains these numbers or reads free text – it never changes them.

**Balance**
- Available balance = starting balance (Profile → Money settings) + all income − all expenses.
- Money in savings goals is still part of this balance; the dashboard shows it as "reserved in goals".

**Safe to spend**
1. *Payday* = the next date of your earliest active recurring income in the next 45 days; otherwise the next salary day from your profile (if today is the salary day, next month's).
2. *Days left* = today up to the day before payday, counting today (at least 1).
3. *Spendable until payday* = balance − money reserved in active/completed goals − pending bills due before payday (overdue included) − recurring expenses due before payday (not yet recorded) − this month's planned goal savings − safety buffer.
   - A recurring payment is not counted twice when a pending bill has the same name, an amount within 10% and a due date within 5 days.
   - Planned goal savings: for each active goal with a future date, (target − saved) ÷ months remaining, minus what you already put in since the start of this pay cycle (one month before payday).
4. *Daily allowance* = (spendable + what you spent today) ÷ days left. *Safe to spend today* = daily allowance − what you spent today (never below 0). Adding today's spending back keeps the number steady during the day.
5. If you have an **Overall** budget this month: (Overall budget remaining + everything spent today) ÷ days left in the month − everything spent today. When that is lower, it becomes today's number ("Limited by your monthly budget"). Category budgets never limit this number; they only add warnings in "Can I afford this?".
6. Status: **Set up** (no income, no starting balance), **Short** (spendable below 0), **Tight** (daily allowance below 80% of your usual daily spend – last 30 days without rent, bills and automatic records, ÷ 30), otherwise **Comfortable**.

**"Can I afford this?"** – the first rule that matches:
- **Yes** – the price fits in today's safe amount.
- **Yes, but** – it fits in your spendable money; your daily amount drops to (spendable − price) ÷ days left.
- **Only if you skip goal savings** – it needs part of this month's planned goal savings; the nearest goal slips about (amount needed ÷ (total monthly goal savings ÷ 30.44)) days.
- **Only from your savings** – it needs money already saved in goals (least urgent goals first).
- **No** – you would be short by (price − spendable). If you save money each month (average of the last 3 full months), the suggested date is that many months after payday.
- Budget warnings are added when the price is more than what is left in the category budget or the Overall budget.

**Subscription detection**
- Expenses from the last 400 days are grouped by merchant (title in lower case without digits, punctuation and words like "payment", "upi", "autopay", "monthly").
- Payments less than 5 days apart count as one. At least 2 payments are needed.
- The median gap decides the frequency: weekly 6–8 days, monthly 26–35, quarterly 84–98, yearly 350–380; at least 75% of the gaps must fit.
- Typical price = median amount. A price change is shown when the last payment differs from the previous one by more than 2% (and at least ₹1).
- Confidence: high (3+ regular, stable payments) or medium (2 stable payments). Status: **Tracked** (an active recurring rule has the same name), **Missed** (more than 10 days past the expected date – cancelled?) or **Detected**.
- Monthly cost uses the same monthly equivalent as recurring rules (daily × 30.44, weekly × 52 ÷ 12, quarterly ÷ 3, yearly ÷ 12).

**Budget pace**
- Elapsed % = today's day of the month ÷ days in the month. Used % = spent ÷ limit.
- Projected spend = spent ÷ days elapsed × days in the month.
- **Over pace** when used % is more than elapsed % + 10 (and something was spent).
- Per day left = what is left ÷ days left in the month, counting today. Past months show how much under or over they ended.

**Recurring anchor day**
- Monthly, quarterly and yearly schedules remember the day of the month they started on (the anchor day). Each payment lands on that day, or on the last day of a shorter month: Jan 31 → Feb 28 → Mar 31. A yearly payment on Feb 29 falls on Feb 28 in other years.
- "After N payments" sets the end date to the date of the Nth payment. When the next payment would be after the end date, the rule finishes by itself and you get one notification.

**Logging streak**
- A *logged day* is a calendar day (India time) on which you **created** at least one income or expense yourself: a manual add, quick add / voice, a receipt scan or paying a bill.
- It counts by **when you logged it**, not by the transaction date (adding last week's coffee today counts for today).
- Records the scheduler creates from recurring rules don't count (`createdBy: "system"`; older ones are recognised by their "Added automatically" note).
- *Current* = logged days in a row ending today. If today isn't logged yet, it counts up to yesterday – the streak is still alive but **at risk**.
- *Status*: **active** (today logged), **at risk** (yesterday logged, today not yet), **broken** (last logged day before yesterday – current is 0), **new** (never logged).
- *Best* = the longest run in the last 365 days. Milestones at 3, 7, 14, 30, 60 and 100 days each send one notification ("🔥 7-day logging streak!").

**Quick add**
- Text is split on "and", "aur", commas and semicolons. Amounts can be digits (also Devanagari), "1.5k", "2 lakh" or words ("do sau" = 200, "dedh hazaar" = 1,500). "kal" means yesterday; a date is never in the future.
- Keywords pick the category (e.g. petrol → Transport, chai → Food & Dining) and words like "mila", "received", "salary" mark income. When the rules miss something and AI is configured, the AI fills only the missing fields. Nothing is saved until you press Add.

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `MongoDB Connection Failed ... ECONNREFUSED` | Start the **MongoDB Server** service (see section 1). |
| "Cannot reach the server" toast | The backend isn't running - run `npm run dev` inside `server`. |
| Logged out after every refresh | Open the app at `http://localhost:5173` (not 127.0.0.1) and check `CLIENT_URL` in `server/.env`. |
| AI answers say "AI explanations are off" | Add `GEMINI_API_KEY` to `server/.env` and restart the server. |
| Port 5000 already in use | Change `PORT` in `server/.env` and `VITE_API_URL` in `client/.env`. |

---

## 7. Keep a backup (GitHub)

```bash
git init
git add .
git commit -m "FinTrack AI"
git branch -M main
git remote add origin https://github.com/<your-username>/fintrack-ai.git
git push -u origin main
```

`.env` files and `node_modules` are already excluded by `.gitignore`.
