import { Router } from 'express';
import auth from '../middlewares/auth.js';
import admin from '../middlewares/admin.js';
import { adminLogin, adminRegister, blockUser, createPlan, deletePlan, deleteUser, editPlan, getInvestmentsDueTomorrow, getPendingAndDue, listAllUsers } from '../controllers/adminController.js';
import { getAllInvestments } from '../controllers/investmentController.js';
import { approveDeposit, approveWithdrawal, getAllTransactions, rejectDeposit, rejectWithdrawal } from '../controllers/transactionController.js';
import { listAllNotifications } from '../controllers/notificationController.js';

const router = Router();

// auth
router.post('/register',  adminRegister)
router.post('/login',  adminLogin)

// User
router.get('/users', auth, admin, listAllUsers)
router.put('/block/:id', auth, admin, blockUser);
router.delete('/user/:id', auth, admin, deleteUser);

// Investments
router.get('/investments/get', auth, admin, getAllInvestments)

//Plans
router.post('/plans/create', auth, admin, createPlan)
router.put('/plans/edit/:id', auth, admin, editPlan)
router.delete('/plans/delete/:id', auth, admin, deletePlan)

//Transactions
router.get('/transactions', auth, admin,  getAllTransactions)
router.patch('/transactions/withdrawals/:id/approve', auth, admin, approveWithdrawal)
router.patch('/transactions/withdrawals/:id/reject', auth, admin, rejectWithdrawal)
router.patch('/admin/deposit/:id/approve', auth,  admin, approveDeposit);
router.patch('/admin/deposit/:id/reject', auth,  admin, rejectDeposit);
router.get('/notifications', auth, admin, listAllNotifications)
router.get('/overview/pending-due', auth, admin, getPendingAndDue);
router.get('/investments/due-tomorrow', auth, admin, getInvestmentsDueTomorrow);

export default router;
