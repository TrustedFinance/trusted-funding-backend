import { sendNotification } from '../../utils/notifications.js';
import { Investment, InvestmentPlan } from '../models/Investment.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

// Create user investment
export const createInvestment = async (req, res) => {
  try {
    const { planId, amount } = req.body;

    const plan = await InvestmentPlan.findById(planId);
    if (!plan || !plan.isActive) return res.status(400).json({ message: 'Plan not available' });

    if (amount < plan.minAmount || amount > plan.maxAmount)
      return res.status(400).json({ message: `Amount must be between ${plan.minAmount} and ${plan.maxAmount}` });

    if (req.user.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });

    const payoutAmount = amount * plan.multiplier;
    const startAt = DateTime.now().toJSDate();
    const endAt = DateTime.now().plus({ days: plan.durationDays }).toJSDate();

    const investment = await Investment.create({
      user: req.user._id,
      plan: plan._id,
      amount,
      multiplier: plan.multiplier,
      durationDays: plan.durationDays,
      startAt,
      endAt,
      payoutAmount
    });

    // Update user balance and trades
    await User.findByIdAndUpdate(req.user._id, { $inc: { balance: -amount, 'stats.trades': 1 } });

    // Log transaction
    await Transaction.create({
      user: req.user._id,
      type: 'investment',
      amount: -amount,
      status: 'completed',
      reference: `INV-${investment._id}`
    });

    // Notify user
    await sendNotification(
      req.user._id,
      'investment',
      `You invested ${amount} in ${plan.name}. Payout: ${payoutAmount} in ${plan.durationDays} days.`,
      { investmentId: inv._id }
    );


    res.json({ message: 'Investment created', investment });
  } catch (err) {
    res.status(500).json({ message: 'Investment error', error: err.message });
  }
};

// Get user's investments
export const getUserInvestments = async (req, res) => {
  try {
    const investments = await Investment.find({ user: req.user._id }).populate('plan');
    res.json(investments);
  } catch (err) {
    res.status(500).json({ message: 'Fetch investments failed', error: err.message });
  }
};

// Admin: get all investments
export const getAllInvestments = async (req, res) => {
  try {
    const investments = await Investment.find().populate('plan').populate('user', 'name email');
    res.json(investments);
  } catch (err) {
    res.status(500).json({ message: 'Fetch all investments failed', error: err.message });
  }
};
