import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const DB_PATH = './server/database/skycrash.db';

export const initDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create users table
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE,
          password_hash TEXT,
          google_id TEXT UNIQUE,
          first_name TEXT,
          last_name TEXT,
          avatar_url TEXT,
          tron_wallet_address TEXT UNIQUE,
          balance REAL DEFAULT 0.0,
          is_admin BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create user_sessions table for JWT tokens
      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Create game_history table for crash game records
      const createGameHistoryTable = `
        CREATE TABLE IF NOT EXISTS game_history (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          crash_point REAL NOT NULL,
          bet_amount REAL NOT NULL,
          payout REAL,
          won BOOLEAN NOT NULL,
          profit REAL NOT NULL,
          game_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Create cash_transactions table for deposits/withdrawals
      const createCashTransactionsTable = `
        CREATE TABLE IF NOT EXISTS cash_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')),
          amount REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
          payment_method TEXT,
          transaction_hash TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Create user_achievements table for achievements
      const createUserAchievementsTable = `
        CREATE TABLE IF NOT EXISTS user_achievements (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          achievement_id TEXT NOT NULL,
          unlocked BOOLEAN DEFAULT FALSE,
          progress REAL DEFAULT 0,
          unlocked_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          UNIQUE(user_id, achievement_id)
        )
      `;

      // Create deposit_wallets table for temporary deposit addresses
      const createDepositWalletsTable = `
        CREATE TABLE IF NOT EXISTS deposit_wallets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          wallet_address TEXT UNIQUE NOT NULL,
          private_key TEXT NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      // Create indexes
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
        'CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)',
        'CREATE INDEX IF NOT EXISTS idx_users_tron_wallet ON users(tron_wallet_address)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON user_sessions(token_hash)',
        'CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_game_history_created_at ON game_history(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_cash_transactions_user_id ON cash_transactions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_cash_transactions_status ON cash_transactions(status)',
        'CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id)',
        'CREATE INDEX IF NOT EXISTS idx_deposit_wallets_user_id ON deposit_wallets(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_deposit_wallets_address ON deposit_wallets(wallet_address)'
      ];

      db.run(createUsersTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.run(createSessionsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }

          db.run(createGameHistoryTable, (err) => {
            if (err) {
              reject(err);
              return;
            }

            db.run(createCashTransactionsTable, (err) => {
              if (err) {
                reject(err);
                return;
              }

              db.run(createUserAchievementsTable, (err) => {
                if (err) {
                  reject(err);
                  return;
                }

                db.run(createDepositWalletsTable, (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  // Create indexes
                  createIndexes.forEach((indexSql) => {
                    db.run(indexSql);
                  });

                  console.log('✅ Database initialized successfully');
                  resolve();
                });
              });
            });
          });
        });
      });
    });
  });
};

// Database connection pool to prevent connection issues
let dbInstance: sqlite3.Database | null = null;

export const getDatabase = (): sqlite3.Database => {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        throw err;
      }
    });
    
    // Handle database errors
    dbInstance.on('error', (err) => {
      console.error('Database error:', err);
      // Reset connection on error
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
      }
    });
  }
  return dbInstance;
};

// Graceful database cleanup
export const closeDatabase = (): void => {
  if (dbInstance) {
    dbInstance.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database closed successfully');
      }
    });
    dbInstance = null;
  }
};

// Cleanup on process exit
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);
