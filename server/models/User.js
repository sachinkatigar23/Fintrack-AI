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
