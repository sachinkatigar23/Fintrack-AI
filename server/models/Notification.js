import mongoose from "mongoose";
import { NOTIFICATION_TYPES } from "../utils/constants.js";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "system" },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
    // Prevents the same alert being created twice (e.g. "budget:<id>:80")
    key: { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, key: 1 }, { unique: true, partialFilterExpression: { key: { $type: "string" } } });

export default mongoose.model("Notification", notificationSchema);
