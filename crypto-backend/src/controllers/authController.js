import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/index.js';


const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET || 'default_secret';
const JWT_EXPIRES_IN = config.jwtExpiresIn || '7d';

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export const register = async (req, res) => {
  try {
    const { email, password, name, country, currency, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });

    const user = await User.create({ email, password, name, country, currency, phone });
    const token = signToken(user);

    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ message: 'Registration error', error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ message: 'Login error', error: err.message });
  }
};

export const logout = async (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

export const forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body; // using phone instead of email

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: 'No user found with that phone number' });

    // generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes expiry
    await user.save();

    // return token to client (for dev or SMS integration)
    res.json({
      message: 'Password reset token generated successfully',
      token: resetToken,
      expiresIn: '15 minutes'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Error generating reset token', error: err.message });
  }
};

// ------------------- Reset Password -------------------
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password)
      return res.status(400).json({ message: 'Token and new password are required' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() } // check token still valid
    });

    if (!user)
      return res.status(400).json({ message: 'Invalid or expired reset token' });

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Error resetting password', error: err.message });
  }
};