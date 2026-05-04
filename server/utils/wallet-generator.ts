import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/init';

// Initialize TronWeb for wallet generation
const TronWeb = require('tronweb').default.TronWeb;
const tronWeb = new TronWeb({
  fullHost: process.env.TRON_FULL_NODE || 'https://nile.trongrid.io',
  headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY },
  privateKey: null // We'll generate new private keys
});

// Helper function to generate a random private key and derive address
const generateTronWallet = () => {
  const crypto = require('crypto');
  
  // Generate a random private key (32 bytes)
  const privateKey = crypto.randomBytes(32).toString('hex');
  
  // Create TronWeb instance with the private key to get the address
  const tempTronWeb = new TronWeb({
    fullHost: process.env.TRON_FULL_NODE || 'https://nile.trongrid.io',
    headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY },
    privateKey: privateKey
  });
  
  const address = tempTronWeb.defaultAddress.base58;
  
  return { address, privateKey };
};

export const generateDepositWallet = async (userId: string): Promise<{ address: string; privateKey: string }> => {
  try {
    // Validate userId
    if (!userId) {
      throw new Error('User ID is required for wallet generation');
    }

    console.log('Starting wallet generation for user:', userId);

    // Check if TronWeb is properly initialized
    if (!tronWeb) {
      throw new Error('TronWeb is not initialized');
    }

    // Generate a new wallet using our helper function
    const { address, privateKey } = generateTronWallet();
    
    console.log('Generated wallet address:', address);
    console.log('Generated wallet privateKey:', privateKey ? 'Present' : 'Missing');
    
    // Validate the generated address
    if (!address || !privateKey) {
      throw new Error('Failed to generate valid wallet address or private key');
    }
    
    // Store in database
    const db = getDatabase();
    const walletId = uuidv4();
    
    await new Promise<void>((resolve, reject) => {
      db.run(
        'INSERT INTO deposit_wallets (id, user_id, wallet_address, private_key) VALUES (?, ?, ?, ?)',
        [walletId, userId, address, privateKey],
        (err) => {
          if (err) {
            console.error('Database insertion error:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
    
    console.log(`Generated deposit wallet ${address} for user ${userId}`);
    return { address, privateKey };
  } catch (error) {
    console.error('Error generating deposit wallet:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to generate deposit wallet');
  }
};

export const getUserDepositWallet = async (userId: string): Promise<{ address: string; privateKey: string } | null> => {
  try {
    // Validate userId
    if (!userId) {
      throw new Error('User ID is required to get deposit wallet');
    }

    const db = getDatabase();
    
    const wallet = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT wallet_address, private_key FROM deposit_wallets WHERE user_id = ? AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (wallet) {
      return { address: wallet.wallet_address, privateKey: wallet.private_key };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user deposit wallet:', error);
    throw new Error('Failed to get user deposit wallet');
  }
};

export const transferToRealAdmin = async (fromPrivateKey: string, amount: number): Promise<string> => {
  try {
    const realAdminAddress = process.env.COMPANY_WALLET_ADDRESS;
    if (!realAdminAddress) {
      throw new Error('Admin wallet address not configured');
    }
    
    // Create TronWeb instance with the deposit wallet's private key
    const tronWebWithKey = new TronWeb({
      fullHost: process.env.TRON_FULL_NODE || 'https://nile.trongrid.io',
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY },
      privateKey: fromPrivateKey
    });
    
    // Get USDT contract
    const USDT_CONTRACT = process.env.TRON_USDT_CONTRACT || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
    const contract = await tronWebWithKey.contract().at(USDT_CONTRACT);
    
    // Convert amount to USDT format (6 decimals)
    const amountInSun = tronWebWithKey.toSun(amount * 1000000);
    
    // Execute transfer
    const transaction = await contract.transfer(realAdminAddress, amountInSun).send({
      feeLimit: 100000000,
      callValue: 0,
    });
    
    console.log(`Transferred ${amount} USDT to real admin wallet: ${transaction}`);
    return transaction;
  } catch (error) {
    console.error('Error transferring to real admin:', error);
    throw new Error('Failed to transfer to real admin wallet');
  }
};
