# Momentum Madness

A Solana-based mobile racing and betting application where users predict which crypto asset will have the best performance in short time windows. Built with React Native, Expo, TypeScript, pyth, helius and Anchor.

## What It Does

Momentum Madness is a real-time crypto asset racing game with three distinct phases:

### 🎯 **Core Concept**

- **COMMIT Phase** (30 seconds): Users place USDC bets on crypto assets (BTC, ETH, SOL)
- **PERFORMANCE Phase** (30 seconds): Assets compete in real-time using live Pyth price feeds
- **SETTLED Phase**: Winners claim rewards based on which asset had the highest percentage gain

### 🏆 **Winner-Takes-All System**

- Only the asset with the **highest performance** wins
- Winners share the prize pool proportionally to their bet size
- Smart contract calculates exact payouts using: `(net_pool * bet_amount) / winning_pool`
- Protocol fee: 5% (configurable)

### 🔄 **Real-Time Features**

- Live price updates via Pyth oracles
- WebSocket connections for instant race updates
- Participant counting and live leaderboards
- Mobile Wallet Adapter integration for Solana wallets

## Project Structure

```
Seeker/
├── momentum_madness/          # Solana program and TypeScript utilities
│   ├── onchain/              # Anchor Solana program
│   └── typescript/           # Client utilities and scripts
├── momentum-backend/         # Express.js backend service
├── MomentumMadnessMobile/    # React Native mobile app (v1)
├── MomentumMadnessMobilev2/  # Expo mobile app (v2 - latest)
```

## On-Chain Addresses

### **Main Program**

- **Program ID**: `3jmrCqY1DBayvf1LhdEvFhsfSAsdHb1ieX1LrgnHASp4`
- **Network**: Devnet/Mainnet
- **Anchor Version**: 0.31.1

### **Asset Feed IDs (Pyth)**

- **BTC**: `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`
- **ETH**: `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`
- **SOL**: `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`

### **Key Program Accounts**

- **Config PDA**: `[b"config"]`
- **Treasury PDA**: `[b"treasury"]`
- **Vault PDA**: `[b"vault"]`
- **Race PDA**: `[b"race", race_id]`
- **Bet PDA**: `[b"bet", race.key(), player.key()]`

### **USDC Mint Addresses**

- **Mainnet**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **Devnet**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

## Build & Development Instructions

### Prerequisites

- Node.js 18+ and npm/yarn
- Android Studio (for Android builds)
- Solana CLI and Anchor CLI
- PostgreSQL and Redis (for backend)

### 🔧 **Backend Setup**

#### Development

```bash
cd momentum-backend
npm install
cp .env.example .env
# Edit .env with your configuration
docker-compose up  # Starts PostgreSQL, Redis, and backend
```

#### Production

```bash
cd momentum-backend
docker compose -f docker-compose.prod.yml up -d
```

Includes monitoring with Prometheus (port 3000) and Grafana (port 3001).

### 📱 **Mobile App v2 (Latest - Expo)**

#### Development

```bash
cd MomentumMadnessMobilev2
npm install
npx expo start
```

#### Android APK/AAB Build

```bash
# Development build
npx expo run:android

# Production builds
npx expo build:android --type app-bundle  # AAB for Play Store
npx expo build:android --type apk         # APK for direct install

# Using EAS Build (recommended)
npm install -g @expo/cli eas-cli
eas build --platform android              # Interactive build
eas build --platform android --profile production --local  # Local build
```

#### iOS Build

```bash
npx expo run:ios
# For production: eas build --platform ios
```

### 📱 **Mobile App v1 (React Native)**

#### Development

```bash
cd MomentumMadnessMobile
yarn install
yarn android  # or yarn ios
```

#### Android APK Build

```bash
cd android
./gradlew assembleRelease
# APK location: android/app/build/outputs/apk/release/app-release.apk

# For AAB (App Bundle)
./gradlew bundleRelease
# AAB location: android/app/build/outputs/bundle/release/app-release.aab
```

### ⚓ **Solana Program**

#### Build & Deploy

```bash
cd momentum_madness/onchain
anchor build
anchor deploy --provider.cluster devnet

# Bootstrap protocol (first time)
cd ../typescript
yarn install
npx ts-node bootstrap.ts --cluster devnet
```

#### Local Development

```bash
# Start local validator
solana-test-validator

# Build and deploy locally
anchor build
anchor deploy --provider.cluster localnet
```

### 🧪 **Testing**

```bash
# Backend tests
cd momentum-backend && npm test

# Solana program tests
cd momentum_madness/onchain && anchor test

# Mobile app tests
cd MomentumMadnessMobilev2 && npm test
```

## Environment Configuration

### Backend (.env)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/momentum_madness
REDIS_URL=redis://localhost:6379
RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=3jmrCqY1DBayvf1LhdEvFhsfSAsdHb1ieX1LrgnHASp4
```

### Mobile Apps

Configure backend endpoints in:

- `MomentumMadnessMobilev2/services/backendConfig.ts`
- `MomentumMadnessMobile/services/backendConfig.ts`

## Architecture Overview

### Smart Contract Flow

1. **Initialize Protocol**: Config, Treasury, Vault setup
2. **Create Race**: Lock prices from Pyth feeds, start betting window
3. **Place Bets**: Users commit USDC to asset predictions
4. **Performance Window**: Live price tracking, real-time leaderboard
5. **Settlement**: Calculate winners, distribute payouts

### Backend Services

- **Race Manager**: Tracks race states and user positions
- **Price Service**: Pyth oracle integration
- **WebSocket Service**: Real-time updates
- **Blockchain Poller**: On-chain event monitoring

### Mobile Features

- **Mobile Wallet Adapter**: Solana wallet integration
- **Real-time UI**: Live race animations and updates
- **Haptic Feedback**: Racing-style user feedback
- **Onboarding**: Tutorial system for new users

## Production Deployment

### Android Release Signing

1. Generate signing key:

```bash
keytool -genkey -v -keystore my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. Configure `android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=****
MYAPP_UPLOAD_KEY_PASSWORD=****
```

3. Build signed APK/AAB:

```bash
cd android && ./gradlew assembleRelease  # APK
cd android && ./gradlew bundleRelease   # AAB
```

### Backend Production

- Use `docker-compose.prod.yml` for containerized deployment
- Configure SSL/TLS for WebSocket connections
- Set up monitoring with Prometheus and Grafana
- Use environment-specific RPC endpoints
