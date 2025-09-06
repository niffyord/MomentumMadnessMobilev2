import { PublicKey } from '@solana/web3.js'

export enum RaceState {
  Betting = 'Betting',
  Running = 'Running',
  SettlementReady = 'SettlementReady',
  Settled = 'Settled',
}

export interface AssetInfo {
  index: number;
  feedId: string;
  currentPrice: number | null;
  currentExponent: number | null;
  currentConf: number | null;
  symbol: string;
}

export interface BetDetails {
  raceId: number;
  player: string | PublicKey;
  assetIdx: number;
  amount: number;
  claimed: boolean;
  isWinner: boolean;
  potentialPayout: number | null;
}

export interface EnhancedAssetInfo extends AssetInfo {
  name: string;
  color: string;
  startPrice?: number;
  endPrice?: number;
  percentageChange?: number;
  poolAmount?: number;
  isWinner?: boolean;
}

export interface EnhancedRaceDetails {
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
  payoutRatio: number;
  dustSwept: boolean;
  currentChanges: (number | null)[];
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

export interface UserBetSummary {
  raceId: number;
  assetIdx: number;
  amount: number;
  potentialPayout: number | null;
  isWinner: boolean | null;
  claimed: boolean;
  raceState: RaceState;
}

export interface RaceServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  transactionSignature?: string;
}

export interface GlobalStats {
  racersOnline: number;
  racesToday: number;
  usdcPaid24h: number; // in USDC (decimal)
  updatedAt: number; // unix seconds
}
