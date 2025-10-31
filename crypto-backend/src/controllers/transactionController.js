import { creditBalance, debitBalance } from '../../utils/balanceUtils.js';
import { sendNotification } from '../../utils/notifications.js';
import { convertUSDToFiat } from '../../utils/rateConverter.js';
import { getCryptoPrices, recalcUserBalance } from '../../utils/recalculateBalance.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';


// Get transactions for logged-in user


export const getUserTransactions = async (req, res) => {
  try {
    const user = req.user; // from auth
    const userCurrency = user.currency || 'USD';

    let tx = await Transaction.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    tx = await Promise.all(
      tx.map(async (t) => {
        let displayAmount;
        let displayCurrency;
        let note = '';

        // 🪙 1. Crypto deposit or withdrawal
        if (['deposit', 'withdrawal'].includes(t.type) && t.meta?.cryptoSymbol) {
          displayAmount = `${Math.abs(t.meta.cryptoAmount || t.amount)} ${t.meta.cryptoSymbol}`;
          displayCurrency = t.meta.cryptoSymbol;
          note = `${t.type} in ${t.meta.cryptoSymbol}`;
        }

        // 💵 2. Manual fiat deposit or withdrawal (no crypto meta)
        else if (['deposit', 'withdrawal'].includes(t.type) && !t.meta?.cryptoSymbol) {
          // Convert to user’s selected currency if needed
          if (t.currency === 'USD' && userCurrency !== 'USD') {
            const { fiat, rate } = await convertUSDToFiat(Math.abs(t.amount), userCurrency);
            displayAmount = `${fiat.toFixed(2)} ${userCurrency}`;
            displayCurrency = userCurrency;
            note = `${t.type} in ${userCurrency} (rate ${rate.toFixed(2)})`;
          } else {
            displayAmount = `${Math.abs(t.amount).toFixed(2)} ${t.currency || userCurrency}`;
            displayCurrency = t.currency || userCurrency;
            note = `${t.type} in ${displayCurrency}`;
          }
        }

        // 📈 3. Investment transactions
        else if (t.type === 'investment') {
          if (['USD', 'USDT'].includes(userCurrency)) {
            displayAmount = `${Math.abs(t.amount).toFixed(2)} USD`;
            displayCurrency = 'USD';
          } else {
            const { fiat, rate } = await convertUSDToFiat(Math.abs(t.amount), userCurrency);
            displayAmount = `${fiat.toFixed(2)} ${userCurrency}`;
            displayCurrency = userCurrency;
            note = `investment (rate ${rate.toFixed(2)})`;
          }
        }

        // 💰 4. All other generic types (swap, payout, etc.)
        else {
          displayAmount = `${Math.abs(t.amount).toFixed(2)} ${t.currency || 'USD'}`;
          displayCurrency = t.currency || 'USD';
        }

        return {
          ...t,
          displayAmount,
          displayCurrency,
          note,
        };
      })
    );

    res.json(tx);
  } catch (err) {
    console.error('❌ getUserTransactions error:', err);
    res.status(500).json({ message: 'Error fetching transactions', error: err.message });
  }
};

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
    const { amount, currency } = req.body;
    const user = req.user;

    if (!currency) {
      return res.status(400).json({ message: 'Currency is required (e.g. BTC, ETH, SOL)' });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: 'Invalid deposit amount' });
    }

   const crypto = currency.toUpperCase();
    // Map currencies to admin wallet addresses
    const adminWallets = {
      BTC: process.env.ADMIN_WALLET_ADDRESS_BTC || 'bc1q8wjutukez77nlqzqql7qss2c5yujg5cz6h5xpu',
      ETH: process.env.ADMIN_WALLET_ADDRESS_ETH || '0xb72400F1b4cf1937aAE6D47975b547E6F0b18f11',
      SOL: process.env.ADMIN_WALLET_ADDRESS_SOL || 'DWQ8czY1AWRA1DzFjQMp1ddKPAWBrZETKmwhzY3Atg2Z',
    };

    const selectedAddress = adminWallets[currency.toUpperCase()];
    if (!selectedAddress) {
      return res.status(400).json({ message: `Unsupported currency: ${currency}` });
    }

    // Create a pending deposit transaction
    const tx = await Transaction.create({
      user: user._id,
      type: 'deposit',
      amount,
      currency: currency.toUpperCase(),
      status: 'pending',
      reference: 'DP-' + Date.now(),
      meta: { toAddress: selectedAddress,      meta: {
        cryptoSymbol: crypto,      // e.g. BTC
        cryptoAmount: amount,      // raw number entered by user
        toAddress: selectedAddress // admin wallet address
      } }
    });


    // Notify user
    await sendNotification(
      user._id,
      'deposit',
      `Deposit request for ${amount} ${currency.toUpperCase()} created.
       Please send funds to the admin address below and wait for approval.`,
      { transactionId: tx._id }
    );

    // Response
    res.json({
      success: true,
      message: 'Deposit request created. Send funds to the admin address and wait for approval.',
      adminAddress: selectedAddress,
      currency: currency.toUpperCase(),
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

    const crypto = currency.toUpperCase();

    // ✅ Check if user has the wallet address for the currency
    if (!user.walletAddresses || !user.walletAddresses[crypto]) {
      return res.status(400).json({ message: `No wallet address set for ${crypto}` });
    }

    // ✅ Check if user has sufficient balance in the currency
    const balance = user.balances?.get
      ? user.balances.get(crypto) || 0
      : user.balances?.[crypto] || 0;

    if (balance < amount) {
      return res.status(400).json({
        message: `Insufficient balance. You have ${balance} ${crypto}, but tried to withdraw ${amount} ${crypto}.`
      });
    }

    // ✅ Create a pending transaction — funds not deducted yet
    const tx = await Transaction.create({
      user: user._id,
      type: 'withdrawal',
      amount,
      currency: crypto,
      status: 'pending',
      reference: 'WD-' + Date.now(),
      meta: {
        provider: 'manual',
        toAddress: user.walletAddresses[crypto],
        cryptoSymbol: crypto,
        cryptoAmount: amount
      }
    });

    // ✅ Notify user of pending withdrawal
    await sendNotification(
      user._id,
      'withdrawal',
      `Your withdrawal request of ${amount} ${crypto} has been received and is pending admin approval.`,
      { transactionId: tx._id }
    );

    res.json({
      success: true,
      message: 'Withdrawal request submitted and pending admin approval.',
      transaction: tx
    });

  } catch (err) {
    console.error('withdrawal error', err);
    res.status(500).json({ message: 'Withdrawal error', error: err.message });
  }
};

// ------------------- Swap -------------------
export const previewSwap = async (req, res) => {
  try {
    const { fromCurrency, toCurrency, fromAmount } = req.body;

    if (!fromCurrency || !toCurrency || !fromAmount) {
      return res.status(400).json({ message: 'Invalid parameters' });
    }

    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // ✅ Use the same pricing logic
    const prices = await getCryptoPrices([fromCurrency, toCurrency]);
    const fromPrice = prices[fromCurrency.toUpperCase()];
    const toPrice = prices[toCurrency.toUpperCase()];

    if (!fromPrice || !toPrice)
      return res.status(400).json({ message: 'Unable to fetch coin prices' });

    const usdValue = amount * fromPrice;
    const toAmount = usdValue / toPrice;
    const rate = fromPrice / toPrice;

    return res.json({
      success: true,
      fromCurrency,
      toCurrency,
      fromAmount: amount,
      toAmount: toAmount.toFixed(6),
      rate,
    });
  } catch (err) {
    console.error('previewSwap error:', err);
    res.status(500).json({ message: 'Failed to preview swap', error: err.message });
  }
};

export const swap = async (req, res) => {
  try {
    const { fromCurrency, toCurrency, fromAmount } = req.body;
    if (!fromCurrency || !toCurrency || !fromAmount) {
      return res.status(400).json({ message: 'Invalid swap parameters' });
    }

    const user = await User.findById(req.user._id);
    const amount = parseFloat(fromAmount);

    // ✅ 1. Get current prices for both coins in USD
    const prices = await getCryptoPrices([fromCurrency, toCurrency]);
    const fromPrice = prices[fromCurrency.toUpperCase()] || 0;
    const toPrice = prices[toCurrency.toUpperCase()] || 0;

    if (!fromPrice || !toPrice)
      return res.status(400).json({ message: 'Unable to fetch coin prices' });

    // ✅ 2. Calculate equivalent
    const usdValue = amount * fromPrice;
    const toAmount = usdValue / toPrice;

    // ✅ 3. Update user balances
    await debitBalance(user, fromCurrency, amount);
    await creditBalance(user, toCurrency, toAmount);

    // ✅ 4. Recalculate total balance in USD
    await recalcUserBalance(user);

    // ✅ 5. Log transaction
    const tx = await Transaction.create({
      user: user._id,
      type: 'swap',
      amount: amount,
      currency: fromCurrency,
      status: 'completed',
      reference: 'SWAP-' + Date.now(),
      meta: { toCurrency, toAmount },
    });

    // ✅ 6. Notify user
    await sendNotification(
      user._id,
      'swap',
      `You swapped ${amount} ${fromCurrency} → ${toAmount.toFixed(6)} ${toCurrency}.`,
      { transactionId: tx._id }
    );

    res.json({
      success: true,
      message: 'Swap completed successfully',
      fromCurrency,
      toCurrency,
      fromAmount: amount,
      toAmount: toAmount.toFixed(6),
      balances: Object.fromEntries(user.balances),
      totalBalanceUSD: user.balance,
    });
  } catch (err) {
    console.error('swap error:', err);
    res.status(500).json({ message: 'Swap failed', error: err.message });
  }
};
// ------------------- Receive -------------------
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
    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.type !== 'withdrawal') return res.status(400).json({ message: 'Not a withdrawal transaction' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Transaction not pending' });

    // Fetch real user
    const user = await User.findById(tx.user);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 👇 If withdrawal funds were not deducted earlier, debit here
    await debitBalance(user, tx.currency, tx.amount);
    await recalcUserBalance(user);

    tx.status = 'completed';
    await tx.save();

    await sendNotification(
      user._id,
      'withdrawal',
      `Your withdrawal of ${tx.amount} ${tx.currency} has been approved.`,
      { transactionId: tx._id }
    );

    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      balances: Object.fromEntries(user.balances),
      totalBalanceUSD: user.balance,
      transaction: tx,
    });
  } catch (err) {
    console.error('approveWithdrawal error:', err);
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
    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.type !== 'deposit') return res.status(400).json({ message: 'Not a deposit transaction' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Transaction not pending' });

    // Fetch real user
    const user = await User.findById(tx.user);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ Credit funds
    await creditBalance(user, tx.currency, tx.amount);
    await recalcUserBalance(user);

    tx.status = 'completed';
    await tx.save();

    await sendNotification(
      user._id,
      'deposit',
      `Your deposit of ${tx.amount} ${tx.currency} has been approved and credited.`,
      { transactionId: tx._id }
    );

    res.json({
      success: true,
      message: 'Deposit approved and funds credited',
      balances: Object.fromEntries(user.balances),
      totalBalanceUSD: user.balance,
      transaction: tx,
    });
  } catch (err) {
    console.error('approveDeposit error:', err);
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
