import User from '../models/User.js';
import Kyc from '../models/Kyc.js';
import bcrypt from 'bcryptjs'
import { uploadToCloudinary } from '../middlewares/upload.js';
import Transaction from '../models/Transaction.js';
import { Investment, InvestmentPlan } from '../models/Investment.js';
import { getFiatBalance } from '../../utils/balanceUtils.js';
import { convertUSDToFiat } from '../../utils/rateConverter.js';
import { recalcUserBalance } from '../../utils/recalculateBalance.js';

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Recalculate balance in USD based on crypto holdings
    const totalUsd = await recalcUserBalance(user);

    // Convert to user's selected fiat currency
    const fiatBalance = await getFiatBalance(user);

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        balances: Object.fromEntries(user.balances),
        walletAddresses: user.walletAddresses,
        balanceUsd: totalUsd,       // raw USD total
        balanceFiat: fiatBalance,   // converted to NGN or selected currency
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('getProfile error:', err);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
};


export const getPortfolio = async (req, res) => {
  const user = await User.findById(req.user._id);
  const prices = await getCryptoPrices();

  const portfolio = Object.entries(user.balances || {}).map(([coin, amt]) => ({
    coin,
    amount: amt,
    price: prices[coin],
    valueUSD: amt * prices[coin]
  }));

  const totalUSD = portfolio.reduce((sum, c) => sum + c.valueUSD, 0);

  res.json({
    success: true,
    totalUSD,
    portfolio,
    balanceInCurrency: user.currency ? await convertUsdtToCurrency(totalUSD, user.currency) : totalUSD
  });
};

export const uploadKyc = async (req, res) => {
  try {
    const { idType, idNumber, address } = req.body;

    if (!req.files?.selfie?.[0] || !req.files?.idImage?.[0]) {
      return res.status(400).json({ message: 'Selfie and ID image are required' });
    }

    // Upload files to Cloudinary
    const selfieResult = await uploadToCloudinary(req.files.selfie[0].buffer, 'kyc/selfies');
    const idImageResult = await uploadToCloudinary(req.files.idImage[0].buffer, 'kyc/id_images');

    // Save KYC record
    const kyc = await Kyc.create({
      user: req.user._id,
      idType,
      idNumber,
      address,
      selfieUrl: selfieResult.secure_url,
      idImageUrl: idImageResult.secure_url
    });

    // 🔥 Re-fetch and persist properly
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.kyc = kyc._id;
    await user.save();


    res.json({ message: 'KYC submitted successfully', kyc });
  } catch (err) {
    console.error('uploadKyc error', err);
    res.status(500).json({ message: 'Error uploading KYC', error: err.message });
  }
};

export const selectCountryCurrency = async (req, res) => {
  try {
    const { country, currency } = req.body;
    req.user.country = country;
    req.user.currency = currency;
    await req.user.save();

    // Recalculate fiat balance
    const fiatBalance = await getFiatBalance(req.user);

    res.json({
      message: 'Country & currency saved',
      currency: req.user.currency,
      balances: Object.fromEntries(req.user.balances),
      balance: fiatBalance
    });
  } catch (err) {
    res.status(500).json({ message: 'Error saving country/currency', error: err.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Delete user's KYC if exists
    const user = await User.findById(userId).populate('kyc');
    if (user?.kyc) {
      await Kyc.findByIdAndDelete(user.kyc._id);
    }

    // Delete user account
    await User.findByIdAndDelete(userId);

    // Optional: also delete transactions, investments, etc.
    await Transaction.deleteMany({ user: userId });
    await Investment.deleteMany({ user: userId });

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting account', error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = req.user; // populated by auth middleware
    const { name, phone, country, currency, walletAddresses } = req.body;

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (country) user.country = country;
    if (currency) user.currency = currency;

    // Update wallet addresses - expects { BTC: 'addr', ETH: 'addr', USDT: 'addr' }
    if (walletAddresses && typeof walletAddresses === 'object') {
      if (!user.walletAddresses) user.walletAddresses = {}; // initialize if missing
      for (const [coin, address] of Object.entries(walletAddresses)) {
        user.walletAddresses[coin] = address;
      }
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (err) {
    console.error('updateProfile error', err);
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Both current and new passwords are required' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ Check if current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: 'Current password is incorrect' });

    // ✅ Prevent using the same password again
    const isSameAsOld = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOld)
      return res
        .status(400)
        .json({ message: 'New password must be different from the current password' });

    // ✅ Hash and update new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    if (user.resetPasswordToken) user.resetPasswordToken = undefined;
    if (user.resetPasswordExpires) user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

export const getAllPlansForUser = async (req, res) => {
  try {
    // 1️⃣ Get the user's preferred currency
    const user = await User.findById(req.user._id);
    const currency = user?.currency?.toUpperCase() || 'USD';

    // 2️⃣ Get all investment plans
    const plans = await InvestmentPlan.find({ isActive: true }).sort({ createdAt: -1 });

    // 3️⃣ Convert plan amounts to the user’s selected fiat currency
    const results = await Promise.all(
      plans.map(async (plan) => {
        const minConv = await convertUSDToFiat(plan.minAmount, currency);
        const maxConv = plan.maxAmount
          ? await convertUSDToFiat(plan.maxAmount, currency)
          : null;

        // Format numbers for frontend clarity
        const formattedMin = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(minConv.fiat);

        const formattedMax = maxConv
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency,
            }).format(maxConv.fiat)
          : null;

        return {
          id: plan._id,
          name: plan.name,
          description: plan.description,
          multiplier: plan.multiplier,
          durationDays: plan.durationDays,
          minAmount: plan.minAmount,         // USD base
          maxAmount: plan.maxAmount,         // USD base
          minAmountFiat: minConv.fiat,       // numeric fiat
          maxAmountFiat: maxConv?.fiat || null,
          formattedMinAmount: formattedMin,  // e.g. "₦80,000.00"
          formattedMaxAmount: formattedMax,  // e.g. "₦100,000.00"
          currency,
          isActive: plan.isActive,
        };
      })
    );

    // 4️⃣ Return to frontend
    res.status(200).json({
      success: true,
      currency,
      plans: results,
    });
  } catch (err) {
    console.error('❌ Error fetching plans:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans',
      error: err.message,
    });
  }
};

