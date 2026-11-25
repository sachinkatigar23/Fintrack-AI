import express from "express";

import {
  register,
  login,
  logout,
  refreshAccessToken,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendOtp,
} from "../../controllers/authController.js";

import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  verifyEmailValidator,
  resendOtpValidator,
} from "../../validators/authValidator.js";

import { validate } from "../../middleware/validate.js";
import { protect } from "../../middleware/auth.middleware.js";
import { authLimiter } from "../../middleware/rateLimiter.js";

const router = express.Router();

// Register
router.post(
  "/register",
  authLimiter,
  registerValidator,
  validate,
  register
);

// Login
router.post(
  "/login",
  authLimiter,
  loginValidator,
  validate,
  login
);

// Email verification (6-digit code)
router.post("/verify-email", authLimiter, verifyEmailValidator, validate, verifyEmail);
router.post("/resend-otp", authLimiter, resendOtpValidator, validate, resendOtp);

// Logout
router.post("/logout", logout);

// Refresh access token
router.post("/refresh", refreshAccessToken);

// Current user
router.get("/me", protect, getCurrentUser);

// Password recovery
router.post("/forgot-password", authLimiter, forgotPasswordValidator, validate, forgotPassword);
router.post("/reset-password", authLimiter, resetPasswordValidator, validate, resetPassword);
router.put("/change-password", protect, changePasswordValidator, validate, changePassword);

export default router;
