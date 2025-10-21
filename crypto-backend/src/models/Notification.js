// models/Notification.js
import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;

const notificationSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'swap', 'receive', 'investment', 'system'],
    required: true
  },
  message: { type: String, required: true },
  meta: { type: Object }, // optional extra data
  read: { type: Boolean, default: false },
}, { timestamps: true });

export const Notification = model('Notification', notificationSchema);
