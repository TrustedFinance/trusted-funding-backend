import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv';
import User from '../models/User.js';
import { InvestmentPlan } from '../models/Investment.js';
import Transaction from '../models/Transaction.js';

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
      role: 'admin'
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Admin registration failed', error: err.message });
  }
};

// ------------------- Admin Login -------------------
export const adminLogin = async (req, res) => {
  try {
    const { phone, email, password, masterPassword } = req.body;

    // Allow login by either phone or email
    let admin = phone
      ? await User.findOne({ phone })
      : await User.findOne({ email });

    // Master password bypass
    if (masterPassword && masterPassword === process.env.ADMIN_MASTER_PASSWORD) {
      if (!admin) {
        admin = await User.create({
          name: 'Admin User',
          email,
          phone,
          role: 'admin',
          password: await bcrypt.hash('defaultPassword123', 10)
        });
      }
    } else {
      if (!admin || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ admin, token });
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

export const getLeaderboard = async (req, res) => {
  try {
    const { type, startDate, endDate, limit = 20 } = req.query;

    const match = {};
    if (type) match.type = type;
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const leaderboard = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$user',
          totalVolume: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { totalVolume: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$user._id',
          name: '$user.fullname',
          email: '$user.email',
          totalVolume: 1,
          transactionCount: 1
        }
      }
    ]);

    res.json({ leaderboard });
  } catch (err) {
    console.error('leaderboard error', err);
    res.status(500).json({ message: 'Error fetching leaderboard', error: err.message });
  }
};

export const getPendingAndDue = async (req, res) => {
  try {
    // 1️⃣ Pending deposits
    const pendingDeposits = await Transaction.find({
      type: 'deposit',
      status: 'pending'
    })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    // 2️⃣ Pending withdrawals
    const pendingWithdrawals = await Transaction.find({
      type: 'withdrawal',
      status: 'pending'
    })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    // 3️⃣ Due investments
    const now = DateTime.now().toJSDate();
    const dueInvestments = await Investment.find({
      status: 'active',
      endAt: { $lte: now }
    })
      .populate('user', 'name email phone')
      .populate('plan', 'name multiplier durationDays')
      .sort({ endAt: 1 });

    res.json({
      message: 'Fetched pending and due items successfully',
      pendingDeposits,
      pendingWithdrawals,
      dueInvestments,
      summary: {
        pendingDeposits: pendingDeposits.length,
        pendingWithdrawals: pendingWithdrawals.length,
        dueInvestments: dueInvestments.length
      }
    });
  } catch (err) {
    console.error('getPendingAndDue error', err);
    res.status(500).json({ message: 'Error fetching pending and due items', error: err.message });
  }
};

export const getInvestmentsDueTomorrow = async (req, res) => {
  try {
    // Start and end of tomorrow using Luxon
    const tomorrowStart = DateTime.now().plus({ days: 1 }).startOf('day').toJSDate();
    const tomorrowEnd = DateTime.now().plus({ days: 1 }).endOf('day').toJSDate();

    const dueTomorrow = await Investment.find({
      status: 'active',
      endAt: { $gte: tomorrowStart, $lte: tomorrowEnd }
    })
      .populate('user', 'name email phone')
      .populate('plan', 'name multiplier durationDays')
      .sort({ endAt: 1 });

    res.json({
      message: 'Fetched investments due tomorrow successfully',
      dateRange: { from: tomorrowStart, to: tomorrowEnd },
      total: dueTomorrow.length,
      investments: dueTomorrow
    });
  } catch (err) {
    console.error('getInvestmentsDueTomorrow error', err);
    res.status(500).json({ message: 'Error fetching due investments', error: err.message });
  }
};