import User from '../models/User.js';
import Kyc from '../models/Kyc.js';
import { uploadToCloudinary } from '../middlewares/upload.js';

export const getProfile = (req, res) => {
  res.json(req.user);
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

    req.user.kyc = kyc._id;
    await req.user.save();

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
    res.json({ message: 'Country & currency saved' });
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
    const { name, phone, country, currency, wallets } = req.body;

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (country) user.country = country;
    if (currency) user.currency = currency;


    // Update wallet addresses - expects an object like { BTC: 'addr', ETH: 'addr' }
    if (walletAddresses && typeof walletAddresses === 'object') {
      for (const [coin, address] of Object.entries(walletAddresses)) {
        if (user.walletAddresses.hasOwnProperty(coin)) {
          user.walletAddresses[coin] = address;
        }
      }
    }

    await user.save();

    res.json({ message: 'Profile updated successfully', user });
  } catch (err) {
    console.error('updateProfile error', err);
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
};