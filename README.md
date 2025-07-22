# 🎨 Monad Pixels - On-Chain Art With Frens on [Monad](https://monad.xyz)

> Transform digital creativity into permanent blockchain art, one pixel at a time.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.0-blue)](https://soliditylang.org/)

## ✨ What is Monad Pixels?

Monad Pixels is a revolutionary on-chain pixel art platform where **every single pixel is an NFT**. Create, own, trade, and collaborate on pixel art that lives forever on the blockchain.

### 🚀 Key Features

- **🎯 Pixel-Perfect NFTs**: Each pixel is individually minted as an NFT with unique properties
- **🤝 Delegate & Collaborate**: Share pixel ownership with friends and create together
- **🧩 Compose & Decompose**: Combine small pixels into larger NFT artworks or break them apart
- **⛓️ Fully On-Chain**: All pixel data and metadata stored permanently on blockchain
- **🎨 Infinite Canvas**: Create anything from 8-bit sprites to complex masterpieces

## 🎮 How It Works

### 1. **Mint Pixels** 🎨
```
Draw → Mint → Own
```
Each pixel you draw becomes a unique NFT with:
- Color value (RGB/Hex)
- Position coordinates (X, Y)
- Creation timestamp
- Artist signature

### 2. **Delegate to Friends** 👥
```
Your Pixel → Delegate → Friend's Wallet
```
- Grant drawing rights to collaborators
- Maintain ownership while sharing creative control
- Perfect for collaborative art projects

### 3. **Compose Masterpieces** 🖼️
```
Pixel A + Pixel B + Pixel C = Composite NFT
```
- Combine multiple pixels into larger artworks
- Create collections and series
- Maintain provenance of individual components

### 4. **Decompose When Needed** 🔄
```
Composite NFT → Individual Pixels
```
- Break apart compositions back to individual pixels
- Redistribute pixels to different owners
- Flexible ownership models

## 🛠️ Technical Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Pixel NFT     │    │  Delegation     │    │  Composition    │
│   Contract      │◄──►│   Manager       │◄──►│   Engine        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │   Metadata      │
                    │   Registry      │
                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js v16+
- MetaMask or compatible Web3 wallet
- Some Monad (MON) for gas fees

### Installation

```bash
git clone https://github.com/Vinhhjk/monad-pixels
cd mon-pixels
npm install
```
### Edit environment variables
NEXT_PUBLIC_PROJECT_ID=""
NEXT_PUBLIC_RPC_URL=""
NEXT_PUBLIC_MAGIC_EDEN_API_KEY=""

### Deploy Contracts


### Start Drawing!

```bash
npm run dev
```

Visit `http://localhost:3000` and start creating your pixel masterpiece!

## 🎨 Usage Examples

### Mint a Single Pixel
```javascript
// Mint a red pixel at position (10, 15)
await pixelContract.mintPixel(10, 15, "#FF0000");
```

### Delegate Pixel Rights
```javascript
// Allow friend to modify your pixel
await pixelContract.delegatePixel(tokenId, friendAddress);
```

### Compose Multiple Pixels
```javascript
// Combine pixels into a larger NFT
const pixelIds = [1, 2, 3, 4];
await compositionContract.compose(pixelIds, "My Artwork");
```

## 🌟 Use Cases

- **Digital Art Collections**: Create and sell unique pixel art series
- **Collaborative Projects**: Work together on large-scale pixel murals
- **Gaming Assets**: Design and trade in-game sprites and items
- **Brand Logos**: Create corporate logos with verifiable ownership
- **Community Art**: Build shared canvases with friends and communities

## 🏗️ Project Structure

```
mon-pixels/
├── contracts/          # Smart contracts
│   ├── PixelNFT.sol   # Core pixel NFT contract
├── app/               # React/Next.js frontend
├── components/        # Frontend Components
├── config/            # Wallet Provider (Reown) Cofig
├── context/           # Wallet Provider (Reown) Context
└── contractABI/       # Contract ABI
```

## 🤝 Contributing

I love contributions! Whether you're:
- 🐛 Reporting bugs
- 💡 Suggesting features
- 🔧 Submitting code improvements
- 📖 Improving documentation


## 📜 License

This project is licensed under the MIT License .

## 🔗 Links

- **Website**: [pixels.monadfrens.fun](https://pixels.monadfrens.fun)
- **NFTs Data UI**:[pixels.monadfrens.fun/nft](https://pixels.monadfrens.fun/nft)
- **X (Twitter)**: [@WagmiArc](https://x.com/WagmiArc)
- **Explorer**: [Monad Explorer](https://testnet.monadexplorer.com/token/0x82D0B70aD6Fcdb8aAD6048f86afca83D69F556b9)
- **Magic Eden**: [View Collection](https://magiceden.io/collections/monad-testnet/0x82D0B70aD6Fcdb8aAD6048f86afca83D69F556b9)

## 🎯 Roadmap

- [x] Core pixel minting functionality
- [x] Delegation system
- [x] Basic composition/decomposition
- [ ] Advanced canvas tools
- [ ] Mobile app
- [ ] Pixel marketplace
- [ ] Community governance

---

**Made with ❤️ by B(WagmiArc)**

*Every pixel tells a story. What's yours?*