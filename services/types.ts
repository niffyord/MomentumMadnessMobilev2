import { PublicKey } from '@solana/web3.js'

// Enhanced contract types from the IDL

export enum RaceState {
  Betting = 'Betting',
  Running = 'Running',
  SettlementReady = 'SettlementReady',
  Settled = 'Settled',
}

export interface AssetMeta {
  feedId: Uint8Array; // 32-byte Pyth feed ID
  symbol: string;     // Display name like "BTC", "ETH", "SOL"
}

export interface RaceDetails {
  raceId: number;
  state: RaceState;
  startTs: number;
  lockTs: number;
  settleTs: number;
  totalPool: number;
  assetPools: number[];
  winningAssets: number[];
  winningPool: number;
  netPool: number;
  claimedPool: number;
  feeBps: number;
  payoutRatio: number; // u128 from contract
  dustSwept: boolean;
  currentChanges: (number | null)[];
}

export interface BetDetails {
  raceId: number;
  player: PublicKey;
  assetIdx: number;
  amount: number;
  claimed: boolean;
  isWinner: boolean;
  potentialPayout: number | null;
}

export interface ProtocolStats {
  protocolFeeBps: number;
  paused: boolean;
  totalAssets: number;
  treasuryBalance: number;
  vaultBalance: number;
  lastRaceCreationTs: number;
}

export interface AssetInfo {
  index: number;
  feedId: Uint8Array; // 32-byte Pyth feed ID
  currentPrice: number | null;
  currentExponent: number | null;
  currentConf: number | null;
  symbol: string;
}

export interface UserBetSummary {
  raceId: number;
  assetIdx: number;
  amount: number;
  potentialPayout: number | null;
  isWinner: boolean | null;
  claimed: boolean;
  raceState: RaceState;
}

// Enhanced event types
export interface RaceCreatedEvent {
  raceId: number;
  startTs: number;
  lockTs: number;
  settleTs: number;
  authority: PublicKey;
  assets: AssetMeta[];
  commitWindow: number;
  performanceWindow: number;
}

export interface BetPlacedEvent {
  raceId: number;
  player: PublicKey;
  assetIdx: number;
  amount: number;
  totalAmount: number;
  assetPoolAfter: number;
  totalPoolAfter: number;
}

export interface RaceSettledEvent {
  raceId: number;
  winningAssets: number[];
  totalPool: number;
  winningPool: number;
  netPool: number;
  authority: PublicKey;
  startPrices: number[];
  endPrices: number[];
  percentageChanges: number[];
}

export interface PayoutEvent {
  raceId: number;
  player: PublicKey;
  amount: number;
  assetIdx: number;
  betAmount: number;
  payoutRatio: number;
}

export interface RaceStateChangedEvent {
  raceId: number;
  oldState: string;
  newState: string;
  timestamp: number;
}

export interface AssetLeaderChangedEvent {
  raceId: number;
  oldLeader: number | null;
  newLeader: number;
  timestamp: number;
}

export interface UserBetEvent {
  raceId: number;
  player: PublicKey;
  assetIdx: number;
  totalAmount: number;
  isWinner: boolean;
  payoutAmount: number | null;
}

// UI-specific types
export interface EnhancedAssetInfo extends AssetInfo {
  name: string;
  color: string;
  startPrice?: number;
  endPrice?: number;
  percentageChange?: number;
  poolAmount?: number;
  isWinner?: boolean;
}

export interface EnhancedRaceDetails extends RaceDetails {
  assets: EnhancedAssetInfo[];
  participantCount?: number;
  userBet?: BetDetails;
  odds?: number[];
  cooldown?: RaceCreationCooldownInfo;
}

// Race creation cooldown information from smart contract
export interface RaceCreationCooldownInfo {
  lastRaceCreationTs: number;
  cooldownDuration: number;
  canCreateRaceAt: number;
  remainingCooldown: number;
  canCreateNow: boolean;
}

// Contract account types
export interface ConfigAccount {
  initialized: boolean;
  authority: PublicKey;
  protocolFeeBps: number;
  feeChangeEffectiveTs: number;
  paused: boolean;
  assets: AssetMeta[];
  lastRaceCreationTs: number;
  lastFeeChangeTs: number;
  proposedAuthority?: PublicKey | null;
  authorityChangeTs: number;
  feeIncreaseWindowStart: number;
  totalFeeIncreaseBps: number;
  bump: number;
}

export interface TreasuryAccount {
  authority: PublicKey;
  bump: number;
}

export interface VaultAccount {
  authority: PublicKey;
  bump: number;
}

export interface RaceAccount {
  id: number;
  startTs: number;
  lockTs: number;
  settleTs: number;
  startPrice: number[];
  endPrice: number[];
  pool: number[];
  totalPool: number;
  winningAssets: number[];
  winningPool: number;
  netPool: number;
  payoutRatioNum: number;
  claimedPool: number;
  feeBpsSnapshot: number;
  dustSwept: boolean;
  bump: number;
}

export interface BetAccount {
  race: PublicKey;
  player: PublicKey;
  assetIdx: number;
  amount: number;
  claimed: boolean;
  bump: number;
}

// Service response types
export interface RaceServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  transactionSignature?: string;
}

// Legacy compatibility types (to be removed gradually)
export interface LegacyRaceState {
  id: number;
  startTs: number;
  lockTs: number;
  settleTs: number;
  startPrice: number[];
  endPrice: number[];
  pool: number[];
  totalPool: number;
  winningIdx?: number;
  winningPool: number;
  netPool: number;
  payoutRatioNum: number;
  claimedPool: number;
  feeBpsSnapshot: number;
  dustSwept: boolean;
  phase: 'commit' | 'performance' | 'settled';
  assets: {
    mint?: string; // Legacy field, optional
    symbol: string;
    name: string;
    color: string;
  }[];
  participantCount: number;
}

export interface LegacyBetState {
  raceId: number;
  amount: number;
  assetIdx: number;
  claimed: boolean;
  revealed: boolean;
  salt: string;
} 