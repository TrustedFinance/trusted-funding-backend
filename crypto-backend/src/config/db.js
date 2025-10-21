import { connect } from "mongoose";

export const connectDB = async (mongoUri) => {
  try {
    await connect(mongoUri, {
      dbName: "cryptodb",
      autoIndex: true
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error", err);
    throw err;
  }
};
