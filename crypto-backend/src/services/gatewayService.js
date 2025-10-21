import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

/**
 * Create a manual deposit.
 * Funds are assumed to go to the admin wallet by default.
 */
export async function createDeposit({ userId, amount, currency = 'BTC' }) {
  // Admin wallet (you can configure as env variable)
  const adminWallet = process.env.ADMIN_WALLET || 'bc1q8wjutukez77nlqzqql7qss2c5yujg5cz6h5xpu';

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Increase user balance (manual deposit)
  user.balance += amount;
  await user.save();

  // Record transaction
  const tx = await Transaction.create({
    user: user._id,
    type: 'deposit',
    amount,
    currency,
    status: 'completed',
    reference: 'MANUAL-' + Date.now(),
    meta: { note: `Manual deposit to admin wallet ${adminWallet}` }
  });

  return tx;
}

/**
 * Create a manual withdrawal.
 * Transaction is set as pending; admin will process it manually.
 */
export async function createWithdrawal({ userId, toAddress, amount, currency = 'BTC' }) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.balance < amount) throw new Error('Insufficient balance');

  // Deduct user balance immediately to avoid double-spending
  user.balance -= amount;
  await user.save();

  // Record withdrawal transaction (pending)
  const tx = await Transaction.create({
    user: user._id,
    type: 'withdrawal',
    amount,
    currency,
    status: 'pending',
    reference: 'MANUAL-WD-' + Date.now(),
    meta: { note: `Manual withdrawal to ${toAddress}` }
  });

  return tx;
}
