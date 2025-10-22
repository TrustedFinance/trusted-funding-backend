import { sendNotification } from '../../utils/notifications.js';
import { recalcUserBalance } from '../../utils/recalculateBalance.js';
import Transaction from '../models/Transaction.js';

// ------------------- Helpers -------------------
// Credit internal wallet
const creditWallet = async (user, currency, amount) => {
  const current = user.wallets.get(currency) || 0;
  user.wallets.set(currency, current + amount);
  user.balance += amount; // keep total balance synced
  await user.save();
};

// Debit internal wallet
const debitWallet = async (user, currency, amount) => {
  const current = user.wallets.get(currency) || 0;
  if (current < amount) throw new Error(`Insufficient ${currency} balance`);
  user.wallets.set(currency, current - amount);
  user.balance -= amount; // keep total balance synced
  await user.save();
};

// ------------------- Transactions -------------------

// Get transactions for logged-in user
export const getUserTransactions = async (req, res) => {
  try {
    const tx = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(tx);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching transactions', error: err.message });
  }
};

// Admin: Get all transactions with filters
// ------------------- Admin: Get All Transactions (Enhanced) -------------------
export const getAllTransactions = async (req, res) => {
  try {
    const {
      type,
      status,
      currency,
      from,
      to,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    // 🧭 Filters
    if (type) query.type = type;
    if (status) query.status = status;
    if (currency) query.currency = currency;

    // 📆 Date range
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    // 🔍 User search (by name or email)
    let userFilter = {};
    if (search) {
      userFilter = {
        $or: [
          { name: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      };
    }

    const skip = (page - 1) * limit;

    // 🧩 Query transactions
    const tx = await Transaction.find(query)
      .populate({
        path: 'user',
        match: userFilter,
        select: 'email name walletAddresses'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Transaction.countDocuments(query);

    // 🧱 Format cleanly for admin UI
    const formatted = tx
      .filter(t => t.user) // remove unmatched user search results
      .map(t => ({
        id: t._id,
        user: t.user?.name || 'Unknown',
        email: t.user?.email,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        createdAt: t.createdAt,
        reference: t.reference,
        toAddress: t.meta?.toAddress || t.user?.walletAddresses?.[t.currency] || 'N/A',
      }));

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      results: formatted
    });
  } catch (err) {
    console.error('Admin transaction fetch error:', err);
    res.status(500).json({
      message: 'Error fetching all transactions',
      error: err.message
    });
  }
};


// ------------------- Manual Deposit (User-Initiated) -------------------
export const deposit = async (req, res) => {
  try {
    const { amount, currency = 'USDT' } = req.body;
    const user = req.user;

    if (amount <= 0) {
      return res.status(400).json({ message: 'Invalid deposit amount' });
    }

    // The admin wallet address the user should send to
    const adminWallet = process.env.ADMIN_WALLET_ADDRESS || 'bc1q8wjutukez77nlqzqql7qss2c5yujg5cz6h5xpu';

    // Create a pending deposit transaction
    const tx = await Transaction.create({
      user: user._id,
      type: 'deposit',
      amount,
      currency,
      status: 'pending',
      reference: 'DP-' + Date.now(),
      meta: { toAddress: adminWallet }
    });

    // Notify user of next step
    await sendNotification(
      user._id,
      'deposit',
      `Deposit request for ${amount} ${currency} created. Please send funds to ${adminWallet} and wait for admin approval.`,
      { transactionId: tx._id }
    );

    res.json({
      message: 'Deposit request created. Send funds to admin address and wait for approval.',
      adminAddress: adminWallet,
      transaction: tx
    });
  } catch (err) {
    console.error('deposit error', err);
    res.status(500).json({ message: 'Deposit initiation failed', error: err.message });
  }
};

// ------------------- Manual Withdrawal (User-Initiated) -------------------
export const withdraw = async (req, res) => {
  try {
    const { amount, currency = 'USDT' } = req.body;
    const user = req.user;

    if (amount <= 0) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    if (!user.walletAddresses || !user.walletAddresses[currency]) {
      return res.status(400).json({ message: `No wallet address set for ${currency}` });
    }

    // Just create a pending transaction — no deduction yet
    const tx = await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      amount,
      currency,
      status: 'pending',
      reference: 'WD-' + Date.now(),
      meta: { provider: 'manual', toAddress: user.walletAddresses[currency] }
    });

    // Notify user of pending request
    await sendNotification(
      user._id,
      'withdrawal',
      `Your withdrawal request of ${amount} ${currency} has been received and is pending admin approval.`,
      { transactionId: tx._id }
    );

    res.json({
      message: 'Withdrawal request submitted and pending admin approval.',
      transaction: tx
    });
  } catch (err) {
    console.error('withdrawal error', err);
    res.status(500).json({ message: 'Withdrawal error', error: err.message });
  }
};

// ------------------- Swap -------------------
export const swap = async (req, res) => {
  try {
    const { fromCurrency, toCurrency, fromAmount, toAmount } = req.body;
    if (!fromCurrency || !toCurrency || !fromAmount || !toAmount)
      return res.status(400).json({ message: 'Invalid swap parameters' });

    const user = req.user;

    // Ensure enough balance in fromCurrency
    await debitWallet(user, fromCurrency, fromAmount);
    await creditWallet(user, toCurrency, toAmount);
    await recalcUserBalance(user);

    const tx = await Transaction.create({
      user: user._id,
      type: 'swap',
      amount: fromAmount,
      currency: fromCurrency,
      status: 'completed',
      reference: 'SWAP-' + Date.now(),
      meta: { toCurrency, toAmount }
    });
  await sendNotification(
      req.user._id,
      'swap',
      `You swapped ${fromAmount} ${fromCurrency} to ${toAmount} ${toCurrency}.`,
      { transactionId: tx._id }
    );

    res.json({ message: 'Swap completed', transaction: tx, wallets: user.wallets });
  } catch (err) {
    console.error('swap error', err);
    res.status(500).json({ message: 'Swap failed', error: err.message });
  }
};

// ------------------- Receive -------------------
// Return the user's USDT deposit address
export const receive = async (req, res) => {
  try {
    // Ensure the user has a USDT wallet address
    const usdtAddress = req.user.walletAddresses?.USDT;
    if (!usdtAddress) {
      return res.status(400).json({
        message: 'USDT wallet address not set. Please update your profile.'
      });
    }

    res.json({
      message: 'Your USDT deposit address',
      currency: 'USDT',
      address: usdtAddress
    });
  } catch (err) {
    console.error('receive error', err);
    res.status(500).json({ message: 'Failed to fetch deposit address', error: err.message });
  }
};

// ------------------- Admin: Approve Withdrawal -------------------
export const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;

    const tx = await Transaction.findById(id).populate('user');
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.type !== 'withdrawal') return res.status(400).json({ message: 'Not a withdrawal transaction' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Transaction is not pending' });

    const user = tx.user;

    // Deduct only when admin approves
    await debitWallet(user, tx.currency, tx.amount);
    await recalcUserBalance(user);

    tx.status = 'completed';
    await tx.save();

    // Notify user of successful withdrawal
    await sendNotification(
      user._id,
      'withdrawal',
      `Your withdrawal of ${tx.amount} ${tx.currency} to ${tx.meta.toAddress} has been approved.`,
      { transactionId: tx._id }
    );

    res.json({ message: 'Withdrawal approved and funds deducted', transaction: tx });
  } catch (err) {
    console.error('approveWithdrawal error', err);
    res.status(500).json({ message: 'Error approving withdrawal', error: err.message });
  }
};

// ------------------- Admin: Reject Withdrawal -------------------
export const rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;

    const tx = await Transaction.findById(id).populate('user');
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.type !== 'withdrawal') return res.status(400).json({ message: 'Not a withdrawal transaction' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Transaction is not pending' });

    const user = tx.user;

    tx.status = 'failed';
    await tx.save();

    // Notify user of rejection
    await sendNotification(
      user._id,
      'withdrawal',
      `Your withdrawal request of ${tx.amount} ${tx.currency} was rejected by the admin. Your balance remains unchanged.`,
      { transactionId: tx._id }
    );

    res.json({ message: 'Withdrawal rejected successfully', transaction: tx });
  } catch (err) {
    console.error('rejectWithdrawal error', err);
    res.status(500).json({ message: 'Error rejecting withdrawal', error: err.message });
  }
};

export const approveDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const tx = await Transaction.findById(id).populate('user');
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.type !== 'deposit') return res.status(400).json({ message: 'Not a deposit transaction' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Transaction is not pending' });

    const user = tx.user;
    await creditWallet(user, tx.currency, tx.amount);
    await recalcUserBalance(user);
    tx.status = 'completed';
    await tx.save();

    await sendNotification(
      user._id,
      'deposit',
      `Your deposit of ${tx.amount} ${tx.currency} has been approved and credited to your wallet.`,
      { transactionId: tx._id }
    );

    res.json({ message: 'Deposit approved and funds credited', transaction: tx });
  } catch (err) {
    console.error('approveDeposit error', err);
    res.status(500).json({ message: 'Error approving deposit', error: err.message });
  }
};

export const rejectDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const tx = await Transaction.findById(id).populate('user');
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.type !== 'deposit') return res.status(400).json({ message: 'Not a deposit transaction' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Transaction is not pending' });

    tx.status = 'failed';
    await tx.save();

    await sendNotification(
      tx.user._id,
      'deposit',
      `Your deposit of ${tx.amount} ${tx.currency} was rejected by the admin.`,
      { transactionId: tx._id }
    );

    res.json({ message: 'Deposit rejected successfully', transaction: tx });
  } catch (err) {
    console.error('rejectDeposit error', err);
    res.status(500).json({ message: 'Error rejecting deposit', error: err.message });
  }
};
