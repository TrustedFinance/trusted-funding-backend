import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { createInvestment, getUserInvestments } from '../controllers/investmentController.js';

const router = Router();

router.post('/', auth, createInvestment);
router.get('/', auth, getUserInvestments);

export default router;
