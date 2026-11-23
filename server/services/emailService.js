import nodemailer from "nodemailer";

// Email is optional. If EMAIL_USER / EMAIL_PASS are not set, messages are
// printed to the server console instead (handy during development).
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

const layout = (title, body) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
    <h2 style="margin:0 0 12px;color:#5B47E0">FinTrack AI</h2>
    <h3 style="margin:0 0 12px;color:#111827">${title}</h3>
    <div style="color:#374151;font-size:14px;line-height:1.6">${body}</div>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Manage Smarter. Spend Better.</p>
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
