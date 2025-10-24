import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

// Allowed plan names from client
// const PLAN_NAMES = [
//   'Starter Flip',
//   'Silver Surge',
//   'Gold Power Plan',
//   'Diamond Elite'
// ];

// Plan template (admin defines these)
const investmentPlanSchema = new Schema({
  name: { type: String, required: true, },
  minAmount: { type: Number, required: true },
  maxAmount: { type: Number, required: true },
  multiplier: { type: Number, default: 7 },
  durationDays: { type: Number, default: 7 },
  description: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const InvestmentPlan = model('InvestmentPlan', investmentPlanSchema);

// User investment
const investmentSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true },
  plan: { type: Types.ObjectId, ref: 'InvestmentPlan', required: true },
  amount: { type: Number, required: true },
  multiplier: { type: Number, required: true },
  durationDays: { type: Number, required: true },
  startAt: { type: Date, default: Date.now },
  endAt: { type: Date },
  status: { type: String, enum: ['active','completed','cancelled'], default: 'active' },
  payoutAmount: { type: Number, required: true },
}, { timestamps: true });

export const Investment = model('Investment', investmentSchema);
