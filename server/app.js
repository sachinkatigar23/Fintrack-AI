import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import v1Routes from "./routes/v1/index.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

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

// Allow the React app (another port) to display receipt / avatar images
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
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

// 404 + central error handler (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;
