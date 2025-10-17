# Loyal Spark - Decentralized Loyalty Program

A decentralized loyalty program built on Base Mainnet, enabling merchants to create and manage loyalty point programs and customers to earn, redeem, and transfer their points.

## Overview

Loyal Spark is a Web3-native loyalty rewards platform that leverages ERC-1155 smart contracts on Base Mainnet to provide transparent, decentralized loyalty programs for small and medium-sized businesses.

### Merchant Features
- **Create Loyalty Programs**: Create custom loyalty programs with unique names and symbols
- **Mint Points**: Issue loyalty points to customers via their wallet addresses
- **Multi-Program Support**: Manage multiple loyalty programs from a single interface

### Customer Features
- **View All Points**: See all loyalty points from different merchants in one place
- **Redeem Rewards**: Burn points to redeem rewards
- **Transfer Points**: Send loyalty points to other wallet addresses

## Key Features

### Merchant Panel
- **Wallet Authentication**: Secure merchant wallet connection
- **Point Issuance**: Mint loyalty points to customer addresses
- **Input Validation**: Ethereum address and amount verification
- **Transaction Tracking**: Real-time transaction status and confirmation
- **Restricted Access**: Only authorized merchants can mint points

### Customer Portal
- **Balance Dashboard**: View current loyalty point balance
- **Point Redemption**: Burn points to redeem rewards
- **Real-time Updates**: Refresh balance on-demand
- **Transaction History**: Track redemption transactions
- **Balance Verification**: Automatic insufficient balance checks

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **Blockchain**: Ethers.js v5, Base Mainnet (Chain ID: 8453)
- **Smart Contract**: ERC-1155 Multi-Token Standard
- **State Management**: React Hooks, TanStack Query
- **Routing**: React Router v6
- **Integration**: Farcaster Frame compatible

## Smart Contract Architecture

### Contract Details
- **Network**: Base Mainnet (Chain ID: 8453)
- **Factory Contract**: `0x61b154cAE13F2312D33397419195753D3849F858`
- **Token Contract**: `0xc46481b25a0E6161d87F84C0dd2B0721B891cB4e`
- **Token Standard**: ERC-1155 (Multi-Token)

### Core Functions

#### For Customers
- `balanceOf(address account, uint256 id)` - Query loyalty point balance
- `burnLoyaltyPoints(address account, uint256 tokenId, uint256 amount)` - Redeem (burn) points

#### For Merchants
- `mintLoyaltyPoints(address account, uint256 tokenId, uint256 amount)` - Issue points to customers
- `setTokenURI(uint256 id, string memory newURI)` - Set program metadata (optional)

## Getting Started

### Prerequisites

- Node.js 16+ or Bun
- MetaMask or Web3-compatible wallet browser extension
- Base Mainnet configured in your wallet

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project
cd loyal-spark

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

The smart contract configuration is located in `src/lib/contract.ts`:

```typescript
export const CONTRACT_ADDRESS = "0x25cb40864e5b388e1b8db1530ac24a65a0ffadf5";
export const TOKEN_ID = 1;
export const BASE_CHAIN_ID = 8453;
```

Update these values if deploying your own contract instance.

## Usage

### Portal Selection

Upon loading the application, users choose between two portals:
- **Merchant Panel** - For businesses issuing loyalty points
- **Customer Portal** - For customers viewing and redeeming points

### Merchant Workflow

1. Click "Access Merchant Portal"
2. Connect your merchant wallet (must have mint permissions)
3. Enter customer's wallet address (0x...)
4. Specify amount of loyalty points to issue
5. Click "Mint Loyalty Points"
6. Confirm transaction in wallet
7. Wait for blockchain confirmation

**Note**: Only wallets with merchant privileges can successfully mint points.

### Customer Workflow

1. Click "Access Customer Portal"
2. Connect your wallet
3. View your current loyalty point balance
4. Navigate to redemption section
5. Enter amount of points to redeem
6. Click "Redeem Points"
7. Confirm the burn transaction
8. Receive confirmation of successful redemption

## Farcaster Frame Integration

Loyal Spark is designed to function as a **Farcaster Frame mini-application**, embedded directly into Farcaster social posts (casts).

### Frame Features
- Interactive buttons for portal selection
- Direct wallet connection within Frame context
- Seamless transaction signing
- Mobile-optimized responsive design

### Frame Meta Tags

The application includes Farcaster Frame meta tags in `index.html`:

```html
<meta property="fc:frame" content="vNext" />
<meta property="fc:frame:button:1" content="Merchant Portal" />
<meta property="fc:frame:button:2" content="Customer Portal" />
```

This enables the app to be embedded in Farcaster casts and function as an interactive Frame.

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
loyal-spark/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── PortalSelector.tsx
│   │   ├── MerchantPanel.tsx
│   │   └── CustomerPortal.tsx
│   ├── hooks/
│   │   └── useWeb3.ts       # Web3 wallet connection hook
│   ├── lib/
│   │   ├── contract.ts      # Smart contract config & ABI
│   │   └── utils.ts
│   ├── pages/
│   │   └── Index.tsx        # Main application entry
│   └── index.css            # Design system tokens
├── public/
└── README.md
```

## Security Considerations

- **Wallet Connection**: Uses standard Web3 provider (MetaMask/injected)
- **Transaction Signing**: All transactions require user confirmation
- **Address Validation**: Ethereum addresses validated before transactions
- **Balance Checks**: Insufficient balance prevented client-side
- **Network Verification**: Auto-detection and switching to Base Mainnet
- **Smart Contract**: Merchant permissions enforced on-chain

## Troubleshooting

### Wallet Not Connecting
- Ensure MetaMask or compatible wallet is installed
- Check that you're on Base Mainnet (Chain ID: 8453)
- Try refreshing the page and reconnecting

### Transaction Failing
- Verify you have sufficient ETH for gas fees on Base
- For merchants: Ensure your wallet has minting permissions
- For customers: Check you have sufficient point balance

### Balance Not Updating
- Click "Refresh Balance" button
- Wait a few seconds for blockchain confirmation
- Clear browser cache if issue persists

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support & Contact

For issues, questions, or feature requests:
- Open an issue in the repository
- Join the discussion on Farcaster
- Check the Base network documentation for blockchain-related queries

## Acknowledgments

- Built on [Base](https://base.org) - Ethereum L2 by Coinbase
- UI components by [shadcn/ui](https://ui.shadcn.com)
- Powered by [Ethers.js](https://docs.ethers.org)
- Designed for [Farcaster](https://farcaster.xyz) Frame integration
