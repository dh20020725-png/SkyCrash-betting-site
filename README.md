# TRON Multiplier

A modern web application for TRON blockchain transactions with USDT deposits and withdrawals.

## Features

- **TRON Wallet Integration**: Connect TronLink wallet for seamless blockchain interactions
- **USDT Deposits**: Real-time transaction verification on Nile testnet
- **USDT Withdrawals**: Automated withdrawals with admin wallet
- **User Authentication**: Google OAuth integration
- **Transaction History**: Complete transaction tracking
- **Responsive Design**: Modern UI with Tailwind CSS

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Radix UI** components
- **React Router** for navigation
- **Sonner** for notifications

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **SQLite** for database
- **JWT** for authentication
- **TronWeb** for blockchain interactions
- **Google OAuth** for user authentication

## Getting Started

### Prerequisites
- Node.js 18+
- TronLink browser extension
- Google account for authentication

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd tron-multiplier
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
# Database
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# TRON Configuration - Nile Testnet
TRON_NETWORK=nile
TRON_API_KEY=your-tron-api-key
TRON_USDT_CONTRACT=TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj
TRON_FULL_NODE=https://nile.trongrid.io
COMPANY_WALLET_ADDRESS=your-company-wallet-address
ADMIN_PRIVATE_KEY=your-admin-wallet-private-key
```

### Running the Application

1. Start the backend server:
```bash
npm run server
```

2. Start the frontend development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:8080`

## Project Structure

```
tron-multiplier/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utility functions
│   └── utils/              # Additional utilities
├── server/                 # Backend source code
│   ├── routes/             # API routes
│   ├── database/           # Database setup
│   └── utils/              # Backend utilities
├── public/                 # Static assets
└── server/public/          # Backend static assets
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/google` - Google OAuth
- `POST /api/auth/logout` - User logout

### Wallet
- `GET /api/tron-wallet/info` - Get wallet information
- `POST /api/tron-wallet/connect` - Connect wallet
- `POST /api/tron-wallet/disconnect` - Disconnect wallet
- `POST /api/tron-wallet/deposit` - Process deposit
- `POST /api/tron-wallet/withdraw` - Process withdrawal

## Environment Variables

### Required Variables
- `JWT_SECRET`: Secret key for JWT tokens
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `COMPANY_WALLET_ADDRESS`: Company TRON wallet address
- `ADMIN_PRIVATE_KEY`: Admin wallet private key for withdrawals

### Optional Variables
- `TRON_API_KEY`: TronGrid API key (optional but recommended)
- `TRON_NETWORK`: TRON network (default: nile)
- `TRON_USDT_CONTRACT`: USDT contract address (default: Nile testnet)

## Development

### Scripts
- `npm run dev` - Start frontend development server
- `npm run server` - Start backend server
- `npm run server:dev` - Start backend with nodemon
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

### Database
The application uses SQLite for data storage. Database files are automatically created on first run.

## Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables

3. Start the production server:
```bash
npm run server
```

## Security Notes

- Never commit your private keys to version control
- Use environment variables for sensitive data
- Enable HTTPS in production
- Regularly update dependencies

## License

MIT License

## Support

For support and questions, please open an issue in the repository.
