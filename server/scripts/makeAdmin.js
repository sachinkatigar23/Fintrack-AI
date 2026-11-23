// Give an existing account the admin role:
//   npm run make-admin -- someone@example.com
import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const email = (process.argv[2] || "").toLowerCase().trim();

if (!email) {
  console.log("Usage: npm run make-admin -- your@email.com");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const user = await User.findOneAndUpdate({ email }, { role: "admin" }, { returnDocument: "after" });
console.log(user ? `✅ ${user.email} is now an admin. Log out and log in again.` : `❌ No user found with email ${email}`);
await mongoose.disconnect();
