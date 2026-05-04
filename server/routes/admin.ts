import express from 'express';
import { getTronDatabase } from '../database/tron-wallet-init';
import { v4 as uuidv4 } from 'uuid';
const TronWeb = require('tronweb').default.TronWeb;

// Initialize TronWeb with admin private key for sending withdrawals
const tronWeb = new TronWeb({
  fullHost: process.env.TRON_FULL_NODE || 'https://nile.trongrid.io',
  headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY },
  privateKey: process.env.ADMIN_PRIVATE_KEY // Admin wallet private key
});

const USDT_CONTRACT_ADDRESS = process.env.TRON_USDT_CONTRACT || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

// Authentication middleware for admin
const authenticateAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Admin access token required' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is admin (you should add an is_admin field to users table)
    const mainDb = require('../database/init').getDatabase();
    const admin = await new Promise<any>((resolve, reject) => {
      mainDb.get(
        'SELECT is_admin FROM users WHERE id = ?',
        [decoded.userId],
        (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    (req as any).admin = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }
};

const router = express.Router();

// Get all pending withdrawals
router.get('/withdrawals/pending', authenticateAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const db = getTronDatabase();

    const pendingWithdrawals = await new Promise<any[]>((resolve, reject) => {
      db.all(`
        SELECT tw.*, u.email, u.username 
        FROM tron_transactions tw
        JOIN users u ON tw.user_id = u.id
        WHERE tw.transaction_type = 'withdrawal' AND tw.status = 'pending'
        ORDER BY tw.created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ pending_withdrawals: pendingWithdrawals });
  } catch (error) {
    console.error('Get pending withdrawals error:', error);
    res.status(500).json({ error: 'Failed to fetch pending withdrawals' });
  }
});

// Approve and process withdrawal
router.post('/withdrawals/approve', authenticateAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { withdrawal_id, send_real_usdt = false } = req.body;

    if (!withdrawal_id) {
      return res.status(400).json({ error: 'Withdrawal ID is required' });
    }

    const db = getTronDatabase();

    // Get withdrawal details
    const withdrawal = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM tron_transactions WHERE id = ? AND transaction_type = "withdrawal" AND status = "pending"',
        [withdrawal_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!withdrawal) {
      return res.status(404).json({ error: 'Pending withdrawal not found' });
    }

    let transactionHash = null;
    let status = 'completed';

    if (send_real_usdt) {
      // Send actual USDT to user's withdrawal address
      try {
        const usdtContract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
        const amount = withdrawal.amount * 1000000; // USDT has 6 decimals

        const transaction = await usdtContract.transfer(
          withdrawal.withdrawal_address,
          amount
        ).send({
          feeLimit: 100000000,
          callValue: 0,
          shouldPollResponse: true
        });

        transactionHash = transaction;
      } catch (tronError) {
        console.error('Failed to send USDT:', tronError);
        return res.status(500).json({ error: 'Failed to send USDT transaction' });
      }
    } else {
      // Mark as completed without sending real USDT (for testing)
      transactionHash = 'test-approval-' + uuidv4();
    }

    // Update withdrawal status
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE tron_transactions SET status = ?, transaction_hash = ?, completed_at = ? WHERE id = ?',
        [status, transactionHash, new Date().toISOString(), withdrawal_id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      withdrawal_id,
      status,
      transaction_hash: transactionHash,
      message: `Withdrawal approved and processed${send_real_usdt ? ' with real USDT transfer' : ' (test mode)'}`
    });

  } catch (error) {
    console.error('Approve withdrawal error:', error);
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
});

// Reject withdrawal and refund user balance
router.post('/withdrawals/reject', authenticateAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { withdrawal_id, reason } = req.body;

    if (!withdrawal_id) {
      return res.status(400).json({ error: 'Withdrawal ID is required' });
    }

    const db = getTronDatabase();

    // Get withdrawal details
    const withdrawal = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM tron_transactions WHERE id = ? AND transaction_type = "withdrawal" AND status = "pending"',
        [withdrawal_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!withdrawal) {
      return res.status(404).json({ error: 'Pending withdrawal not found' });
    }

    // Update withdrawal status to rejected
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE tron_transactions SET status = ?, completed_at = ? WHERE id = ?',
        ['rejected', new Date().toISOString(), withdrawal_id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Refund user balance
    const mainDb = require('../database/init').getDatabase();
    await new Promise<void>((resolve, reject) => {
      mainDb.run(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [withdrawal.amount, withdrawal.user_id],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      withdrawal_id,
      status: 'rejected',
      refunded_amount: withdrawal.amount,
      reason: reason || 'Withdrawal rejected by admin',
      message: 'Withdrawal rejected and balance refunded'
    });

  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

// Get all transactions (admin view)
router.get('/transactions', authenticateAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { type, status, limit = 100 } = req.query;
    const db = getTronDatabase();

    let query = `
      SELECT tt.*, u.email, u.username 
      FROM tron_transactions tt
      JOIN users u ON tt.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type && ['deposit', 'withdrawal', 'token_purchase'].includes(type as string)) {
      query += ' AND tt.transaction_type = ?';
      params.push(type);
    }

    if (status && ['pending', 'completed', 'failed', 'rejected'].includes(status as string)) {
      query += ' AND tt.status = ?';
      params.push(status);
    }

    query += ' ORDER BY tt.created_at DESC LIMIT ?';
    params.push(parseInt(limit as string));

    const transactions = await new Promise<any[]>((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({ transactions });
  } catch (error) {
    console.error('Get admin transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

export { router as adminRoutes };
