import User from "../models/User.js";


 const admin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin role required" });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

export default admin;