import mongoose from "mongoose";

// The user's choices for one detected subscription (identified by its merchant key)
const subscriptionPrefSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    key: { type: String, required: true, trim: true, maxlength: 80 },
    // "Not a subscription": hidden from the list and from reminders
    dismissed: { type: Boolean, default: false },
    // Renewal / price-change reminders
    remind: { type: Boolean, default: true },
  },
  { timestamps: true }
);

subscriptionPrefSchema.index({ user: 1, key: 1 }, { unique: true });

export default mongoose.model("SubscriptionPref", subscriptionPrefSchema);
