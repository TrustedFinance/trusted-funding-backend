import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './src/models/User.js';


dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cryptoapp';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+2348000000000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

async function seedAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    let admin = await User.findOne({ email: ADMIN_EMAIL });

    if (!admin) {
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
      admin = await User.create({
        name: 'System Admin',
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        password: hashed,
        role: 'admin',
        isVerified: true,
      });
      console.log('✅ Admin user created');
    } else {
      console.log('⚠️ Admin already exists');
    }

    // Generate a JWT token so you can test in Postman
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('\n--- Admin Credentials ---');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log(`JWT Token: ${token}\n`);

    await mongoose.disconnect();
    console.log('🚀 Done.');
  } catch (err) {
    console.error('❌ Error seeding admin:', err);
    process.exit(1);
  }
}

seedAdmin();
