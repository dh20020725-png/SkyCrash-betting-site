import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const DB_PATH = './server/database/skycrash.db';

export const initTronWalletTables = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create tron_wallets table for wallet connections
      const createTronWalletsTable = `
        CREATE TABLE IF NOT EXISTS tron_wallets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          wallet_address TEXT UNIQUE NOT NULL,
          is_active BOOLEAN DEFAULT FALSE,
          connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Create token_purchases table for USDT token purchases
      const createTokenPurchasesTable = `
        CREATE TABLE IF NOT EXISTS token_purchases (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          amount REAL NOT NULL,
          usdt_amount REAL NOT NULL,
          tokens_received REAL NOT NULL,
          transaction_hash TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Create tron_transactions table for on-chain operations
      const createTronTransactionsTable = `
        CREATE TABLE IF NOT EXISTS tron_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'token_purchase')),
          amount REAL NOT NULL,
          transaction_hash TEXT,
          withdrawal_address TEXT,
          block_number INTEGER,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'rejected')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Create indexes
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_tron_wallets_user_id ON tron_wallets(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_tron_wallets_address ON tron_wallets(wallet_address)',
        'CREATE INDEX IF NOT EXISTS idx_token_purchases_user_id ON token_purchases(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_token_purchases_status ON token_purchases(status)',
        'CREATE INDEX IF NOT EXISTS idx_tron_transactions_user_id ON tron_transactions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_tron_transactions_status ON tron_transactions(status)',
        'CREATE INDEX IF NOT EXISTS idx_tron_transactions_type ON tron_transactions(transaction_type)'
      ];

      db.run(createTronWalletsTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.run(createTokenPurchasesTable, (err) => {
          if (err) {
            reject(err);
            return;
          }

          db.run(createTronTransactionsTable, (err) => {
            if (err) {
              reject(err);
              return;
            }

            // Create indexes
            createIndexes.forEach((indexSql) => {
              db.run(indexSql);
            });

            console.log('✅ TRON wallet tables initialized successfully');
            resolve();
          });
        });
      });
    });
  });
};

export const getTronDatabase = (): sqlite3.Database => {
  return new sqlite3.Database(DB_PATH);
};
