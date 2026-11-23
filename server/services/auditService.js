import AuditLog from "../models/AuditLog.js";

// Never let audit logging break the actual request
export const audit = async (req, action, userId, details = "") => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      ip: req.ip || "",
      userAgent: req.get?.("user-agent") || "",
      details,
    });
  } catch (error) {
    console.error("Audit log error:", error.message);
  }
};
