// controllers/notificationController.js
import { Notification } from '../models/Notification.js';

/**
 * Fetch notifications for logged-in user
 * GET /api/notifications
 * Query params:
 *   - unreadOnly=true
 *   - type=deposit,withdrawal,investment,etc
 */
export const getUserNotifications = async (req, res) => {
  try {
    const { unreadOnly, type } = req.query;

    const query = { user: req.user._id };
    if (unreadOnly === 'true') query.read = false;
    if (type) query.type = { $in: type.split(',') }; // multiple types comma separated

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ notifications });
  } catch (err) {
    console.error('getUserNotifications error', err);
    res.status(500).json({ message: 'Error fetching notifications', error: err.message });
  }
};

/**
 * Mark a single notification as read
 * PATCH /api/notifications/:id/read
 */
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notif = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notif) return res.status(404).json({ message: 'Notification not found' });

    res.json({ message: 'Notification marked as read', notification: notif });
  } catch (err) {
    console.error('markNotificationRead error', err);
    res.status(500).json({ message: 'Error marking notification', error: err.message });
  }
};

/**
 * Mark all notifications as read
 * PATCH /api/notifications/markAllRead
 */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('markAllNotificationsRead error', err);
    res.status(500).json({ message: 'Error marking all notifications', error: err.message });
  }
};
