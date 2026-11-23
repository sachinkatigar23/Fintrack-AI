import rateLimit from "express-rate-limit";

const json = (message) => ({ success: false, message });

// General API throttle
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: json("Too many requests. Please slow down."),
});

// Login / register / password reset - protects against brute force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json("Too many attempts. Please try again in a few minutes."),
});

// AI endpoints - keeps usage of the AI provider under control
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: json("AI is busy. Please wait a moment and try again."),
});
