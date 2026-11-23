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
- Budgets per month with spent / remaining / % used, alerts at 80% and 100%
- Savings goals with contributions and completion
- Bills with due-date reminders and "Mark as paid" (creates the matching expense)
- Recurring income / expenses processed automatically by a scheduler (daily / weekly / monthly / yearly), pause / resume
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
    │                       RecurringTransaction, Notification, AuditLog
    ├── routes/v1/          versioned REST API  (/api/v1/...)
    ├── services/           analytics, AI (Gemini), notifications, email, scheduler, storage
    ├── validators/         express-validator rules
    ├── utils/              JWT / bcrypt helpers, dates, constants
    └── scripts/            seed.js (demo data), makeAdmin.js
```

### Main API routes (`/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `GET /auth/me`, `POST /auth/forgot-password`, `/auth/reset-password`, `PUT /auth/change-password` |
| Expenses | `GET/POST /expenses`, `PUT/DELETE /expenses/:id`, `POST /expenses/scan-receipt`, `POST /expenses/:id/receipt` |
| Income | `GET/POST /income`, `PUT/DELETE /income/:id` |
| Ledger | `GET /transactions`, `GET /transactions/export` |
| Planning | `/budgets`, `/savings-goals` (+ `/:id/contribute`), `/bills` (+ `/:id/pay`, `/:id/unpay`), `/recurring-transactions` |
| Insights | `GET /dashboard`, `GET /analytics`, `/analytics/anomalies`, `/analytics/goals`, `/analytics/budgets/recommend`, `POST /analytics/budgets/apply` |
| AI | `GET /ai/brief`, `GET /ai/recap`, `POST /ai/chat`, `POST /ai/simulate`, `GET /ai/status` |
| Other | `/notifications`, `/profile`, `/admin/*` (admin role only) |

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
