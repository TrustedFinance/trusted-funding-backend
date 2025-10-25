import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';
import User from '../models/User.js';
import { Investment } from '../models/Investment.js';
import { InvestmentPlan } from '../models/Investment.js';
import Transaction from '../models/Transaction.js';
import { convertUSDToFiat } from '../../utils/rateConverter.js';

dotenv.config();

// Helper to create JWT
const createToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ------------------- Admin Register -------------------
export const adminRegister = async (req, res) => {
  try {
    const { name, phone, email, password, masterPassword } = req.body;

    if (masterPassword !== process.env.ADMIN_MASTER_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Invalid master password' });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      phone,
      email,
      password: hashed,
      role: 'admin',
    });

    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: { user, token },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Admin registration failed',
      error: err.message,
    });
  }
};

// ------------------- Admin Login -------------------
export const adminLogin = async (req, res) => {
  try {
    const { phone, email, password, masterPassword } = req.body;

    let admin = phone
      ? await User.findOne({ phone })
      : await User.findOne({ email });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Allow master password login (but don’t auto-create)
    if (masterPassword && masterPassword === process.env.ADMIN_MASTER_PASSWORD) {
      // pass
    } else {
      const match = await bcrypt.compare(password, admin.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    const token = createToken(admin);

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: { user: admin, token },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Admin login failed',
      error: err.message,
    });
  }
};

// ------------------- Block User -------------------
export const blockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: true }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      message: 'User blocked successfully',
      data: { user },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error blocking user',
      error: err.message,
    });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: false }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
      data: { user },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error unblocking user',
      error: err.message,
    });
  }
};

// ------------------- Delete User -------------------
export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: err.message,
    });
  }
};

// controllers/planController.js

export const getAllPlans = async (req, res) => {
  try {
    const plans = await InvestmentPlan.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      plans,
    });
  } catch (err) {
    console.error('❌ Error fetching public plans:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans',
      error: err.message,
    });
  }
};

// ------------------- Create Investment Plan -------------------
export const createPlan = async (req, res) => {
  try {
    const plan = await InvestmentPlan.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Investment plan created successfully',
      data: { plan },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Create plan failed',
      error: err.message,
    });
  }
};

// ------------------- Edit Investment Plan -------------------
export const editPlan = async (req, res) => {
  try {
    const plan = await InvestmentPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    res.status(200).json({
      success: true,
      message: 'Plan updated successfully',
      data: { plan },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Edit plan failed',
      error: err.message,
    });
  }
};

// ------------------- Delete Investment Plan -------------------
export const deletePlan = async (req, res) => {
  try {
    await InvestmentPlan.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Delete plan failed',
      error: err.message,
    });
  }
};

// ------------------- Leaderboard -------------------
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
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalVolume: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          userId: '$user._id',
          name: '$user.name',
          email: '$user.email',
          totalVolume: 1,
          transactionCount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: 'Fetched leaderboard successfully',
      data: { leaderboard },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching leaderboard',
      error: err.message,
    });
  }
};

// ------------------- Pending & Due -------------------
export const getPendingAndDue = async (req, res) => {
  try {
    const pendingDeposits = await Transaction.find({
      type: 'deposit',
      status: 'pending',
    })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    const pendingWithdrawals = await Transaction.find({
      type: 'withdrawal',
      status: 'pending',
    })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    const now = DateTime.now().toJSDate();
    const dueInvestments = await Investment.find({
      status: 'active',
      endAt: { $lte: now },
    })
      .populate('user', 'name email phone')
      .populate('plan', 'name multiplier durationDays')
      .sort({ endAt: 1 });

    res.status(200).json({
      success: true,
      message: 'Fetched pending and due items successfully',
      data: {
        pendingDeposits,
        pendingWithdrawals,
        dueInvestments,
        summary: {
          pendingDeposits: pendingDeposits.length,
          pendingWithdrawals: pendingWithdrawals.length,
          dueInvestments: dueInvestments.length,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending and due items',
      error: err.message,
    });
  }
};

// ------------------- Due Tomorrow -------------------
export const getInvestmentsDueTomorrow = async (req, res) => {
  try {
    const tomorrowStart = DateTime.now().plus({ days: 1 }).startOf('day').toJSDate();
    const tomorrowEnd = DateTime.now().plus({ days: 1 }).endOf('day').toJSDate();

    const investments = await Investment.find({
      status: 'active',
      endAt: { $gte: tomorrowStart, $lte: tomorrowEnd },
    })
      .populate('user', 'name email phone')
      .populate('plan', 'name multiplier durationDays')
      .sort({ endAt: 1 });

    res.status(200).json({
      success: true,
      message: 'Fetched investments due tomorrow successfully',
      data: {
        dateRange: { from: tomorrowStart, to: tomorrowEnd },
        total: investments.length,
        investments,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching due investments',
      error: err.message,
    });
  }
};

// ------------------- List All Users (with search, pagination) -------------------
export const listAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sort = '-createdAt' } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password');

    res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: {
        count: users.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        users,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error listing users',
      error: err.message,
    });
  }
};
