import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, disconnectDB, getDBStatus } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import Transaction from './models/Transaction.js';
import Budget from './models/Budget.js';
import { SEED_TRANSACTIONS } from './controllers/transactionController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-email'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budget', budgetRoutes);

// User Profile endpoint
app.get('/api/profile', (req, res) => {
  res.json({
    name: 'Alex Thomas',
    email: 'alex@example.com',
    role: 'Premium Member',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
  });
});

// Database Health & Diagnostics check
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await getDBStatus();
    const isHealthy = dbStatus.state === 'connected';

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbStatus
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// Dedicated Database Management Stats endpoint
app.get('/api/db/stats', async (req, res) => {
  try {
    const status = await getDBStatus();
    res.status(200).json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('[API Error]:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

async function autoSeed() {
  try {
    const txCount = await Transaction.countDocuments();
    if (txCount === 0) {
      await Transaction.insertMany(SEED_TRANSACTIONS);
      console.log('[MongoDB] AutoSeeded default SpendWise transactions.');
    }
    const budgetCount = await Budget.countDocuments();
    if (budgetCount === 0) {
      await Budget.create({
        userEmail: 'default',
        monthlyLimit: 20000,
        currency: '₹',
        currencyCode: 'INR (₹)'
      });
      console.log('[MongoDB] AutoSeeded default monthly budget.');
    }
  } catch (err) {
    console.error('[MongoDB] AutoSeed error:', err.message);
  }
}

// Start Server after connecting to MongoDB
let server;

async function startServer() {
  try {
    await connectDB();
    await autoSeed();

    server = app.listen(PORT, () => {
      console.log(`[SpendWise API] Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[SpendWise API] Failed to initialize server:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\n[SpendWise API] Received ${signal}. Initiating graceful shutdown...`);
  if (server) {
    server.close(() => {
      console.log('[SpendWise API] HTTP server closed.');
    });
  }
  await disconnectDB();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
