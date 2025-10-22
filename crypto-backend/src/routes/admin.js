import { Router } from 'express';
import auth from '../middlewares/auth.js';
import admin from '../middlewares/admin.js';
import { adminLogin, adminRegister, blockUser, createPlan, deletePlan, deleteUser, editPlan } from '../controllers/adminController.js';
import { getAllInvestments } from '../controllers/investmentController.js';
import { approveWithdrawal, getAllTransactions, rejectWithdrawal } from '../controllers/transactionController.js';
import { listAllNotifications } from '../controllers/notificationController.js';

const router = Router();

// auth
router.post('/register', auth, admin, adminRegister)
router.post('/login', auth, admin, adminLogin)

// User
router.post('/block/:id', auth, admin, blockUser);
router.delete('/user/:id', auth, admin, deleteUser);

// Investments
router.get('/investments/get', auth, admin, getAllInvestments)

//Plans
router.post('/plans/create', auth, admin, createPlan)
router.put('/plans/edit/:id', auth, admin, editPlan)
router.delete('/plans/delete/:id', auth, admin, deletePlan)

//Transactions
router.get('/transactions', auth, admin,  getAllTransactions)
router.post('/transactions/withdrawals/:id/approve', auth, admin, approveWithdrawal)
router.post('/transactions/withdrawals/:id/reject', auth, admin, rejectWithdrawal)
router.get('/notifications', auth, admin, listAllNotifications)

//LeaderBoard



export default router;
