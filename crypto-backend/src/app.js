import express, { json, urlencoded, static as serveStatic } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

// Connect DB and start server
const PORT = process.env.PORT || 8080;
connectDB(process.env.MONGO_URI).then(() => {
  server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});

// Security & middleware
app.use(helmet());
app.use('*',cors());
app.use(json());
app.use(urlencoded({ extended: true }));
app.use('/uploads', serveStatic('uploads'));

app.set('trust proxy', 1)

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000 });
app.use(limiter);

// Routes (ES6 import style)
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import investmentRoutes from './routes/investments.js';
import adminRoutes from './routes/admin.js';
import transactionRoutes from './routes/transactions.js';
import notificationRoutes from './routes/notification.js';

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes)

// Socket.io example
io.on('connection', socket => {
  console.log('New client connected:', socket.id);

  socket.on('subscribeBalance', (userId) => {
    socket.join(`user-${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Attach io instance to app for use in controllers
app.set('io', io);

// Background jobs
import './jobs/payoutJob.js';import { connectDB } from './config/db.js';

