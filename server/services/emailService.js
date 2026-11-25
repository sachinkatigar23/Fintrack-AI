import nodemailer from "nodemailer";

// Email is optional. If EMAIL_USER / EMAIL_PASS are not set, messages are
// printed to the server console instead (handy during development - this is
// also where a verification code can be read when email isn't configured).
let transporter = null;

const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
};

export const isEmailEnabled = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const clientUrl = () => (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();

// One layout for every email: header, clear title, body, footer
export const layout = (title, body) => `
  <div style="background:#f4f6fb;padding:24px 12px">
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7C6BFF,#5B47E0);padding:16px 24px">
        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.2px">FinTrack <span style="font-style:italic">AI</span></span>
      </div>
      <div style="padding:24px">
        <h2 style="margin:0 0 14px;color:#111827;font-size:20px">${title}</h2>
        <div style="color:#374151;font-size:14px;line-height:1.6">${body}</div>
      </div>
      <div style="padding:14px 24px;border-top:1px solid #eef0f5;color:#9ca3af;font-size:12px;line-height:1.5">
        You're receiving this because you have a FinTrack AI account.
      </div>
    </div>
  </div>`;

export const sendEmail = async ({ to, subject, title, html }) => {
  const t = getTransporter();
  if (!t) {
    console.log(`📧 [email disabled] To: ${to} | ${subject}\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
    return false;
  }
  try {
    await t.sendMail({
      from: `"FinTrack AI" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: layout(title || subject, html),
    });
    return true;
  } catch (error) {
    console.error("Email error:", error.message);
    return false;
  }
};

const first = (name) => escapeHtml(String(name || "there").split(" ")[0]);

// ───────── Security emails (always sent) ─────────
export const sendOtpEmail = (user, code) =>
  sendEmail({
    to: user.email,
    subject: "Your FinTrack AI verification code",
    title: "Verify your email",
    html: `Hi ${first(user.name)},<br/>Use this code to finish creating your account:
      <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#5B47E0;background:#f4f2ff;border-radius:12px;padding:14px 0;text-align:center;margin:18px 0;font-family:'Courier New',monospace">${code}</div>
      The code is valid for 10 minutes.<br/><br/>If you didn't sign up, ignore this email.`,
  });

export const sendPasswordChangedEmail = (user, when = new Date()) =>
  sendEmail({
    to: user.email,
    subject: "Your FinTrack AI password was changed",
    title: "Your password was changed",
    html: `Hi ${first(user.name)},<br/>The password for your FinTrack AI account was changed on ${escapeHtml(formatIST(when))} (IST).<br/><br/>
      If this wasn't you, reset your password now: <a href="${clientUrl()}/forgot-password">${clientUrl()}/forgot-password</a>`,
  });

// ───────── Account emails ─────────
export const sendWelcomeEmail = (user) =>
  sendEmail({
    to: user.email,
    subject: "Welcome to FinTrack AI",
    title: `Welcome, ${first(user.name)}!`,
    html: `Your email is verified and your account is ready.<br/><br/>
      A good start: add this month's income, a few expenses, and set your starting balance in Profile → Money settings – then check <b>Safe to spend</b> on your dashboard.<br/><br/>
      <a href="${clientUrl()}/dashboard" style="display:inline-block;background:#5B47E0;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Open FinTrack AI</a>`,
  });

export const formatIST = (date) =>
  new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const sendLoginAlert = (user, { when = new Date(), device = "Unknown device", ip = "" } = {}) =>
  sendEmail({
    to: user.email,
    subject: "New sign-in to FinTrack AI",
    title: "New sign-in to FinTrack AI",
    html: `Hi ${first(user.name)},<br/>Your account was just signed in to:<br/><br/>
      <table style="font-size:14px;color:#374151;border-collapse:collapse">
        <tr><td style="padding:3px 14px 3px 0;color:#6b7280">When</td><td>${escapeHtml(formatIST(when))} (IST)</td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#6b7280">Device</td><td>${escapeHtml(device)}</td></tr>
        <tr><td style="padding:3px 14px 3px 0;color:#6b7280">IP address</td><td>${escapeHtml(ip || "unknown")}</td></tr>
      </table><br/>
      If this wasn't you, reset your password: <a href="${clientUrl()}/forgot-password">${clientUrl()}/forgot-password</a><br/>
      <span style="color:#9ca3af;font-size:12px">You can turn these alerts off in Profile → Notifications &amp; security.</span>`,
  });
