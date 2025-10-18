# Loyal Spark - Decentralized Loyalty Rewards Platform

A Web3-powered loyalty rewards platform built on Base Mainnet, enabling merchants to create custom loyalty token programs and offer exclusive voucher rewards to customers.

## Overview

Loyal Spark revolutionizes traditional loyalty programs by bringing them on-chain. Merchants can deploy ERC-20 loyalty tokens, create custom reward vouchers, and manage their programs through an intuitive dashboard. Customers receive blockchain-based loyalty tokens they truly own, which can be redeemed for exclusive vouchers or traded on decentralized exchanges.

### Merchant Features
- **Deploy Loyalty Tokens**: Create custom ERC-20 loyalty tokens with unique names and symbols
- **Mint Tokens**: Issue loyalty points to customers via their wallet addresses
- **Create Rewards**: Design custom voucher rewards with token costs and expiration dates
- **Manage Programs**: Track created tokens and active reward campaigns
- **Voucher Management**: Monitor voucher redemptions and usage

### Customer Features
- **Multi-Token Dashboard**: View all loyalty tokens from different merchants in one place
- **Browse Rewards**: Explore available vouchers across all participating merchants
- **Redeem Vouchers**: Burn loyalty tokens to claim exclusive voucher rewards
- **Manage Vouchers**: Track active vouchers with expiration dates and QR codes
- **DEX Trading**: Trade loyalty tokens on decentralized exchanges
- **Transfer Tokens**: Send loyalty points to other wallet addresses

## Key Features

### For Merchants
- **Token Deployment**: One-click ERC-20 loyalty token creation with custom branding
- **Flexible Minting**: Issue tokens to customer wallets with real-time transaction tracking
- **Reward Creation**: Design voucher rewards with customizable costs and expiration dates
- **Program Management**: Monitor all created tokens and active rewards in one dashboard
- **Voucher Analytics**: Track redemption rates and voucher usage

### For Customers
- **Unified Dashboard**: View loyalty token balances from all participating merchants
- **Reward Marketplace**: Browse and filter available vouchers across all programs
- **Easy Redemption**: Burn tokens to claim vouchers with instant confirmation
- **My Vouchers**: Manage active vouchers with QR codes and expiration tracking
- **DEX Integration**: Trade loyalty tokens on decentralized exchanges
- **Token Transfers**: Send tokens to other wallet addresses

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **Styling**: Framer Motion for animations, next-themes for dark mode
- **Blockchain**: Wagmi v2, Viem, RainbowKit for wallet connection
- **Network**: Base Mainnet (Chain ID: 8453)
- **Smart Contract**: ERC-20 Token Standard
- **Backend**: Lovable Cloud (Supabase) for voucher management
- **State Management**: React Hooks, TanStack Query v5
- **Routing**: React Router v6
- **Forms**: React Hook Form with Zod validation

## Smart Contract Architecture

### Contract Details
- **Network**: Base Mainnet (Chain ID: 8453)
- **Factory Contract**: `0x61b154cAE13F2312D33397419195753D3849F858`
- **Token Standard**: ERC-20 (Standard Token)
- **Deployed via**: Factory pattern for gas-efficient token creation

### Core Functions

#### Token Operations
- `balanceOf(address account)` - Query token balance
- `transfer(address to, uint256 amount)` - Transfer tokens between wallets
- `burn(uint256 amount)` - Burn tokens for voucher redemption
- `mint(address to, uint256 amount)` - Issue new tokens (merchant only)

#### Merchant Functions
- `deployLoyaltyToken(string name, string symbol)` - Deploy new ERC-20 token
- Token ownership and minting rights controlled by deployer

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- MetaMask, Coinbase Wallet, or any WalletConnect-compatible wallet
- Base Mainnet configured in your wallet
- Some ETH on Base Mainnet for gas fees

### Installation

```bash
# Clone the repository
git clone https://github.com/aspekt19/unboxed-loyalty-spark.git

# Navigate to project
cd unboxed-loyalty-spark

# Install dependencies
npm install

# Start development server
npm run dev
```

### Wallet Setup

To use Loyal Spark, ensure your wallet is connected to **Base Mainnet**:

1. **Network Name**: Base Mainnet
2. **Chain ID**: 8453
3. **RPC URL**: https://mainnet.base.org
4. **Currency Symbol**: ETH
5. **Block Explorer**: https://basescan.org

The application will automatically prompt you to switch networks if you're on a different chain.

### Configuration

The smart contract configuration is located in `src/config/contracts.ts` and Wagmi config in `src/config/wagmi.ts`:

```typescript
// Factory contract for deploying loyalty tokens
export const FACTORY_ADDRESS = "0x61b154cAE13F2312D33397419195753D3849F858";
export const BASE_CHAIN_ID = 8453;
```

The application uses RainbowKit for wallet connections and supports multiple wallet providers.

## Usage

### For Merchants

#### Creating a Loyalty Program
1. Navigate to the Merchant Panel
2. Connect your wallet using RainbowKit
3. Go to "Create Loyalty Program"
4. Enter token name and symbol
5. Deploy your ERC-20 loyalty token
6. Share your token address with customers

#### Issuing Tokens
1. Select your token from "Created Programs"
2. Enter customer wallet address
3. Specify token amount
4. Confirm minting transaction
5. Tokens appear in customer's wallet instantly

#### Creating Rewards
1. Go to "Create Reward" section
2. Select your loyalty token
3. Set reward details (name, description, cost)
4. Add expiration date
5. Upload reward image
6. Publish reward for customers

### For Customers

#### Viewing Tokens
1. Navigate to Customer Panel
2. Connect your wallet
3. View all loyalty tokens from participating merchants
4. Check token balances and details

#### Redeeming Vouchers
1. Browse available rewards in "Rewards" section
2. Select desired voucher
3. Confirm token burn transaction
4. Voucher appears in "My Vouchers"
5. Present QR code to merchant

#### Trading on DEX
1. Go to "DEX" section in Customer Panel
2. View token details and DEX links
3. Trade tokens on supported DEXs

## Database & Backend

Loyal Spark uses Lovable Cloud (powered by Supabase) for managing vouchers and rewards:

### Database Tables
- **loyalty_tokens**: Stores deployed token information
- **rewards**: Manages created voucher rewards
- **vouchers**: Tracks redeemed vouchers per user
- **voucher_redemptions**: Records redemption history

### Features
- Row Level Security (RLS) for data protection
- Real-time updates for voucher status
- Secure file storage for reward images
- Automatic timestamp tracking

## Development

```bash
# Development server with hot reload
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Preview production build locally
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
unboxed-loyalty-spark/
├── src/
│   ├── components/
│   │   ├── ui/                      # shadcn/ui component library
│   │   ├── rewards/                 # Reward & voucher components
│   │   ├── CreateLoyaltyProgram.tsx # Token deployment
│   │   ├── CreatedPrograms.tsx      # Merchant token list
│   │   ├── MerchantPanel.tsx        # Merchant dashboard
│   │   ├── CustomerPanel.tsx        # Customer dashboard
│   │   ├── DexIntegration.tsx       # DEX trading interface
│   │   └── WalletConnectButton.tsx  # RainbowKit wallet connection
│   ├── hooks/
│   │   ├── useDeployLoyaltyToken.ts # Token deployment hook
│   │   ├── useMintTokens.ts         # Minting functionality
│   │   ├── useBurnTokens.ts         # Token burning for vouchers
│   │   ├── useTransferTokens.ts     # Token transfers
│   │   └── useTokenBalance.ts       # Balance queries
│   ├── config/
│   │   ├── contracts.ts             # Contract addresses & ABIs
│   │   └── wagmi.ts                 # Wagmi configuration
│   ├── integrations/
│   │   └── supabase/                # Database client & types
│   ├── pages/
│   │   ├── Index.tsx                # Landing page
│   │   ├── MerchantPage.tsx         # Merchant portal
│   │   └── CustomerPage.tsx         # Customer portal
│   ├── lib/
│   │   ├── utils.ts                 # Utility functions
│   │   └── vouchers.ts              # Voucher management
│   └── index.css                    # Design system tokens
├── public/
│   └── media-kit/                   # Brand assets & press materials
├── supabase/
│   └── config.toml                  # Supabase configuration
└── README.md
```

## Security Considerations

- **Wallet Connection**: Multi-provider support via RainbowKit (MetaMask, Coinbase Wallet, WalletConnect)
- **Transaction Signing**: All blockchain transactions require explicit user confirmation
- **Address Validation**: Ethereum address validation before all operations
- **Database Security**: Row Level Security (RLS) policies protect user data
- **Token Ownership**: Only token deployers can mint new tokens
- **Network Verification**: Automatic Base Mainnet network detection and switching
- **Voucher Validation**: Server-side checks prevent duplicate redemptions

## Troubleshooting

### Wallet Connection Issues
- Ensure you have a Web3 wallet installed (MetaMask, Coinbase Wallet, etc.)
- Check that you're on Base Mainnet (Chain ID: 8453)
- Try disconnecting and reconnecting your wallet
- Clear browser cache and refresh

### Transaction Failures
- Verify sufficient ETH for gas fees on Base Mainnet
- Check network congestion (try increasing gas limit)
- For minting: Ensure you're the token deployer
- For burning: Confirm sufficient token balance

### Voucher Redemption Issues
- Ensure tokens are burned successfully before voucher creation
- Check voucher expiration dates
- Verify wallet connection is active
- Refresh the page if vouchers don't appear immediately

### DEX Trading Not Working
- Ensure token has liquidity on the DEX
- Check that you've approved the DEX to spend your tokens
- Verify sufficient token balance for trade

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code follows the existing patterns and includes appropriate error handling.

## License

MIT License - see LICENSE file for details

## Links & Resources

- **Website**: https://loyalspark.online
- **GitHub**: https://github.com/aspekt19/unboxed-loyalty-spark
- **Twitter/X**: https://x.com/Loyal_Spark
- **Contact**: gerassyk@gmail.com

## Built With

- [Base](https://base.org) - Ethereum L2 Network by Coinbase
- [Wagmi](https://wagmi.sh) - React Hooks for Ethereum
- [RainbowKit](https://www.rainbowkit.com) - Wallet Connection Library
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI Components
- [Lovable](https://lovable.dev) - Full-Stack Development Platform
- [Viem](https://viem.sh) - TypeScript Interface for Ethereum
- [TanStack Query](https://tanstack.com/query) - Powerful Data Synchronization

## Acknowledgments

Special thanks to the Base, Wagmi, and RainbowKit communities for excellent developer tools and documentation.
