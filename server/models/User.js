import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    currency: {
      type: String,
      default: "INR",
    },

    avatarUrl: {
      type: String,
      default: "",
    },

    darkModePref: {
      type: Boolean,
      default: false,
    },

    // Admin can block an account (blocked users cannot log in)
    isBlocked: {
      type: Boolean,
      default: false,
    },

    // ── Money settings (used by Safe to spend) ──
    // Money the user already had when they started using FinTrack
    openingBalance: {
      type: Number,
      default: 0,
    },

    // Day of the month salary usually arrives (used when there is no recurring income rule)
    salaryDay: {
      type: Number,
      default: 1,
      min: 1,
      max: 31,
    },

    // Amount that is never counted as spendable
    safetyBuffer: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastLoginAt: {
      type: Date,
    },

    // Password reset (emailed link)
    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
