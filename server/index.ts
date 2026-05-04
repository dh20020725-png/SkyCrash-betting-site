import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fileUpload from 'express-fileupload';

// Load environment variables from the project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { authRoutes } from './routes/auth';
import { tronWalletRoutes } from './routes/tron-wallet';
import { adminRoutes } from './routes/admin';
import { initDatabase } from './database/init';
import { initTronWalletTables } from './database/tron-wallet-init';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Add timeout middleware to prevent hanging requests
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    console.log('Request timeout:', req.method, req.url);
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// Add error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Routes
console.log('Loading auth routes...');
app.use('/api/auth', authRoutes);

console.log('Loading TRON wallet routes...');
app.use('/api/tron-wallet', tronWalletRoutes);

console.log('Loading admin routes...');
app.use('/api/admin', adminRoutes);

// Add direct Google OAuth callback route (without /api prefix)
app.use('/auth', authRoutes);
app.use('/tron-wallet', tronWalletRoutes);

console.log('Auth and TRON wallet routes loaded');

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Direct test route
app.post('/api/direct-test', (req, res) => {
  res.json({ message: 'Direct route working!', body: req.body });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    await initTronWalletTables();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔓 Auth endpoints: http://localhost:${PORT}/api/auth/register`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
