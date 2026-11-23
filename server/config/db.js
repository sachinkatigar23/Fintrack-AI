import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);

    if (/ECONNREFUSED/i.test(error.message)) {
      console.error(
        "👉 MongoDB is not running. On Windows: open 'Services', find 'MongoDB Server', and click Start."
      );
    }

    process.exit(1);
  }
};

export default connectDB;
