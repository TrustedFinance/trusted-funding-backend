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

export async function listAllNotifications(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build dynamic filter
    const filter = {};

    // Example filters
    if (req.query.read === "true") filter.read = true;
    if (req.query.read === "false") filter.read = false;
    if (req.query.type) filter.type = req.query.type;

    // Optional date range filter
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate("user", "name email phone country")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
      filters: filter,
      notifications,
    });
  } catch (err) {
    next(err);
  }
}