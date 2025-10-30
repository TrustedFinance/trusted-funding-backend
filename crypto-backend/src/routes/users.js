import express from 'express';
import { getProfile, uploadKyc, selectCountryCurrency, deleteAccount, updateProfile, changePassword, getAllPlansForUser } from '../controllers/userController.js';
import auth from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';


const router = express.Router();

// router.get('/me', auth, getProfile);
router.post('/kyc', auth, upload.fields([{ name: 'selfie' }, { name: 'idImage' }]), uploadKyc);
router.get('/me', auth, getProfile);
router.patch('/update', auth, updateProfile);
router.post('/select-country-currency', auth, selectCountryCurrency);
router.delete('/me', auth, deleteAccount);
router.get('/plans', auth, getAllPlansForUser)
router.patch('/change-password', auth, changePassword)


export default router;
