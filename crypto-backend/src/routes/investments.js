import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { createInvestment, getUserInvestments } from '../controllers/investmentController.js';
import { getLeaderboard } from '../controllers/adminController.js';

const router = Router();

router.post('/', auth, createInvestment);
router.get('/', auth, getUserInvestments);
router.get('/leaderboard', auth, getLeaderboard);
export default router;
