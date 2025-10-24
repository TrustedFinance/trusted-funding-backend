// middlewares/admin.js
const admin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin role required' });
  }
  next();
};

export default admin;
