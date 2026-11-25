import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import v1Routes from "./routes/v1/index.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Behind Render's proxy: trust the first hop so req.ip, secure cookies and
// express-rate-limit see the real client address and protocol.
app.set("trust proxy", 1);

// Credentialed browser requests must use an explicit allowed origin; `*` is
// rejected by browsers whenever Axios sends cookies (`withCredentials: true`).
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// CSP fits the built React app served from this server (production). No inline
// scripts are needed: the theme script lives in client/public/theme-init.js.
// crossOriginResourcePolicy lets the dev React app (another port) show images.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // Helmet adds this by default; it can break plain http://localhost in
        // some browsers. Render serves HTTPS anyway (and HSTS stays on).
        upgradeInsecureRequests: null,
      },
    },
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Locally stored uploads (used when Cloudinary is not configured)
app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "FinTrack AI API is running" });
});

app.use("/api/v1", apiLimiter, v1Routes);

// Production: serve the built React app (client/dist) from this server, so the
// site and the API share one origin. In development Vite serves the client.
if (isProduction) {
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");
  app.use(express.static(clientDist, { index: false }));

  // SPA fallback (Express 5 safe - no "*" route): any other GET page request
  // that isn't /api or /uploads gets index.html so React Router can handle it.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (/^\/(api|uploads)(\/|$)/.test(req.path)) return next();
    res.sendFile(path.join(clientDist, "index.html"), (err) => err && next(err));
  });
}

// 404 + central error handler (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;
