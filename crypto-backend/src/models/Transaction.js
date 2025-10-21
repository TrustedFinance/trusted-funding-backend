import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

const transactionSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit','withdrawal','swap','receive','payout', 'investment'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String },
  status: { type: String, enum: ['pending','completed','failed'], default: 'pending' },
  reference: { type: String },
  meta: { type: Object }
}, { timestamps: true });

const Transaction = model('Transaction', transactionSchema);

export default Transaction;
