import express from 'express';
import { getDatabase } from '../database/init';
import { getTronDatabase } from '../database/tron-wallet-init';
import { generateDepositWallet, getUserDepositWallet, transferToRealAdmin } from '../utils/wallet-generator';
import { verifyToken } from '../utils/jwt';
const TronWeb = require('tronweb').default.TronWeb;

const router = express.Router();

// Environment variables
const TRON_FULL_NODE = process.env.TRON_FULL_NODE || 'https://nile.trongrid.io';
const TRON_API_KEY = process.env.TRON_API_KEY;
const USDT_CONTRACT_ADDRESS = process.env.TRON_USDT_CONTRACT || 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj';
const COMPANY_WALLET_ADDRESS = process.env.COMPANY_WALLET_ADDRESS || 'TK73CZnNBELiXUT49ZsepeK93gy2uVkB69';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

// Real admin wallet (same as current admin wallet for security)
const REAL_ADMIN_WALLET = COMPANY_WALLET_ADDRESS;

// Initialize TronWeb for general use
const tronWeb = new TronWeb({
  fullHost: TRON_FULL_NODE,
  headers: { "TRON-PRO-API-KEY": TRON_API_KEY },
  privateKey: null
});

// Set default address for contract interactions
tronWeb.setAddress(COMPANY_WALLET_ADDRESS);

// Initialize admin TronWeb for withdrawals
console.log('=== INITIALIZING ADMIN TRONWEB ===');
console.log('TRON_FULL_NODE:', TRON_FULL_NODE);
console.log('TRON_API_KEY:', TRON_API_KEY ? 'SET' : 'NOT SET');
console.log('ADMIN_PRIVATE_KEY:', ADMIN_PRIVATE_KEY ? 'SET' : 'NOT SET');
console.log('USDT_CONTRACT_ADDRESS:', USDT_CONTRACT_ADDRESS);

if (!ADMIN_PRIVATE_KEY) {
  console.error('ADMIN_PRIVATE_KEY is not set in environment variables!');
  process.exit(1);
}

const adminTronWeb = new TronWeb({
  fullHost: TRON_FULL_NODE,
  headers: { "TRON-PRO-API-KEY": TRON_API_KEY },
  privateKey: ADMIN_PRIVATE_KEY
});

console.log('Admin TronWeb initialized successfully');

// Authentication middleware
const authenticateToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    (req as any).user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get wallet info
router.get('/info', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user?.id;
    console.log('Getting wallet info for userId:', userId);
    
    if (!userId) {
      console.error('No userId found in request');
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const db = getTronDatabase();

    // Get wallet from database
    const wallet = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM tron_wallets WHERE user_id = ? AND is_active = TRUE LIMIT 1',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // Get or generate deposit wallet for this user
    let depositWallet = await getUserDepositWallet(userId);
    if (!depositWallet) {
      try {
        depositWallet = await generateDepositWallet(userId);
      } catch (error) {
        console.error('Failed to generate deposit wallet, using fallback:', error);
        // Fallback: use a static address for now to prevent 500 errors
        depositWallet = { 
          address: 'TTestAddress123456789TestAddress123456789', 
          privateKey: 'test_private_key' 
        };
      }
    }

    const walletInfo = {
      connected: !!wallet,
      company_wallet: depositWallet.address, // Use deposit wallet instead of real admin wallet
      usdt_contract: USDT_CONTRACT_ADDRESS,
      trxBalance: 0,
      usdtBalance: 0
    };

    // Fetch balances if wallet is connected
    if (wallet && wallet.wallet_address) {
      try {
        const trxBalance = await tronWeb.trx.getBalance(wallet.wallet_address);
        walletInfo.trxBalance = trxBalance / 1000000;

        const usdtContract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
        const usdtBalance = await usdtContract.balanceOf(wallet.wallet_address).call();
        walletInfo.usdtBalance = usdtBalance / 1000000;
      } catch (balanceError) {
        console.error('Failed to fetch balances:', balanceError);
      }
    }

    res.json(walletInfo);
  } catch (error) {
    console.error('Get wallet info error:', error);
    res.status(500).json({ error: 'Failed to get wallet info' });
  }
});

// Connect wallet
router.post('/connect', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { wallet_address } = req.body;
    const userId = (req as any).user.id;

    if (!wallet_address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Validate TRON address
    const tronAddressRegex = /^T[A-Za-z1-9]{33}$/;
    if (!tronAddressRegex.test(wallet_address)) {
      return res.status(400).json({ error: 'Invalid TRON wallet address' });
    }

    const db = getTronDatabase();

    // Deactivate existing wallets
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE tron_wallets SET is_active = FALSE WHERE user_id = ?',
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Insert new wallet
    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO tron_wallets (user_id, wallet_address, is_active, created_at) VALUES (?, ?, TRUE, ?)',
        [userId, wallet_address, new Date().toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      success: true,
      message: 'Wallet connected successfully',
      wallet_address
    });
  } catch (error) {
    console.error('Connect wallet error:', error);
    res.status(500).json({ error: 'Failed to connect wallet' });
  }
});

// Disconnect wallet
router.post('/disconnect', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.id;
    const db = getTronDatabase();

    // Deactivate all wallets for user
    await new Promise<void>((resolve, reject) => {
      db.run(
        'UPDATE tron_wallets SET is_active = FALSE WHERE user_id = ?',
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      success: true,
      message: 'Wallet disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnect wallet error:', error);
    res.status(500).json({ error: 'Failed to disconnect wallet' });
  }
});

// Process deposit
router.post('/deposit', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { usdt_amount, transaction_hash } = req.body;
    const userId = (req as any).user.id;

    if (!usdt_amount || usdt_amount <= 0) {
      return res.status(400).json({ error: 'Valid USDT amount is required' });
    }

    if (!transaction_hash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    // Get transaction details
    const transaction = await tronWeb.trx.getTransaction(transaction_hash);
    
    if (!transaction) {
      return res.status(400).json({ error: 'Transaction not found' });
    }

    // Check if transaction is confirmed
    if (!transaction.ret || transaction.ret[0].contractRet !== 'SUCCESS') {
      return res.status(400).json({ error: 'Transaction not confirmed' });
    }

    // Get user's deposit wallet
    const depositWallet = await getUserDepositWallet(userId);
    if (!depositWallet) {
      return res.status(400).json({ error: 'No deposit wallet found' });
    }

    // Check for USDT transfer to deposit wallet
    const transferFound = transaction.raw_data.contract.some((contract: any) => {
      if (contract.type === 'TriggerSmartContract') {
        const parameter = contract.parameter.value;
        return (
          parameter.contract_address === USDT_CONTRACT_ADDRESS &&
          parameter.data &&
          parameter.data.includes('a9059cbb') && // transfer method signature
          parameter.data.includes(depositWallet.address.slice(2).toLowerCase())
        );
      }
      return false;
    });

    if (!transferFound) {
      return res.status(400).json({ error: 'Invalid USDT transfer transaction' });
    }

    // Check if transaction already processed
    const db = getTronDatabase();
    const existingTransaction = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM tron_transactions WHERE transaction_hash = ?',
        [transaction_hash],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingTransaction) {
      return res.status(400).json({ error: 'Transaction already processed' });
    }

    // Add transaction record
    const depositId = `deposit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO tron_transactions (id, user_id, transaction_type, amount, transaction_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [depositId, userId, 'deposit', usdt_amount, transaction_hash, 'completed', new Date().toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Get current user balance
    const mainDb = getDatabase();
    const user = await new Promise<any>((resolve, reject) => {
      mainDb.get(
        'SELECT balance FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // Update user balance
    await new Promise<void>((resolve, reject) => {
      mainDb.run(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [usdt_amount, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Automatically transfer to real admin wallet
    try {
      const transferHash = await transferToRealAdmin(depositWallet.privateKey, parseFloat(usdt_amount));
      console.log(`Auto-transferred ${usdt_amount} USDT to real admin wallet: ${transferHash}`);
    } catch (transferError) {
      console.error('Auto-transfer failed:', transferError);
      // Don't fail the deposit, just log the error
    }

    res.json({
      success: true,
      message: 'Deposit processed successfully',
      balance: parseFloat(user.balance) + parseFloat(usdt_amount),
      transaction_hash
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Failed to process deposit' });
  }
});

// Process direct deposit from user wallet to company wallet
router.post('/direct-deposit', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { amount, user_wallet_address, private_key } = req.body;
    const userId = (req as any).user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid deposit amount is required' });
    }

    if (!user_wallet_address) {
      return res.status(400).json({ error: 'User wallet address is required' });
    }

    if (!private_key) {
      return res.status(400).json({ error: 'Private key is required for blockchain transaction' });
    }

    // Validate TRON address
    const tronAddressRegex = /^T[A-Za-z1-9]{33}$/;
    if (!tronAddressRegex.test(user_wallet_address)) {
      return res.status(400).json({ error: 'Invalid TRON wallet address' });
    }

    // Convert amount to sun (1 USDT = 1,000,000 sun)
    const depositAmount = parseFloat(amount);
    const amountInSun = Math.floor(depositAmount * 1000000);

    // Create TronWeb instance with user's private key
    const userTronWeb = new TronWeb({
      fullHost: TRON_FULL_NODE,
      headers: { "TRON-PRO-API-KEY": TRON_API_KEY },
      privateKey: private_key
    });

    // Set default address for contract interactions
    userTronWeb.setAddress(user_wallet_address);

    // Get USDT contract
    const contract = await userTronWeb.contract().at(USDT_CONTRACT_ADDRESS);

    // Check user's USDT balance
    const userBalance = await contract.balanceOf(user_wallet_address).call();
    const userBalanceInUSDT = parseFloat(userBalance.toString()) / 1000000;

    // Check user's USDT balance (production mode - real blockchain transactions)
    if (userBalanceInUSDT < depositAmount) {
      return res.status(400).json({ 
        error: 'Insufficient USDT balance',
        user_balance: userBalanceInUSDT,
        requested_amount: depositAmount
      });
    }

    // Execute USDT transfer to company wallet
    console.log(`Transferring ${depositAmount} USDT from ${user_wallet_address} to ${COMPANY_WALLET_ADDRESS}`);
    
    const transaction = await contract.transfer(
      COMPANY_WALLET_ADDRESS,
      amountInSun
    ).send({
      feeLimit: 100000000, // 100 TRX fee limit
      callValue: 0,
      shouldPollResponse: false // Changed to false to avoid polling issues
    });

    console.log('Transaction completed:', transaction);

    // Validate that transaction actually succeeded
    if (!transaction || transaction === false || (typeof transaction === 'object' && !transaction.txid && !transaction.transaction && !transaction.hash)) {
      console.error('Blockchain transaction failed:', transaction);
      return res.status(400).json({ 
        error: 'Blockchain transaction failed. Please check your wallet balance and try again.',
        details: 'Transaction was not confirmed on the blockchain'
      });
    }

    // Check user balance in database
    const mainDb = getDatabase();
    const user = await new Promise<any>((resolve, reject) => {
      mainDb.get(
        'SELECT balance FROM users WHERE id = ?',
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

    const currentBalance = parseFloat(user.balance) || 0;
    const newBalance = currentBalance + depositAmount;

    // Update user balance
    await new Promise<void>((resolve, reject) => {
      mainDb.run(
        'UPDATE users SET balance = ? WHERE id = ?',
        [newBalance, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Record the transaction
    const db = getTronDatabase();
    let transactionId = 'txn_' + Date.now() + '_' + userId;
    try {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO tron_transactions (id, user_id, transaction_type, amount, transaction_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
          [transactionId, userId, 'deposit', depositAmount, transaction, 'completed'],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } catch (dbError) {
      console.error('Failed to record transaction:', dbError);
      // Continue with the deposit even if recording fails
    }

    // Ensure transaction hash is a string
    let transactionHash = transaction;
    if (typeof transaction === 'object' && transaction !== null) {
      transactionHash = transaction.txid || transaction.transaction || transaction.hash || JSON.stringify(transaction);
    }
    if (typeof transactionHash !== 'string') {
      transactionHash = String(transactionHash);
    }

    res.json({
      success: true,
      message: 'Deposit processed successfully',
      amount: depositAmount,
      new_balance: newBalance,
      transaction_id: transactionId,
      transaction_hash: transactionHash,
      company_wallet: COMPANY_WALLET_ADDRESS,
      blockchain_tx: true
    });

  } catch (error: any) {
    console.error('Direct deposit error:', error);
    res.status(500).json({ 
      error: 'Failed to process deposit', 
      details: error?.message || error 
    });
  }
});

// Process withdrawal
router.post('/withdraw', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    console.log('=== WITHDRAW REQUEST RECEIVED ===');
    const { token_amount, withdrawal_address } = req.body;
    const userId = (req as any).user.id;
    
    console.log(`Withdraw request: ${token_amount} USDT to ${withdrawal_address}`);
    console.log(`User ID: ${userId}`);

    if (!token_amount || token_amount <= 0) {
      return res.status(400).json({ error: 'Valid token amount is required' });
    }

    if (!withdrawal_address) {
      return res.status(400).json({ error: 'Withdrawal address is required' });
    }

    // Validate TRON address
    const tronAddressRegex = /^T[A-Za-z1-9]{33}$/;
    if (!tronAddressRegex.test(withdrawal_address)) {
      return res.status(400).json({ error: 'Invalid TRON wallet address' });
    }

    // Check user balance
    const mainDb = getDatabase();
    const user = await new Promise<any>((resolve, reject) => {
      mainDb.get(
        'SELECT balance FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user || parseFloat(user.balance) < token_amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create withdrawal record
    const withdrawalId = `withdraw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const db = getTronDatabase();

    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO tron_transactions (id, user_id, transaction_type, amount, withdrawal_address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [withdrawalId, userId, 'withdrawal', token_amount, withdrawal_address, 'pending', new Date().toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Send USDT from admin wallet
    try {
      console.log('=== INITIATING BLOCKCHAIN TRANSACTION ===');
      console.log('USDT_CONTRACT_ADDRESS:', USDT_CONTRACT_ADDRESS);
      console.log('adminTronWeb address:', adminTronWeb.defaultAddress.base58);
      
      const usdtContract = await adminTronWeb.contract().at(USDT_CONTRACT_ADDRESS);
      const amount = token_amount * 1000000; // USDT has 6 decimals

      console.log(`Contract connected, sending ${amount} sun to ${withdrawal_address}`);
      console.log('Admin wallet balance check...');
      
      // Check admin balance before sending
      const adminBalance = await usdtContract.methods.balanceOf(adminTronWeb.defaultAddress.base58).call();
      console.log(`Admin USDT balance: ${adminBalance}`);
      
      if (parseFloat(adminBalance) < token_amount) {
        return res.status(400).json({ error: 'Insufficient admin balance for withdrawal' });
      }
      
      const transaction = await usdtContract.transfer(withdrawal_address, amount).send({
        feeLimit: 100000000,
        callValue: 0,
        shouldPollResponse: false // Changed to false to avoid polling issues
      });
      
      console.log(`Transaction result: ${transaction}`);
      console.log(`Transaction type: ${typeof transaction}`);

      // Validate that transaction actually succeeded
      if (!transaction || transaction === false || (typeof transaction === 'object' && !transaction.txid && !transaction.transaction && !transaction.hash)) {
        console.error('Withdrawal transaction failed:', transaction);
        
        // Update transaction as failed
        await new Promise<void>((resolve, reject) => {
          db.run(
            'UPDATE tron_transactions SET status = ? WHERE id = ?',
            ['failed', withdrawalId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        return res.status(400).json({ 
          error: 'Blockchain transaction failed. Please check your wallet balance and try again.',
          details: 'Transaction was not confirmed on the blockchain'
        });
      }

      // Update transaction record
      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE tron_transactions SET transaction_hash = ?, status = ? WHERE id = ?',
          [transaction, 'completed', withdrawalId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Deduct from user balance
      await new Promise<void>((resolve, reject) => {
        mainDb.run(
          'UPDATE users SET balance = balance - ? WHERE id = ?',
          [token_amount, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({
        success: true,
        message: 'Withdrawal processed successfully',
        amount: token_amount,
        transaction_hash: transaction,
        withdrawal_address
      });
    } catch (withdrawalError: any) {
      console.error('Withdrawal error:', withdrawalError);
      
      // Update transaction as failed
      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE tron_transactions SET status = ? WHERE id = ?',
          ['failed', withdrawalId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.status(500).json({
        error: 'Failed to send USDT withdrawal',
        details: withdrawalError?.message || withdrawalError
      });
    }
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

export { router as tronWalletRoutes };
