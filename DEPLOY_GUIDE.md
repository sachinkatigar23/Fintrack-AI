# FinTrack AI – Free Deployment Guide

**What we use (all free):**

| Part | Service | Why |
|---|---|---|
| Website + API (one URL) | **Render** – free Web Service | Runs Node/Express. Serving the React build from Express gives one link, no CORS problems and login cookies that work on every browser (including iPhone Safari). |
| Database | **MongoDB Atlas** – Free cluster (512 MB) | Cloud MongoDB, free forever. |
| Receipt & profile photos | **Cloudinary** – free plan | Render's disk is wiped on every restart, so uploaded files must live in the cloud. The code already supports Cloudinary. |
| Emails (OTP, alerts) | **Brevo** – free email API (300/day) | Render's free plan **blocks SMTP**, so Gmail/nodemailer can't send from Render. Brevo sends over HTTPS instead. |
| Keep it awake (optional) | **cron-job.org** | A free Render service sleeps after 15 minutes idle and takes about a minute to wake up. A ping every 10 minutes keeps it awake. |

---

## Part A – Code preparation (for Claude in VS Code)

Rules:
- Work on branch `feature/deploy`.
- No new npm packages. Use Node 20+'s built-in `fetch`.
- Keep local development (`npm run dev` in `server` and `client`) working exactly as now.
- Never print secrets.

### A1. Serve the React app from Express (production only)
- In `server/app.js`, when `NODE_ENV === "production"`:
  - Serve `../client/dist` as static files.
  - Add an **SPA fallback**: every `GET` request that is **not** `/api/...` and not `/uploads/...` returns `client/dist/index.html`.
  - Use Express 5-compatible syntax: a middleware or regex route, not `'*'`.
- Keep `/api/v1` routes, `/api/health`, and the JSON 404 for unknown `/api` routes.

### A2. Running behind Render's proxy
- Add `app.set("trust proxy", 1)`. This keeps `req.ip`, secure cookies and `express-rate-limit` working correctly behind Render.
- The refresh cookie keeps `secure: NODE_ENV === "production"`. The site is now same-origin, so `sameSite: "strict"` can stay.

### A3. Content-Security-Policy (helmet)
The built site is now served by Express, so helmet's default CSP would block parts of it. Configure helmet `contentSecurityPolicy` directives:

| Directive | Allowed sources |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self'` |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` |
| `font-src` | `'self' data: https://fonts.gstatic.com` |
| `img-src` | `'self' data: blob: https://res.cloudinary.com` |
| `connect-src` | `'self'` |
| `media-src` | `'self' blob:` |
| `object-src` | `'none'` |
| `frame-ancestors` | `'none'` |

Also:
- **Move the inline theme script** in `client/index.html` into `client/public/theme-init.js`, loaded with `<script src="/theme-init.js">` in `<head>`, so no inline script is needed.
- Keep `crossOriginResourcePolicy: "cross-origin"`.
- Check that receipt/avatar images from Cloudinary, CSV export (blob download), Google Fonts and voice input all still work.

### A4. Client API address
- Create `client/.env.production` (committed – it holds no secret) with `VITE_API_URL=/api/v1`.
- In `client/src/api/axios.js`, make sure `fileUrl()` works with a relative API URL: `SERVER_ORIGIN` becomes `""`, so `/uploads/...` stays relative.

### A5. Email over HTTPS (Brevo) with an SMTP fallback for local use
- **In `server/services/emailService.js`**, pick the provider in this order:
  1. **`BREVO_API_KEY` set:** send with `fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": KEY, "content-type": "application/json", accept: "application/json" }, body: { sender: { name: EMAIL_FROM_NAME || "FinTrack AI", email: EMAIL_FROM }, to: [{ email: to }], subject, htmlContent } })`.
     - Use a 10 s timeout (`AbortController`).
     - Log failures without the key.
  2. **Otherwise, `EMAIL_USER`/`EMAIL_PASS` set:** use the existing nodemailer SMTP.
  3. **Otherwise:** keep the existing console fallback.
- **Callers:** `isEmailEnabled()` returns true for 1 or 2. Every existing caller (OTP, alerts, reminders) keeps working unchanged.
- **Env template:** add `BREVO_API_KEY`, `EMAIL_FROM` and `EMAIL_FROM_NAME` to `server/.env.example` with comments.

### A6. Build and start scripts for Render
- **Root `package.json`** (new; `"private": true`, no dependencies):
  - `"build": "npm install --include=dev --prefix client && npm run build --prefix client && npm install --prefix server"`
  - `"start": "npm start --prefix server"`
  - `"engines": { "node": ">=20" }`
  - `--include=dev` is required: Render sets `NODE_ENV=production`, and without it Vite and Tailwind (devDependencies) would not install, so the build would fail.
- **Node version:** add a root `.node-version` file containing `22`.

### A7. Time zone and other production settings
- Document in `server/.env.example` that production needs `TZ=Asia/Kolkata`, so "today", streaks and safe-to-spend use Indian days. Render servers run in UTC.
- `DNS_SERVERS` must stay empty on Render.

### A8. Check, document, commit
- Run `npm run build` at the root, then `NODE_ENV=production` with `npm start` at the root, locally.
- The site must load at `http://localhost:5000`, with login, a receipt image, CSV export and the theme working, and no CSP errors in the browser console. If you can't open a browser, check with curl and reason through the code, and say so in the report.
- Then confirm normal `npm run dev` development still works.
- Add this guide's Part B to the README as "Deployment".
- Commit, and report the files changed.

---

## Part B – Your steps (about 40 minutes)

### B1. MongoDB Atlas (database)
1. Go to **cloud.mongodb.com** and sign up (Google login is fine). Click **Build a Database** → **Free** → choose provider **AWS**, region **Mumbai (ap-south-1)** → **Create**.
2. **Database user:** pick a username and an **alphanumeric password** (no `@ : / ?` symbols, which break the link). Save both.
3. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`). Render's free plan has no fixed IP, so this is needed.
4. Click **Connect** → **Drivers**, and copy the `mongodb+srv://...` link. Put your password in it, and add `fintrack` before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/fintrack?retryWrites=true&w=majority`
5. **Move your data** (choose one):
   - **Fresh start + demo data:** in `server`, run in **cmd**:
     `set MONGO_URI=<your atlas link>&& npm run seed`
     (no space before `&&`). Then register your own account on the live site.
   - **Copy your real local data:** with MongoDB Database Tools installed:
     `mongodump --uri="mongodb://127.0.0.1:27017/fintrack" --out=dump`
     `mongorestore --uri="<your atlas link>" dump/fintrack --nsInclude="fintrack.*"`
     Or in **Compass**: export each collection to JSON from local, then import it into Atlas.

### B2. Cloudinary (photo storage)
1. Sign up at **cloudinary.com** (free).
2. On the **Dashboard**, copy **Cloud name**, **API Key** and **API Secret**.

### B3. Brevo (emails)
1. Sign up at **brevo.com** (free, no card). Complete the short profile if it asks.
2. **Senders, Domains & Dedicated IPs** → **Senders** → **Add a sender**: name "FinTrack AI", your Gmail address. Verify it from the email Brevo sends you.
3. **SMTP & API** → **API Keys** → **Generate a new API key**, and copy it.
4. Tip: because the sender is a Gmail address, the first emails may land in **Spam**. Mark them "Not spam".

### B4. Render (the app)
1. Make sure Part A is merged into `main` and pushed (`git push`).
2. Go to **render.com** and sign up **with GitHub**. Click **New** → **Web Service** → choose your `fintrack-ai` repo.
3. Settings:
   - **Branch:** `main`
   - **Root Directory:** *(leave empty)*
   - **Runtime:** Node
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
4. **Environment Variables**:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `TZ` | `Asia/Kolkata` |
   | `MONGO_URI` | your Atlas link |
   | `JWT_SECRET` | a long random text (see below) |
   | `JWT_REFRESH_SECRET` | another, different long random text |
   | `CLIENT_URL` | `https://<your-service-name>.onrender.com` (update it after the first deploy if the name differs) |
   | `GEMINI_API_KEY` | your key |
   | `GEMINI_MODEL` | `gemini-3.5-flash-lite` (or what you use now) |
   | `GEMINI_FALLBACK_MODEL` | `gemini-3.6-flash` |
   | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | from B2 |
   | `BREVO_API_KEY` | from B3 |
   | `EMAIL_FROM` | the Gmail address you verified in Brevo |
   | `EMAIL_FROM_NAME` | `FinTrack AI` |

   To make random secrets, run this twice on your PC:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   Don't add `EMAIL_USER`, `EMAIL_PASS` or `DNS_SERVERS` on Render.
5. Under **Advanced**, set **Health Check Path** to `/api/health`. Click **Create Web Service** and wait for **"Live"** (the first build takes a few minutes).
6. Open `https://<name>.onrender.com`. Register with your email; the code should arrive by email (check Spam). Then test login, add an expense, a receipt scan, Safe to spend and the AI coach.

### B5. Keep it awake (optional, recommended before your demo)
1. Sign up at **cron-job.org** (free) → **Create cronjob**.
2. URL: `https://<name>.onrender.com/api/health`, every **10 minutes**.
3. One service kept awake all month uses about 720 of Render's 750 free hours, so keep only this one free service running. Without the pinger, the first visit after 15 idle minutes takes about a minute, and the reminder jobs only run while it's awake.

### B6. After deploying
- Every `git push` to `main` redeploys automatically.
- Logs: Render dashboard → your service → **Logs**.
- Your local `.env` is never uploaded. Render's **Environment** tab holds the live settings.