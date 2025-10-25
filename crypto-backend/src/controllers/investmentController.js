import { sendNotification } from '../../utils/notifications.js';
import { convertFiatToUSD, convertUSDToFiat } from '../../utils/rateConverter.js';
import { Investment, InvestmentPlan } from '../models/Investment.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

// Create user investment
export const createInvestment = async (req, res) => {
  try {
    const { planId, amount } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const plan = await InvestmentPlan.findById(planId);
    if (!plan || !plan.isActive) return res.status(400).json({ message: 'Plan not available' });

    // Convert user's fiat amount back to USD for validation
    const { usd: amountInUSD, rate } = await convertFiatToUSD(amount, user.currency);

    // Validate USD amount against plan thresholds
    if (amountInUSD < plan.minAmount || amountInUSD > plan.maxAmount)
      return res.status(400).json({
        message: `Amount must be between ${plan.minAmount} and ${plan.maxAmount} USD (your currency rate: ${rate})`,
      });

    // Ensure balance is enough in fiat
    if (user.balance < amount)
      return res.status(400).json({ message: 'Insufficient balance' });

    const payoutAmount = amount * plan.multiplier;
    const startAt = DateTime.now().toJSDate();
    const endAt = DateTime.now().plus({ days: plan.durationDays }).toJSDate();

    const investment = await Investment.create({
      user: user._id,
      plan: plan._id,
      amount, // store as user's fiat input
      multiplier: plan.multiplier,
      durationDays: plan.durationDays,
      startAt,
      endAt,
      payoutAmount,
      currency: user.currency, // optional, good for tracking
    });

    await User.findByIdAndUpdate(user._id, {
      $inc: { balance: -amount, 'stats.trades': 1 },
    });

    await Transaction.create({
      user: user._id,
      type: 'investment',
      amount: -amount,
      currency: user.currency,
      status: 'completed',
      reference: `INV-${investment._id}`,
    });

    await sendNotification(
      user._id,
      'investment',
      `You invested ${amount} ${user.currency} in ${plan.name}. Payout: ${payoutAmount} ${user.currency} in ${plan.durationDays} days.`,
      { investmentId: investment._id }
    );

    res.json({ message: 'Investment created', investment });
  } catch (err) {
    console.error('❌ Investment error:', err);
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

export const getAllPlansPublic = async (req, res) => {
  try {
    // Read currency from query (optional)
    const currency = (req.query.currency || 'USD').toUpperCase();

    const plans = await InvestmentPlan.find().sort({ createdAt: -1 });

    const results = await Promise.all(
      plans.map(async (plan) => {
        const minConv = await convertUSDToFiat(plan.minAmount, currency);
        const maxConv = await convertUSDToFiat(plan.maxAmount, currency);

        return {
          ...plan.toObject(),
          minAmount: parseFloat(minConv.fiat.toFixed(2)),
          maxAmount: parseFloat(maxConv.fiat.toFixed(2)),
          currency,
        };
      })
    );

    res.status(200).json({
      success: true,
      plans: results,
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