import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { createInvestment, getUserInvestments } from '../controllers/investmentController.js';
import { getAllPlans, getLeaderboard } from '../controllers/adminController.js';

const router = Router();

router.post('/', auth, createInvestment);
router.get('/', auth, getUserInvestments);
router.get('/plans', getAllPlans)
router.get('/leaderboard', auth, getLeaderboard);
export default router;
