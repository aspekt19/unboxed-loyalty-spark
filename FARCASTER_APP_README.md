# Loyal Spark Farcaster Application

A decentralized loyalty program application integrated with Farcaster, built on blockchain technology.

## Overview

Loyal Spark Farcaster App enables merchants and customers to participate in a tokenized loyalty ecosystem through the Farcaster social network. Users can authenticate with their Farcaster account and choose their role (merchant or customer) to access relevant features.

## Features

### For Merchants
- **Create Loyalty Programs**: Deploy ERC-20 loyalty tokens on the blockchain
- **Issue Tokens**: Reward customers with loyalty tokens
- **Manage Rewards**: Create and manage reward vouchers
- **Track Programs**: Monitor token distribution and program status
- **Set Expiration**: Configure program end dates with automatic token burning

### For Customers
- **Collect Tokens**: Receive loyalty tokens from merchants
- **View Portfolio**: Track all collected loyalty tokens in one place
- **Redeem Rewards**: Exchange tokens for merchant vouchers
- **Trade on DEX**: Swap tokens on decentralized exchanges
- **Manage Vouchers**: View and use redeemed vouchers

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **Blockchain**: Wagmi + Viem + RainbowKit for Web3 integration
- **Authentication**: Farcaster Auth Kit + Supabase
- **Backend**: Lovable Cloud (Supabase)
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6
- **UI Components**: Radix UI + shadcn/ui

## Architecture

### Smart Contracts
- **LoyaltyTokenFactory**: Deploys individual loyalty token contracts
- **LoyalSparkERC20**: ERC-20 compliant loyalty tokens with merchant controls

### Database Schema
- **profiles**: User profiles with wallet addresses and role selection
- **loyalty_programs**: Merchant-created loyalty programs
- **issued_tokens**: Token issuance history
- **rewards**: Merchant-defined rewards catalog
- **vouchers**: Customer-redeemed reward vouchers

### Key Components

#### Authentication Flow
1. User connects wallet (RainbowKit)
2. User signs authentication message for Farcaster
3. Session created in Supabase
4. Profile synced with wallet address

#### Role Selection
1. Authenticated users see role selector
2. Choice saved to `profiles.role` in database
3. Role determines UI and available features
4. Users can switch roles anytime

## Setup Instructions

### Prerequisites
- Node.js 18+ or Bun
- A wallet (MetaMask, Rainbow, etc.)
- Farcaster account

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd loyal-spark-farcaster
```

2. **Install dependencies**
```bash
npm install
# or
bun install
```

3. **Environment Setup**

The project uses Lovable Cloud for backend services. Environment variables are automatically configured:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

For blockchain configuration, see `src/config/wagmi.ts`.

4. **Run development server**
```bash
npm run dev
# or
bun dev
```

5. **Build for production**
```bash
npm run build
# or
bun build
```

## Creating a Separate Repository

### Option 1: Using Lovable GitHub Integration (Recommended)

1. **Connect to GitHub**
   - In Lovable editor: Click "GitHub" → "Connect to GitHub"
   - Authorize the Lovable GitHub App
   - Select your GitHub account/organization

2. **Create Repository**
   - Click "Create Repository"
   - Choose repository name (e.g., `loyal-spark-farcaster`)
   - Repository will be created with all current code

3. **Automatic Sync**
   - Changes in Lovable automatically push to GitHub
   - Changes pushed to GitHub automatically sync to Lovable
   - Two-way sync happens in real-time

### Option 2: Manual Export

1. **Export from Lovable**
   - Download project as ZIP
   - Extract to local directory

2. **Create GitHub Repository**
   - Go to GitHub.com
   - Create new repository
   - Clone to local machine

3. **Copy Files**
   - Copy all files from extracted ZIP
   - Commit and push to GitHub

## Smart Contract Deployment

The application uses pre-deployed smart contracts on **BASE Network**:

- **LoyaltyTokenFactory**: `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80`
- **LoyalSparkERC20 (Implementation)**: `0xe6BA426C9c51281B929a17444De02c65815E27C3`
- **Network**: BASE (Chain ID: 8453)

Contract addresses are configured in `src/config/contracts.ts`.

## Usage Guide

### For Merchants

1. **Connect Wallet** - Use RainbowKit to connect your wallet
2. **Authenticate** - Sign in with your Farcaster account
3. **Select Role** - Choose "Merchant" role
4. **Create Program** - Deploy a new loyalty token contract
5. **Issue Tokens** - Send tokens to customer wallet addresses
6. **Create Rewards** - Define reward vouchers customers can redeem

### For Customers

1. **Connect Wallet** - Use RainbowKit to connect your wallet
2. **Authenticate** - Sign in with your Farcaster account
3. **Select Role** - Choose "Customer" role
4. **View Tokens** - See all loyalty tokens in your wallet
5. **Redeem Rewards** - Exchange tokens for vouchers
6. **Trade Tokens** - Swap tokens on the DEX integration

## Database Migrations

Database schema is managed through Supabase migrations in `supabase/migrations/`.

Key tables:
- `profiles`: User data with role selection
- `loyalty_programs`: Merchant programs
- `issued_tokens`: Token distribution history
- `rewards`: Available rewards
- `vouchers`: Redeemed vouchers

Row Level Security (RLS) policies ensure data privacy:
- Users can only see their own data
- Merchants can manage their programs
- Customers can view public rewards

## Edge Functions

Located in `supabase/functions/`:

- **check-program-expiration**: Automated program expiration handling
- **get-token-holders**: Retrieve token holder analytics

## Configuration Files

- `vite.config.ts`: Vite build configuration
- `tailwind.config.ts`: Design system configuration
- `src/config/wagmi.ts`: Blockchain network configuration
- `src/config/contracts.ts`: Smart contract addresses
- `supabase/config.toml`: Backend configuration (auto-generated)

## Design System

The application uses a custom design system with semantic tokens:

- Colors defined in `src/index.css`
- Theme configured in `tailwind.config.ts`
- All components use semantic tokens (no hardcoded colors)
- Supports light/dark mode

## Security

- **RLS Policies**: All database tables protected with Row Level Security
- **Wallet Authentication**: Signature-based authentication
- **Smart Contract Auditing**: Review contracts before deployment
- **Environment Variables**: Sensitive data never committed to repository

## Troubleshooting

### Wallet Connection Issues
- Ensure wallet extension is installed and unlocked
- Check network selection in wallet
- Try refreshing the page

### Transaction Failures
- Verify sufficient gas in wallet
- Check contract addresses in configuration
- Ensure correct network selection

### Authentication Errors
- Clear browser cache and localStorage
- Reconnect wallet
- Check Supabase connection

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

- **Email**: info@loyalspark.online
- **Documentation**: See README files in `/public/media-kit/`
- **Smart Contracts**: See `README_LOYALTY_TOKEN_FACTORY.md` and `README_LOYAL_SPARK_ERC20.md`
- **Tokenomics**: See `src/pages/pitch-deck/TOKENOMICS.md`

## Roadmap

- [ ] Mobile app with Capacitor
- [ ] Multi-chain support
- [ ] Advanced DEX features
- [ ] Merchant analytics dashboard
- [ ] Customer reward recommendations
- [ ] Social features integration with Farcaster

## Links

- [Lovable Documentation](https://docs.lovable.dev)
- [Farcaster Auth Kit](https://docs.farcaster.xyz/auth-kit/)
- [Wagmi Documentation](https://wagmi.sh)
- [Supabase Documentation](https://supabase.com/docs)
