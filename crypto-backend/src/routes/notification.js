// routes/notificationRoutes.js
import express from 'express';
import { getUserNotifications, markNotificationRead,  markAllNotificationsRead } from '../controllers/notificationController.js';
import auth from '../middlewares/auth.js';


const router = express.Router();

router.get('/', auth, getUserNotifications);
router.patch('/:id/read', auth, markNotificationRead);
router.patch('/markAllRead', auth, markAllNotificationsRead);
export default router;
