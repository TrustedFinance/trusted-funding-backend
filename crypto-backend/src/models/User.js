import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema, model, Types } = mongoose;

const userSchema = new Schema({
  name: String,
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, unique: true, sparse: true },
  country: String,
  currency: String,
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  kyc: { type: Types.ObjectId, ref: 'Kyc' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isBlocked: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  balances: {
    type: Map,
    of: Number,
    default: {},
  },

  walletAddresses: {
    BTC: { type: String, default: '' },
    ETH: { type: String, default: '' },
    USDT: { type: String, default: '' },
    BNB: { type: String, default: '' },
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date,

  stats: {
    totalEarned: { type: Number, default: 0 },
    trades: { type: Number, default: 0 },
  },
}, { timestamps: true });

// 🔒 Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// 🔑 Compare password method
userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = model('User', userSchema);
export default User;
