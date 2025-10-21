import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { InvestmentPlan } from '../models/Investment.js';

dotenv.config();

// ------------------- Admin Register -------------------
export const adminRegister = async (req, res) => {
  try {
    const { name, phone, email, password, masterPassword } = req.body;

    if (masterPassword !== process.env.ADMIN_MASTER_PASSWORD)
      return res.status(401).json({ message: 'Invalid master password' });

    let user = await User.findOne({ phone });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    user = await User.create({
      phone,
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      isVerified: true
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ message: 'Admin registration failed', error: err.message });
  }
};

// ------------------- Admin Login -------------------
export const adminLogin = async (req, res) => {
  try {
    const { phone, email, password, masterPassword } = req.body;

    // Allow login by either phone or email
    let user = phone
      ? await User.findOne({ phone })
      : await User.findOne({ email });

    // Master password bypass
    if (masterPassword && masterPassword === process.env.ADMIN_MASTER_PASSWORD) {
      if (!user) {
        user = await User.create({
          name: 'Admin User',
          email,
          phone,
          role: 'admin',
          isVerified: true,
          password: await bcrypt.hash('defaultPassword123', 10)
        });
      }
    } else {
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ message: 'Admin login failed', error: err.message });
  }
};

// ------------------- Block User -------------------
export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
    if (!u) return res.status(404).json({ message: 'User not found' });
    res.json(u);
  } catch (err) {
    res.status(500).json({ message: 'Error blocking user', error: err.message });
  }
};

// ------------------- Delete User -------------------
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
};

// ------------------- Create Investment Plan -------------------
export const createPlan = async (req, res) => {
  try {
    const { name, minAmount, maxAmount, multiplier, durationDays, description } = req.body;
    const plan = await InvestmentPlan.create({
      name,
      minAmount,
      maxAmount,
      multiplier,
      durationDays,
      description
    });
    res.json({ message: 'Plan created', plan });
  } catch (err) {
    res.status(500).json({ message: 'Create plan failed', error: err.message });
  }
};

// ------------------- Edit Investment Plan -------------------
export const editPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await InvestmentPlan.findByIdAndUpdate(id, req.body, { new: true });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json({ message: 'Plan updated', plan });
  } catch (err) {
    res.status(500).json({ message: 'Edit plan failed', error: err.message });
  }
};

// ------------------- Delete Investment Plan -------------------
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    await InvestmentPlan.findByIdAndDelete(id);
    res.json({ message: 'Plan deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete plan failed', error: err.message });
  }
};

// ------------------- Get All Plans -------------------
export const getAllPlans = async (req, res) => {
  try {
    const plans = await InvestmentPlan.find();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: 'Fetch plans failed', error: err.message });
  }
};
