import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
} from "../utils/authUtils.js";
import { audit } from "../services/auditService.js";
import {
  sendEmail,
  isEmailEnabled,
  sendOtpEmail,
  sendWelcomeEmail,
  sendLoginAlert,
  sendPasswordChangedEmail,
} from "../services/emailService.js";
import { notify } from "../services/notificationService.js";
import { generateOtp, hashOtp, verifyOtp, canSendOtp, OTP_TTL_MS, OTP_MAX_ATTEMPTS } from "../utils/otp.js";
import { checkEmailDomain, UNDELIVERABLE_MESSAGE } from "../utils/emailDomain.js";
import { describeDevice } from "../utils/userAgent.js";

const OTP_FIELDS = "+emailOtpHash +emailOtpExpires +emailOtpAttempts +emailOtpSentAt +emailOtpSendCount +emailOtpWindowStart";

// The user object returned by login / verify-email (same shape everywhere)
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  currency: user.currency,
  avatarUrl: user.avatarUrl,
  darkModePref: user.darkModePref,
  openingBalance: user.openingBalance,
  salaryDay: user.salaryDay,
  safetyBuffer: user.safetyBuffer,
  emailVerified: user.emailVerified !== false,
  loginAlerts: user.loginAlerts !== false,
  emailAlerts: user.emailAlerts !== false,
});

// Access token in the response, refresh token in an HTTP-only cookie
const issueTokens = (res, user) => {
  const accessToken = generateAccessToken(user);
  res.cookie("refreshToken", generateRefreshToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return accessToken;
};

/**
 * Send a fresh verification code if the throttle allows it (60 s gap, 5 per hour).
 * The code is only emailed (or printed by the dev console fallback) - never returned.
 * Returns { sent, retryAfter }
 */
const sendVerificationCode = async (user) => {
  const decision = canSendOtp({
    sentAt: user.emailOtpSentAt,
    windowStart: user.emailOtpWindowStart,
    sendCount: user.emailOtpSendCount,
  });
  if (!decision.allowed) return { sent: false, retryAfter: decision.retryAfter };

  const code = generateOtp();
  user.emailOtpHash = hashOtp(code);
  user.emailOtpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.emailOtpAttempts = 0;
  user.emailOtpSentAt = new Date();
  user.emailOtpWindowStart = decision.windowStart;
  user.emailOtpSendCount = decision.sendCount;
  await user.save();
  await sendOtpEmail(user, code);
  return { sent: true, retryAfter: 60 };
};

const verificationInfo = (user, result) => ({
  needsVerification: true,
  email: user.email,
  emailEnabled: isEmailEnabled(),
  expiresIn: user.emailOtpExpires ? Math.max(0, Math.round((new Date(user.emailOtpExpires) - Date.now()) / 1000)) : 0,
  retryAfter: result.retryAfter,
});

// POST /auth/register  { name, email, password } -> sends a 6-digit code; no tokens until the email is verified
export const register = async (req, res) => {
  try {
    const { name, email, password, currency } = req.body;

    // The domain must be able to receive mail (offline / DNS errors are allowed through)
    const domain = await checkEmailDomain(email);
    if (!domain.ok) return res.status(400).json({ success: false, message: UNDELIVERABLE_MESSAGE });

    let user = await User.findOne({ email }).select(OTP_FIELDS);

    if (user && user.emailVerified !== false) {
      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    const passwordHash = await hashPassword(password);

    if (user) {
      // Registered before but never verified: take the new details and send a fresh code
      user.name = name;
      user.passwordHash = passwordHash;
      if (currency) user.currency = currency;
    } else {
      user = new User({ name, email, passwordHash, currency: currency || "INR", emailVerified: false });
    }
    await user.save();

    const result = await sendVerificationCode(user);
    await audit(req, "register", user._id);

    return res.status(201).json({
      success: true,
      message: result.sent ? "We've sent a 6-digit code to your email" : "Use the code we sent you a moment ago",
      data: verificationInfo(user, result),
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ success: false, message: "Server error during registration" });
  }
};

// POST /auth/verify-email  { email, otp } -> same response as login
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email }).select(OTP_FIELDS);

    if (!user || user.emailVerified !== false) {
      return res.status(400).json({ success: false, message: "This account doesn't need verification. Try logging in." });
    }
    if (!user.emailOtpHash || !user.emailOtpExpires || user.emailOtpExpires < new Date()) {
      return res.status(400).json({ success: false, message: "Code expired – request a new one" });
    }
    if ((user.emailOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ success: false, message: "Too many attempts – request a new code" });
    }
    if (!verifyOtp(otp, user.emailOtpHash)) {
      user.emailOtpAttempts = (user.emailOtpAttempts || 0) + 1;
      await user.save();
      const left = Math.max(0, OTP_MAX_ATTEMPTS - user.emailOtpAttempts);
      return res.status(400).json({ success: false, message: `Incorrect code (${left} ${left === 1 ? "try" : "tries"} left)`, triesLeft: left });
    }

    user.emailVerified = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpires = undefined;
    user.emailOtpAttempts = undefined;
    user.emailOtpSentAt = undefined;
    user.emailOtpSendCount = undefined;
    user.emailOtpWindowStart = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = issueTokens(res, user);

    await sendWelcomeEmail(user);
    await notify(user._id, {
      type: "system",
      title: `Welcome to FinTrack AI, ${user.name.split(" ")[0]}!`,
      message: "Start by adding your income and a few expenses. Your dashboard and AI insights update automatically.",
      link: "/transactions",
      key: "welcome",
    });
    await audit(req, "verify-email", user._id);

    return res.status(200).json({
      success: true,
      message: "Email verified",
      data: { user: publicUser(user), accessToken },
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ success: false, message: "Server error during verification" });
  }
};

// POST /auth/resend-otp  { email } - neutral answer; retryAfter when throttled
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const neutral = "If this email is waiting for verification, a new code has been sent.";
    const user = await User.findOne({ email }).select(OTP_FIELDS);

    if (!user || user.emailVerified !== false) {
      return res.status(200).json({ success: true, message: neutral, data: { emailEnabled: isEmailEnabled() } });
    }

    const result = await sendVerificationCode(user);
    if (!result.sent) {
      return res.status(200).json({
        success: true,
        message: `Please wait ${result.retryAfter} s before requesting another code.`,
        data: { retryAfter: result.retryAfter, emailEnabled: isEmailEnabled() },
      });
    }
    await audit(req, "resend-otp", user._id);
    return res.status(200).json({ success: true, message: neutral, data: verificationInfo(user, result) });
  } catch (error) {
    console.error("Resend code error:", error);
    return res.status(500).json({ success: false, message: "Server error while sending the code" });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select(OTP_FIELDS);

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const isPasswordCorrect = await comparePassword(password, user.passwordHash);
    if (!isPasswordCorrect) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Blocked by an administrator
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact the administrator.",
      });
    }

    // Not verified yet: send a new code (respecting the 60 s rule) and ask for it
    if (user.emailVerified === false) {
      const result = await sendVerificationCode(user);
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email first – we've sent you a new code.",
        data: verificationInfo(user, result),
      });
    }

    user.lastLoginAt = new Date();
    await user.save();
    await audit(req, "login", user._id);

    const accessToken = issueTokens(res, user);

    // New sign-in alert (not on token refresh); doesn't hold up the login
    if (user.loginAlerts !== false) {
      sendLoginAlert(user, { when: user.lastLoginAt, device: describeDevice(req.get("user-agent")), ip: req.ip }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: { user: publicUser(user), accessToken },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Server error during login" });
  }
};

// Logout user
export const logout = async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ success: false, message: "Server error during logout" });
  }
};

// Refresh access token
export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh token not found" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact the administrator.",
      });
    }

    const accessToken = generateAccessToken(user);

    return res.status(200).json({ success: true, message: "Access token refreshed", data: { accessToken } });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }
};

// Get current logged-in user
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching user" });
  }
};

// Forgot password - emails a reset link valid for 30 minutes
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Same answer whether or not the email exists (prevents account discovery)
    const message = "If an account exists for this email, a reset link has been sent.";

    if (!user) {
      return res.status(200).json({ success: true, message });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();
    const link = `${clientUrl}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your FinTrack AI password",
      title: "Password reset",
      html: `Hi ${user.name},<br/>Click the link below to set a new password. It is valid for 30 minutes.<br/><br/><a href="${link}">${link}</a><br/><br/>If you did not request this, you can ignore this email.`,
    });

    await audit(req, "forgot-password", user._id);

    return res.status(200).json({ success: true, message });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ success: false, message: "Server error while requesting password reset" });
  }
};

// Reset password using the emailed token
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const hashed = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });
    }

    user.passwordHash = await hashPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await audit(req, "reset-password", user._id);
    await sendPasswordChangedEmail(user);

    return res.status(200).json({ success: true, message: "Password updated. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, message: "Server error while resetting password" });
  }
};

// Change password (logged-in user)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const ok = await comparePassword(currentPassword, user.passwordHash);

    if (!ok) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await audit(req, "change-password", user._id);
    await sendPasswordChangedEmail(user);

    return res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Server error while changing password" });
  }
};
