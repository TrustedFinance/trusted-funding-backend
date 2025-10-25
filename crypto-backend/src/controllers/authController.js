import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import crypto from 'crypto';
import config from '../config/index.js';
import { getFiatBalance, getTopCoins } from '../../utils/balanceUtils.js';

const JWT_SECRET = config.jwtSecret || process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('Missing JWT_SECRET');
const JWT_EXPIRES_IN = config.jwtExpiresIn || '7d';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export const register = async (req, res) => {
  try {
    const { email, password, name, country, currency, phone } = req.body;

    // Check if user exists
    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ success: false, message: 'Email already exists' });

    // Fetch top 50 crypto symbols
    const topCoins = await getTopCoins(50); // e.g. ['BTC', 'ETH', 'USDT', ...]

    // Initialize balances map with all 0
    const balances = new Map();
    topCoins.forEach(symbol => balances.set(symbol.toUpperCase(), 0));

    // Create user with initialized balances
    const user = await User.create({
      email,
      password,
      name,
      country,
      currency,
      phone,
      balances,
    });

    // Generate token
    const token = signToken(user);

    // Calculate fiat equivalent of total balance
    const fiatBalance = await getFiatBalance(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        balances: Object.fromEntries(user.balances),
        balance: fiatBalance,
        currency: user.currency,
      },
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ success: false, message: 'Registration error', error: err.message });
  }
};

// ---------------- LOGIN ----------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok)
      return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const token = signToken(user);
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email, name: user.name },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login error', error: err.message });
  }
};

// ---------------- LOGOUT ----------------
export const logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};

// ---------------- FORGOT PASSWORD ----------------
export const forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user)
      return res.status(404).json({ success: false, message: 'No user found with that phone' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    if (process.env.NODE_ENV === 'development') {
      res.json({
        success: true,
        message: 'Reset token (dev mode only)',
        token: resetToken,
        expiresIn: '15 minutes',
      });
    } else {
      res.json({ success: true, message: 'Password reset instructions sent' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error generating reset token', error: err.message });
  }
};

// ---------------- RESET PASSWORD ----------------
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ success: false, message: 'Token and password required' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });

    user.password = password; // will hash automatically in model
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error resetting password', error: err.message });
  }
};
