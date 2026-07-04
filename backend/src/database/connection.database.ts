import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error("MongoDB connection failed: MONGODB_URI is not set");
      process.exit(1);
    }

    await mongoose.connect(uri);

    console.log("MongoDB connected");
  } catch (error) {
    console.error(" MongoDB connection failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

export default connectDB;