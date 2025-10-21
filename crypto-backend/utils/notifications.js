// utils/notifications.js

import { Notification } from "../src/models/Notification.js";


export const sendNotification = async (userId, type, message, meta = {}) => {
  try {
    const notif = await Notification.create({
      user: userId,
      type,
      message,
      meta
    });
    // Optionally: emit via WebSocket/real-time system
    return notif;
  } catch (err) {
    console.error('sendNotification error:', err);
    return null;
  }
};
