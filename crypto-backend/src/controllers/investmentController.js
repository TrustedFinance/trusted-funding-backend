import { sendNotification } from '../../utils/notifications.js';
import { convertFiatToUSD } from '../../utils/rateConverter.js';
import { recalcUserBalance } from '../../utils/recalculateBalance.js';
import { Investment, InvestmentPlan } from '../models/Investment.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import {DateTime} from "luxon"

// Create user investment
export const createInvestment = async (req, res) => {
  try {
    const { planId, amount } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const plan = await InvestmentPlan.findById(planId);
    if (!plan || !plan.isActive)
      return res.status(400).json({ message: 'Plan not available' });

    // 🔁 Convert fiat → USD
    const { usd: amountInUSD, rate } = await convertFiatToUSD(amount, user.currency);

    // ✅ Compare in USD
    if (user.balance < amountInUSD)
      return res.status(400).json({ message: 'Insufficient balance' });

    // ✅ Validate plan limits
    if (amountInUSD < plan.minAmount || amountInUSD > plan.maxAmount)
      return res.status(400).json({
        message: `Amount must be between ${plan.minAmount} and ${plan.maxAmount} USD (rate: ${rate})`,
      });

    const payoutAmount = amount * plan.multiplier;
    const startAt = new Date();
    const endAt = DateTime.now().plus({ days: plan.durationDays }).toJSDate();

    // ✅ Create investment record
    const investment = await Investment.create({
      user: user._id,
      plan: plan._id,
      amount, // store fiat amount
      multiplier: plan.multiplier,
      durationDays: plan.durationDays,
      startAt,
      endAt,
      payoutAmount,
      currency: user.currency,
    });

    // 💵 Deduct balances properly
    const balances = user.balances || {};

    // Deduct from user's fiat currency balance if present
    if (balances[user.currency] && balances[user.currency] >= amount) {
      balances[user.currency] -= amount;
    } else {
      // Fallback to main balance in USD
      user.balance -= amountInUSD;
    }

    user.stats.trades = (user.stats.trades || 0) + 1;

    // 🔄 Recalculate total USD equivalent
    await recalcUserBalance(user);

    await user.save();

    // 🧾 Log transaction
    await Transaction.create({
      user: user._id,
      type: 'investment',
      amount: -amountInUSD,
      currency: 'USD',
      status: 'completed',
      reference: `INV-${investment._id}`,
      meta: {
        fiatAmount: amount,
        fiatCurrency: user.currency,
        rate,
        planName: plan.name,
      },
    });

    // 🔔 Notify
    await sendNotification(
      user._id,
      'investment',
      `You invested ${amount} ${user.currency} in ${plan.name}. Payout: ${payoutAmount} ${user.currency} in ${plan.durationDays} days.`,
      { investmentId: investment._id }
    );

    res.json({
      message: 'Investment created successfully',
      investment,
      newBalance: user.balance,
    });
  } catch (err) {
    console.error('❌ Investment error:', err);
    res.status(500).json({ message: 'Investment error', error: err.message });
  }
};

// Get user's investments + summary
export const getUserInvestments = async (req, res) => {
  try {
    const investments = await Investment.find({ user: req.user._id }).populate('plan');

    // If no investments
    if (!investments.length) {
      return res.json({
        success: true,
        message: 'No investments found',
        data: {
          investments: [],
          summary: {
            totalInvested: 0,
            totalEarned: 0,
            activeInvestments: 0,
            completedInvestments: 0,
            pendingEarnings: 0,
          },
        },
      });
    }

    // Compute summary stats
    let totalInvested = 0;
    let totalEarned = 0;
    let pendingEarnings = 0;
    let activeInvestments = 0;
    let completedInvestments = 0;

    investments.forEach(inv => {
      totalInvested += inv.amount;

      if (inv.status === 'completed') {
        totalEarned += inv.payoutAmount;
        completedInvestments++;
      } else if (inv.status === 'active') {
        activeInvestments++;
        // Estimate earnings so far
        const now = new Date();
        const elapsedDays = Math.max(0, Math.floor((now - inv.startAt) / (1000 * 60 * 60 * 24)));
        const progress = Math.min(elapsedDays / inv.durationDays, 1);
        const earnedSoFar = inv.payoutAmount * progress;
        pendingEarnings += earnedSoFar;
      }
    });

    const summary = {
      totalInvested,
      totalEarned,
      pendingEarnings,
      activeInvestments,
      completedInvestments,
    };

    res.json({
      success: true,
      message: 'Investments fetched successfully',
      data: {
        investments,
        summary,
      },
    });
  } catch (err) {
    console.error('getUserInvestments error', err);
    res.status(500).json({ success: false, message: 'Fetch investments failed', error: err.message });
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
};;