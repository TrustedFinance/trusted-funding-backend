import { Router } from 'express';
import auth from '../middlewares/auth.js';
import { deposit, getUserTransactions,previewSwap,receive, swap, withdraw } from '../controllers/transactionController.js';

const router = Router();

router.get('/me', auth, getUserTransactions);
router.post('/deposit', auth, deposit)
router.post('/swap', auth, swap)
router.get('/previewSap', auth, previewSwap)
router.post('/withdraw', auth, withdraw)
router.get('/receive', auth, receive)


export default router;
