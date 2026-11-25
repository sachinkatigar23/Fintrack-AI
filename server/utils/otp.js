// One-time codes for email verification. The code itself is never stored or
// returned by the API - only its SHA-256 hash is kept on the user.
import crypto from "crypto";

export const OTP_TTL_MS = 10 * 60 * 1000; // valid for 10 minutes
export const OTP_MAX_ATTEMPTS = 5; // wrong tries before a new code is needed
export const OTP_RESEND_GAP_MS = 60 * 1000; // at least 60 s between sends
export const OTP_MAX_SENDS_PER_HOUR = 5;

// 6 digits, uniformly random (000000-999999)
export const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

export const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

// Constant-time comparison of a typed code with the stored hash
export const verifyOtp = (otp, storedHash) => {
  if (!storedHash || !/^\d{6}$/.test(String(otp ?? ""))) return false;
  const a = Buffer.from(hashOtp(otp), "hex");
  const b = Buffer.from(String(storedHash), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * May a new code be sent now? (pure)
 * state: { sentAt, windowStart, sendCount } from the user
 * -> { allowed: true, windowStart, sendCount } or { allowed: false, retryAfter (seconds) }
 */
export const canSendOtp = ({ sentAt, windowStart, sendCount } = {}, now = new Date()) => {
  const t = now.getTime();
  if (sentAt && t - new Date(sentAt).getTime() < OTP_RESEND_GAP_MS) {
    return { allowed: false, retryAfter: Math.ceil((OTP_RESEND_GAP_MS - (t - new Date(sentAt).getTime())) / 1000) };
  }
  const inWindow = windowStart && t - new Date(windowStart).getTime() < 60 * 60 * 1000;
  const count = inWindow ? Number(sendCount) || 0 : 0;
  if (count >= OTP_MAX_SENDS_PER_HOUR) {
    return { allowed: false, retryAfter: Math.ceil((60 * 60 * 1000 - (t - new Date(windowStart).getTime())) / 1000) };
  }
  return { allowed: true, windowStart: inWindow ? new Date(windowStart) : now, sendCount: count + 1 };
};
