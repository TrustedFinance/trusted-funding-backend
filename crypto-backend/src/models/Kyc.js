import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

const kycSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true },
  idType: { type: String },
  idNumber: { type: String },
  address: { type: String },
  selfieUrl: { type: String },
  idImageUrl: { type: String },
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  resubmittedAt: { type: Date },
  resubmissionCount: { type: Number, default: 0 },
  adminNote: { type: String }
}, { timestamps: true });

const Kyc = model('Kyc', kycSchema);

export default Kyc;
