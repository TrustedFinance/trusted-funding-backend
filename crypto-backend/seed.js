// import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import { recalcUserBalance } from './utils/recalculateBalance.js';
import mongoose from 'mongoose';
// import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';
// import User from './src/models/User.js';


dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cryptoapp';
// const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
// const ADMIN_PHONE = process.env.ADMIN_PHONE || '+2348000000000';
// const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
// const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

// async function seedAdmin() {
//   try {
//     await mongoose.connect(MONGO_URI);
//     console.log('✅ Connected to MongoDB');

//     let admin = await User.findOne({ email: ADMIN_EMAIL });

//     if (!admin) {
//       const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
//       admin = await User.create({
//         name: 'System Admin',
//         email: ADMIN_EMAIL,
//         phone: ADMIN_PHONE,
//         password: hashed,
//         role: 'admin',
//         isVerified: true,
//       });
//       console.log('✅ Admin user created');
//     } else {
//       console.log('⚠️ Admin already exists');
//     }

//     // Generate a JWT token so you can test in Postman
//     const token = jwt.sign(
//       { id: admin._id, role: admin.role },
//       JWT_SECRET,
//       { expiresIn: '7d' }
//     );

//     console.log('\n--- Admin Credentials ---');
//     console.log(`Email: ${ADMIN_EMAIL}`);
//     console.log(`Password: ${ADMIN_PASSWORD}`);
//     console.log(`JWT Token: ${token}\n`);

//     await mongoose.disconnect();
//     console.log('🚀 Done.');
//   } catch (err) {
//     console.error('❌ Error seeding admin:', err);
//     process.exit(1);
//   }
// }

// seedAdmin();



async function runSeedTest() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create or update a test user
    let user = await User.findOne({ email: 'example.com' });

    if (!user) {
      user = await User.create({
        name: 'Chiemerie Okafor',
        email: 'example.com',
        currency: 'NGN',
        balances: {
          BTC: 0.01,
          ETH: 0.01,
          SOL: 0.01,
          USDT: 500,
        },
      });
      console.log('🧩 Created test user');
    } else {
      // Optionally reset balances for testing
      user.balances = { BTC: 0.01, ETH: 0.01, SOL: 0.01, USDT: 500 };
      await user.save();
      console.log('🔄 Reset balances for test user');
    }

    // Recalculate the balance using live prices
    console.log('⚙️  Recalculating total balance...');
    const totalUsd = await recalcUserBalance(user);

    console.log('💰 Test user balances:', user.balances);
    console.log('💵 Total (USD):', totalUsd);

    // Optional: convert to user's currency if needed
    // const ngnRate = await convertUsdToNgn(totalUsd);

    await mongoose.disconnect();
    console.log('✅ Done.');
  } catch (err) {
    console.error('❌ Seed test failed:', err);
  }
}

runSeedTest();

