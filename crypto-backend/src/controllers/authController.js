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
