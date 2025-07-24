import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  PublicKey,
  SystemProgram,
} from '@solana/web3.js'

export type Environment = 'devnet' | 'mainnet';

export interface Config {
  environment: Environment;
  rpcEndpoint: string;
  programId: PublicKey;
  adminAuthority: PublicKey;
  usdcMint: PublicKey;
  systemProgram: PublicKey;
  tokenProgram: PublicKey;
  // PDA addresses (pre-calculated)
  pdas: {
    config: PublicKey;
    treasury: PublicKey;
    vault: PublicKey;
  };
  // Pyth feed IDs for dynamic oracle derivation
  pythFeeds: {
    [symbol: string]: string; // feed_id
  };
  // Default assets for each environment
  assets: {
    symbol: string;
    name: string;
    color: string;
    feedId: string;
  }[];
}

// Current environment - change this to switch between devnet/mainnet
export const CURRENT_ENVIRONMENT: Environment = 'devnet';

// Program ID - UPDATED with deployed program
const PROGRAM_ID = new PublicKey('3jmrCqY1DBayvf1LhdEvFhsfSAsdHb1ieX1LrgnHASp4');

// Admin Authority - UPDATED from bootstrap
const ADMIN_AUTHORITY = new PublicKey('3TGYaZaNyCyA74zmM8yyqKAFHLxTrGD46nmxpUKdXFhV');

// USDC Mint addresses for different networks
const USDC_MINT_DEVNET = new PublicKey('DMXms6qWM89Y6HyvDMcRFVSTnVQvAmtXwB5dxsHHW8kK'); // Custom devnet USDC
const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Mainnet USDC

// UPDATED PDA addresses from latest deployment (Dec 19, 2024)
const DEVNET_PDAS = {
  config: new PublicKey('3DzQ8aMMb8DZxTJ7jN1cqVsxPMTZC7hFQvLWqdVBCM89'),
  treasury: new PublicKey('GcocDTNv4XdStwDwd7Nk8u73K8MkiLQJHXod7y8mKBqM'),
  vault: new PublicKey('Cjjy7VYmk1Vu4somjZUajbV4z9du4UDk33zFUUc9aLEp'),
};

// Pyth Feed IDs (same for all networks) - Updated to match deployment config
const PYTH_FEEDS = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", 
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
};

const CONFIGS: Record<Environment, Config> = {
  devnet: {
    environment: 'devnet',
    rpcEndpoint: 'https://api.devnet.solana.com',
    programId: PROGRAM_ID,
    adminAuthority: ADMIN_AUTHORITY,
    usdcMint: USDC_MINT_DEVNET,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    pdas: DEVNET_PDAS,
    pythFeeds: PYTH_FEEDS,
    assets: [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        color: '#ff5e00',
        feedId: PYTH_FEEDS.BTC,
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        color: '#ffb800',
        feedId: PYTH_FEEDS.ETH,
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        color: '#00ffe7',
        feedId: PYTH_FEEDS.SOL,
      },
    ],
  },
  mainnet: {
    environment: 'mainnet',
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    programId: PROGRAM_ID,
    adminAuthority: ADMIN_AUTHORITY,
    usdcMint: USDC_MINT_MAINNET,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    pdas: {
      // These would need to be calculated for mainnet deployment
      config: new PublicKey('11111111111111111111111111111111'),
      treasury: new PublicKey('11111111111111111111111111111111'),
      vault: new PublicKey('11111111111111111111111111111111'),
    },
    pythFeeds: PYTH_FEEDS,
    assets: [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        color: '#ff5e00',
        feedId: PYTH_FEEDS.BTC,
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        color: '#ffb800',
        feedId: PYTH_FEEDS.ETH,
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        color: '#00ffe7',
        feedId: PYTH_FEEDS.SOL,
      },
    ],
  },
};

export const getConfig = (environment: Environment = CURRENT_ENVIRONMENT): Config => {
  return CONFIGS[environment];
};

export const getCurrentConfig = (): Config => {
  return getConfig(CURRENT_ENVIRONMENT);
};

// Helper to switch environments
export const switchEnvironment = (environment: Environment): Config => {
  return getConfig(environment);
};

// Constants
export const SCALING_FACTOR = 1_000_000_000_000; // 1e12 from contract
export const DUST_THRESHOLD = 3;
export const COMMIT_WINDOW = 30; // 30 seconds
export const PERFORMANCE_WINDOW = 30; // 30 seconds 