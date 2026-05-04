import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/init';
import { generateToken, verifyToken, hashToken } from '../utils/jwt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Multer configuration for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads');
    // Ensure upload directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Authentication middleware
const authenticateToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    (req as any).user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

console.log('Auth routes module loaded, setting up endpoints...');

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const db = getDatabase();

    // Check if user already exists
    const existingUser = await new Promise<any>((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();
    const username = email.split('@')[0]; // Extract username from email
    
    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)',
        [userId, email.toLowerCase(), username, passwordHash],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Generate JWT token
    const token = generateToken({ userId, email: email.toLowerCase() });

    // Store session
    const sessionId = uuidv4();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO user_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [sessionId, userId, tokenHash, expiresAt.toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get user data
    const user = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, email, username, first_name, last_name, avatar_url, balance, created_at FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.status(201).json({
      message: 'Account created successfully',
      user,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDatabase();

    // Find user
    const user = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, email, username, password_hash, first_name, last_name, avatar_url, balance FROM users WHERE email = ?',
        [email.toLowerCase()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(401).json({ error: 'No account found with this email' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    // Store session
    const sessionId = uuidv4();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO user_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [sessionId, user.id, tokenHash, expiresAt.toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Return user data without password
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: 'Logged in successfully',
      user: userWithoutPassword,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth GET endpoint - redirects to Google
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
  
  if (!clientId || !callbackUrl) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
    `response_type=code&` +
    `scope=email profile&` +
    `access_type=offline`;
  
  res.redirect(googleAuthUrl);
});

// Google OAuth callback endpoint
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth?error=google_auth_failed`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json() as { 
      access_token?: string; 
      error?: string; 
    };
    
    if (tokenData.error || !tokenData.access_token) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth?error=google_token_failed`);
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json() as { 
      id?: string; 
      email?: string; 
      name?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
    };
    
    if (!userData.id || !userData.email) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth?error=invalid_user_data`);
    }

    // Create or update user in database
    const db = getDatabase();
    let user = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, email FROM users WHERE google_id = ?',
        [userData.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      // Check if user exists with email (link Google account)
      user = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT id, email FROM users WHERE email = ?',
          [userData.email!.toLowerCase()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (user) {
        // Link Google account to existing user
        await new Promise<void>((resolve, reject) => {
          db.run(
            'UPDATE users SET google_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [userData.id, user.id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        // Create new user with Google account
        const userId = uuidv4();
        const username = userData.email!.split('@')[0]; // Extract username from email
        
        await new Promise<void>((resolve, reject) => {
          db.run(
            'INSERT INTO users (id, email, username, google_id, first_name, last_name, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, userData.email!.toLowerCase(), username, userData.id!, userData.given_name || null, userData.family_name || null, userData.picture || null],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        user = { id: userId, email: userData.email!.toLowerCase(), username, first_name: userData.given_name, last_name: userData.family_name, avatar_url: userData.picture, balance: 0.0 };
      }
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    // Store session
    const sessionId = uuidv4();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO user_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [sessionId, user.id, tokenHash, expiresAt.toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Redirect back to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&login=success`);

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth?error=server_error`);
  }
});

// Google OAuth endpoint (simplified for demo)
router.post('/google', async (req, res) => {
  try {
    const { googleId, email } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Google ID and email are required' });
    }

    const db = getDatabase();

    // Check if user exists with Google ID
    let user = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, email FROM users WHERE google_id = ?',
        [googleId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      // Check if user exists with email (link Google account)
      user = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT id, email FROM users WHERE email = ?',
          [email.toLowerCase()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (user) {
        // Link Google account to existing user
        await new Promise<void>((resolve, reject) => {
          db.run(
            'UPDATE users SET google_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [googleId, user.id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        // Create new user with Google account
        const userId = uuidv4();
        await new Promise<void>((resolve, reject) => {
          db.run(
            'INSERT INTO users (id, email, google_id) VALUES (?, ?, ?)',
            [userId, email.toLowerCase(), googleId],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        user = { id: userId, email: email.toLowerCase() };
      }
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    // Store session
    const sessionId = uuidv4();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO user_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
        [sessionId, user.id, tokenHash, expiresAt.toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      message: 'Logged in with Google successfully',
      user,
      token
    });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const payload = verifyToken(token);
    const db = getDatabase();

    // Check if session exists and is valid
    const session = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT s.*, u.email FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.user_id = ? AND s.expires_at > datetime("now")',
        [payload.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    res.json({
      valid: true,
      user: {
        id: payload.userId,
        email: payload.email
      }
    });

  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const payload = verifyToken(token);
    const db = getDatabase();

    // Remove session
    await new Promise<void>((resolve, reject) => {
      db.run(
        'DELETE FROM user_sessions WHERE user_id = ?',
        [payload.userId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Logged out successfully' });

  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get current user info endpoint
router.get('/me', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user!.id;
    const db = getDatabase();
    
    const user = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, email, username, first_name, last_name, avatar_url, balance, google_id, created_at, updated_at FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Profile update endpoint
router.put('/profile', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { username, avatar_url } = req.body;
    const userId = (req as any).user!.id;

    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Username validation: lowercase, numbers, and special characters only
    const usernameRegex = /^[a-z0-9_\-!@#$%^&*()+=<>?]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username can only contain lowercase letters, numbers, and special characters' });
    }

    const db = getDatabase();

    // Check if username is already taken by another user
    const existingUser = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Update user profile
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET username = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [username, avatar_url || null, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get updated user data
    const updatedUser = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT id, email, username, first_name, last_name, avatar_url, balance, google_id, created_at FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Avatar upload endpoint using multer
router.post('/upload-avatar', authenticateToken, upload.single('avatar'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No avatar file provided' });
    }

    const userId = (req as any).user!.id;
    const avatarUrl = `/uploads/${req.file.filename}`;
    
    // Update user's avatar_url in database
    const db = getDatabase();

    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [avatarUrl, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Update user's TRON wallet address
router.put('/tron-wallet', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { tron_wallet_address } = req.body;
    const userId = (req as any).user!.id;

    if (!tron_wallet_address) {
      return res.status(400).json({ error: 'TRON wallet address is required' });
    }

    // Basic TRON address validation
    const tronAddressRegex = /^T[A-Za-z1-9]{33}$/;
    if (!tronAddressRegex.test(tron_wallet_address)) {
      return res.status(400).json({ error: 'Invalid TRON wallet address format' });
    }

    const db = getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET tron_wallet_address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [tron_wallet_address, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ tron_wallet_address });
  } catch (error) {
    console.error('TRON wallet update error:', error);
    res.status(500).json({ error: 'Failed to update TRON wallet address' });
  }
});

// Get transaction history
router.get('/transactions', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user!.id;
    const { type } = req.query;
    const tronDb = require('../database/tron-wallet-init').getTronDatabase();

    let query = 'SELECT * FROM tron_transactions WHERE user_id = ?';
    const params: any[] = [userId];

    if (type && (type === 'deposit' || type === 'withdrawal')) {
      query += ' AND transaction_type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const transactions = await new Promise<any[]>((resolve, reject) => {
      tronDb.all(query, params, (err: any, rows: any) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json({ transactions });
  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

// Add deposit record
router.post('/deposit', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { amount, transaction_hash } = req.body;
    const userId = (req as any).user!.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid deposit amount is required' });
    }

    const db = getDatabase();
    const transactionId = `deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add transaction record
    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO cash_transactions (id, user_id, transaction_type, amount, status, transaction_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [transactionId, userId, 'deposit', amount, 'completed', transaction_hash, new Date().toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Update user balance
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [amount, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ 
      transaction_id: transactionId,
      status: 'completed',
      new_balance: 0 // Will be updated in frontend
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Failed to process deposit' });
  }
});

// Add withdrawal record
router.post('/withdraw', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { amount, tron_wallet_address } = req.body;
    const userId = (req as any).user!.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid withdrawal amount is required' });
    }

    // Get current user balance
    const db = getDatabase();
    const user = await new Promise<any>((resolve, reject) => {
      db.get('SELECT balance, tron_wallet_address FROM users WHERE id = ?', [userId], (err: any, row: any) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    if (!user.tron_wallet_address) {
      return res.status(400).json({ error: 'TRON wallet address required for withdrawals' });
    }

    const transactionId = `withdraw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add transaction record
    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO cash_transactions (id, user_id, transaction_type, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [transactionId, userId, 'withdrawal', amount, 'pending', new Date().toISOString()],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ 
      transaction_id: transactionId,
      status: 'pending',
      message: 'Withdrawal request submitted. Please wait for processing.'
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

export const authRoutes = router;
