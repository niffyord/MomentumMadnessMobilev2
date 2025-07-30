import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

import {
  Connection,
  PublicKey,
} from '@solana/web3.js'

import { ApiService } from '../services/apiService'
import {
  AssetInfo,
  BetDetails,
  EnhancedRaceDetails,
  UserBetSummary,
} from '../services/backendTypes'
import { OnChainService } from '../services/onchainService'
import { WebSocketService } from '../services/websocketService'
import { persistKey } from './hydration'

// Cache interface for intelligent data management
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

interface RequestTracker {
  [key: string]: Promise<any>
}

// Enhanced store interface using v2 contract types
interface RaceStore {
  // Current race data
  race?: EnhancedRaceDetails
  userBet?: BetDetails
  odds?: number[]
  previousOdds?: number[]
  oddsHistory: Array<{ timestamp: number; odds: number[] }>
  
  // Asset data
  assetInfo?: AssetInfo[]
  
  // User data
  userBets?: UserBetSummary[]
  
  // Real-time data
  liveRaceData?: any
  priceUpdates: Map<string, any>
  
  // UI state
  isLoading: boolean
  error?: string
  isConnected: boolean
  
  // Service instances
  apiService: ApiService
  wsService: WebSocketService
  onChainService?: OnChainService
  
  // Cache management
  cache: Map<string, CacheEntry<any>>
  pendingRequests: RequestTracker
  lastFetchTime: number
  
  // Actions
  setRace: (race: EnhancedRaceDetails) => void
  setUserBet: (bet: BetDetails) => void
  setOdds: (odds: number[]) => void
  setAssetInfo: (info: AssetInfo[]) => void
  setUserBets: (bets: UserBetSummary[]) => void
  
  // Real-time methods
  connectWebSocket: () => Promise<void>
  disconnectWebSocket: () => void
  subscribeToRace: (raceId: number) => void
  forceReconnectWebSocket: () => Promise<void>
  
  // Enhanced service methods with caching
  fetchCurrentRace: (useCache?: boolean) => Promise<void>
  fetchRaceDetails: (raceId: number, useCache?: boolean) => Promise<void>
  fetchUserBets: (playerAddress: string, useCache?: boolean) => Promise<void>
  fetchAssets: (useCache?: boolean) => Promise<void>
  
  // Phase-specific data fetching methods
  fetchCommitPhaseData: (raceId?: number, playerAddress?: string, useCache?: boolean) => Promise<void>
  fetchPerformancePhaseData: (raceId?: number, playerAddress?: string, useCache?: boolean) => Promise<void>
  fetchSettledPhaseData: (raceId?: number, playerAddress?: string, useCache?: boolean) => Promise<void>
  
  // Transaction methods
  placeBet: (playerAddress: string, raceId: number, assetIdx: number, amount: number, connection: Connection, signAndSendTransaction: any) => Promise<boolean>
  claimPayout: (playerAddress: string, raceId: number, connection: Connection, signAndSendTransaction: any) => Promise<boolean>
  
  // Cache management methods
  getCachedData: <T>(key: string) => T | null
  setCachedData: <T>(key: string, data: T, ttl?: number) => void
  clearCache: () => void
  isDataStale: (key: string) => boolean
  
  // Utility methods
  setLoading: (loading: boolean) => void
  setError: (error?: string) => void
  clear: () => void
}

// Cache TTL constants (in milliseconds) - Optimized for performance
const CACHE_TTL = {
  RACE_DETAILS: 5000,      // 5 seconds for race details during commit phase
  USER_BETS: 10000,        // 10 seconds for user bets
  COMPLETE_RACE: 3000,     // 3 seconds for complete race info during commit phase
  SETTLED_RACE: 10000,     // 10 seconds for settled race info
  ASSET_INFO: 600000,      // 10 minutes for asset info (very stable)
  CURRENT_RACE: 5000,      // 5 seconds for current race
}

export const useRaceStore = create<RaceStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    race: undefined,
    userBet: undefined,
    odds: undefined,
    previousOdds: undefined,
    oddsHistory: [],
    assetInfo: undefined,
    userBets: undefined,
    liveRaceData: undefined,
    priceUpdates: new Map(),
    isLoading: false,
    error: undefined,
    isConnected: false,
    apiService: new ApiService(),
    wsService: new WebSocketService(),
    cache: new Map(),
    pendingRequests: {},
    lastFetchTime: 0,

    // Cache management methods
    getCachedData: <T>(key: string): T | null => {
      const entry = get().cache.get(key)
      if (!entry) return null
      
      const now = Date.now()
      if (now - entry.timestamp > entry.ttl) {
        // Data is stale, remove from cache
        get().cache.delete(key)
        return null
      }
      
      return entry.data as T
    },

    setCachedData: <T>(key: string, data: T, ttl: number = CACHE_TTL.RACE_DETAILS) => {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      }
      get().cache.set(key, entry)
    },

    clearCache: () => {
      set((state) => {
        state.cache.clear()
        return { cache: new Map() }
      })
    },

    isDataStale: (key: string): boolean => {
      const entry = get().cache.get(key)
      if (!entry) return true
      
      const now = Date.now()
      return now - entry.timestamp > entry.ttl
    },

    // Enhanced setters with batched updates for better performance
    setRace: (race: EnhancedRaceDetails) => {
      persistKey('lastRace', race)
      set((state) => {
        // Cache the race data
        get().setCachedData(`race_${race.raceId}`, race, CACHE_TTL.RACE_DETAILS)
        
        return { 
          ...state, 
          race,
          isLoading: false,
          error: undefined,
        }
      })
    },
    
    setUserBet: (bet: BetDetails) => {
      set((state) => {
        // Cache the bet data
        get().setCachedData(`bet_${bet.raceId}_${bet.player}`, bet, CACHE_TTL.USER_BETS)
        
        return { 
          ...state, 
          userBet: bet,
          error: undefined,
        }
      })
    },
    
    setOdds: (odds: number[]) => set((state) => {
      const currentTime = Date.now()
      const newOddsHistory = [...state.oddsHistory]
      
      // Add current odds to history (keep last 10 entries)
      if (odds && odds.length > 0) {
        newOddsHistory.push({ timestamp: currentTime, odds: [...odds] })
        if (newOddsHistory.length > 10) {
          newOddsHistory.shift()
        }
      }
      
      return { 
        ...state, 
        previousOdds: state.odds ? [...state.odds] : undefined,
        odds: [...odds],
        oddsHistory: newOddsHistory
      }
    }),

    setAssetInfo: (info: AssetInfo[]) => set((state) => ({ ...state, assetInfo: info })),
    setUserBets: (bets: UserBetSummary[]) => set((state) => ({ ...state, userBets: bets })),

    // Real-time methods
    connectWebSocket: async () => {
      try {
        const { wsService } = get()
        await wsService.connect()
        
        // Set up event handlers
        wsService.onRaceUpdate((data) => {
          if (data.race) {
            get().setRace(data.race)
          }
          // Store the full race data including leaderboard for performance calculations
          set({ liveRaceData: data })
        })
        
        wsService.onPriceUpdate((data) => {
          set((state) => {
            const newPriceUpdates = new Map(state.priceUpdates)
            // Backend sends all prices in one object: { BTC: {...}, ETH: {...}, SOL: {...} }
            if (typeof data === 'object' && data !== null) {
              Object.entries(data).forEach(([symbol, priceData]: [string, any]) => {
                if (priceData && typeof priceData === 'object') {
                  newPriceUpdates.set(symbol, {
                    symbol,
                    price: priceData.price,
                    confidence: priceData.confidence || 100,
                    timestamp: priceData.timestamp,
                    expo: priceData.expo
                  })
                }
              })
            }
            return { ...state, priceUpdates: newPriceUpdates }
          })
        })
        
        wsService.onUserBetUpdate((data) => {
          if (data.bet) {
            get().setUserBet(data.bet)
          }
        })
        
        set({ isConnected: true })
      } catch (error) {
        console.error('❌ Failed to connect WebSocket:', error)
        set({ 
          isConnected: false, 
          error: error instanceof Error ? error.message : 'Failed to connect WebSocket'
        })
      }
    },

    disconnectWebSocket: () => {
      const { wsService } = get()
      wsService.disconnect()
      set({ isConnected: false })
    },

    subscribeToRace: (raceId: number) => {
      const { wsService, isConnected } = get()
      if (isConnected) {
        wsService.subscribeToRace(raceId)
      }
    },

    forceReconnectWebSocket: async () => {
      const { wsService } = get()
      await wsService.forceReconnect()
    },

    // Enhanced service methods with intelligent caching and request deduplication
    fetchCurrentRace: async (useCache: boolean = true) => {
      const cacheKey = 'currentRace'
      const requestKey = 'fetchCurrentRace'
      
      // Check if request is already in progress
      const existingRequest = get().pendingRequests[requestKey]
      if (existingRequest) {
        return existingRequest
      }
      
      // Check cache first if enabled
      if (useCache) {
        const cachedData = get().getCachedData<EnhancedRaceDetails>(cacheKey)
        if (cachedData) {
          set({ race: cachedData })
          return
        }
      }

      const { apiService, setLoading, setError } = get()
      
      const request = (async () => {
        setLoading(true)
        setError(undefined)

        try {
          const response = await apiService.getCurrentRace()
          
          if (response.success && response.data) {
            set({ race: response.data })
            get().setCachedData(cacheKey, response.data, CACHE_TTL.CURRENT_RACE)
          } else {
            setError(response.error || 'Failed to fetch current race')
          }
        } catch (error) {
          console.error('Failed to fetch current race:', error)
          setError(error instanceof Error ? error.message : 'Failed to fetch current race')
        } finally {
          setLoading(false)
          delete get().pendingRequests[requestKey]
        }
      })()

      get().pendingRequests[requestKey] = request
      return request
    },

    fetchRaceDetails: async (raceId: number, useCache: boolean = true) => {
      const cacheKey = `race_${raceId}`
      const requestKey = `fetchRace_${raceId}`
      
      // Check if request is already in progress
      const existingRequest = get().pendingRequests[requestKey]
      if (existingRequest) {
        return existingRequest
      }
      
      // Check cache first if enabled
      if (useCache) {
        const cachedData = get().getCachedData<EnhancedRaceDetails>(cacheKey)
        if (cachedData) {
          set({ race: cachedData })
          return
        }
      }

      const { apiService, setLoading, setError } = get()
      
      const request = (async () => {
        setLoading(true)
        setError(undefined)

        try {
          const response = await apiService.getRace(raceId)
          
          if (response.success && response.data) {
            set({ race: response.data })
            get().setCachedData(cacheKey, response.data, CACHE_TTL.RACE_DETAILS)
          } else {
            setError(response.error || 'Failed to fetch race details')
          }
        } catch (error) {
          console.error('Failed to fetch race details:', error)
          setError(error instanceof Error ? error.message : 'Failed to fetch race details')
        } finally {
          setLoading(false)
          delete get().pendingRequests[requestKey]
        }
      })()

      get().pendingRequests[requestKey] = request
      return request
    },

    fetchUserBets: async (playerAddress: string, useCache: boolean = true) => {
      const cacheKey = `userBets_${playerAddress}`
      const requestKey = `fetchUserBets_${playerAddress}`
      
      // Check if request is already in progress
      const existingRequest = get().pendingRequests[requestKey]
      if (existingRequest) {
        return existingRequest
      }
      
      // Check cache first if enabled
      if (useCache) {
        const cachedData = get().getCachedData<UserBetSummary[]>(cacheKey)
        if (cachedData) {
          set({ userBets: cachedData })
          return
        }
      }

      const { apiService, setLoading, setError } = get()
      
      const request = (async () => {
        setLoading(true)
        setError(undefined)

        try {
          // Pass forceRefresh=true when not using cache
          const response = await apiService.getUserBets(playerAddress, !useCache)
          
          if (response.success && response.data) {
            set({ userBets: response.data })
            get().setCachedData(cacheKey, response.data, CACHE_TTL.USER_BETS)
          } else {
            // Don't set error for missing bets - it's expected if user hasn't bet yet
            if (response.error && !response.error.includes('not found')) {
              setError(response.error)
            }
          }
        } catch (error) {
          console.error('Failed to fetch user bets:', error)
          setError(error instanceof Error ? error.message : 'Failed to fetch user bets')
        } finally {
          setLoading(false)
          delete get().pendingRequests[requestKey]
        }
      })()

      get().pendingRequests[requestKey] = request
      return request
    },

    fetchAssets: async (useCache: boolean = true) => {
      const cacheKey = 'assetInfo'
      const requestKey = 'fetchAssets'
      
      // Check if request is already in progress
      const existingRequest = get().pendingRequests[requestKey]
      if (existingRequest) {
        return existingRequest
      }
      
      // Check cache first if enabled
      if (useCache) {
        const cachedData = get().getCachedData<AssetInfo[]>(cacheKey)
        if (cachedData) {
          set({ assetInfo: cachedData })
          return
        }
      }

      const { apiService, setLoading, setError } = get()
      
      const request = (async () => {
        setLoading(true)
        setError(undefined)

        try {
          const response = await apiService.getAssets()
          
          if (response.success && response.data) {
            set({ assetInfo: response.data })
            get().setCachedData(cacheKey, response.data, CACHE_TTL.ASSET_INFO)
          } else {
            setError(response.error || 'Failed to fetch asset info')
          }
        } catch (error) {
          console.error('Failed to fetch asset info:', error)
          setError(error instanceof Error ? error.message : 'Failed to fetch asset info')
        } finally {
          setLoading(false)
          delete get().pendingRequests[requestKey]
        }
      })()

      get().pendingRequests[requestKey] = request
      return request
    },

    // Phase-specific data fetching methods for optimized performance
    fetchCommitPhaseData: async (raceId?: number, playerAddress?: string, useCache: boolean = true) => {
      const cacheKey = `commit_${raceId || 'current'}_${playerAddress || 'anonymous'}`
      const requestKey = `fetchCommit_${raceId || 'current'}_${playerAddress || 'anonymous'}`
      
      // Check if request is already in progress
      const existingRequest = get().pendingRequests[requestKey]
      if (existingRequest) {
        return existingRequest
      }
      
      // Check cache first if enabled
      if (useCache) {
        const cachedData = get().getCachedData<{
          race: EnhancedRaceDetails
          userBets?: UserBetSummary[]
          assetInfo?: AssetInfo[]
        }>(cacheKey)
        
        if (cachedData) {
          set({ 
            race: cachedData.race,
            userBets: cachedData.userBets,
            assetInfo: cachedData.assetInfo,
          })
          return
        }
      }

      const { setLoading, setError } = get()
      
      const request = (async () => {
        const shouldShowLoading = Date.now() - get().lastFetchTime > 1000
        if (shouldShowLoading) {
          setLoading(true)
        }
        setError(undefined)

        try {
          console.log('📊 Fetching commit phase data...')
          
          // Fetch data in parallel
          const promises = [
            raceId ? get().fetchRaceDetails(raceId, false) : get().fetchCurrentRace(false),
            get().fetchAssets(useCache),
          ]
          
          if (playerAddress) {
            promises.push(get().fetchUserBets(playerAddress, false))
          }
          
          await Promise.all(promises)
          
          const commitData = {
            race: get().race!,
            userBets: get().userBets,
            assetInfo: get().assetInfo,
          }
          
          // Cache with commit-appropriate TTL
          get().setCachedData(cacheKey, commitData, CACHE_TTL.COMPLETE_RACE)
          
          set({ lastFetchTime: Date.now() })
        } catch (error) {
          console.error('Failed to fetch commit phase data:', error)
          setError(error instanceof Error ? error.message : 'Failed to fetch commit phase data')
        } finally {
          if (shouldShowLoading) {
            setLoading(false)
          }
          delete get().pendingRequests[requestKey]
        }
      })()

      get().pendingRequests[requestKey] = request
      return request
    },

    fetchPerformancePhaseData: async (raceId?: number, playerAddress?: string, useCache: boolean = true) => {
      const cacheKey = `performance_${raceId || 'current'}_${playerAddress || 'anonymous'}`
      const requestKey = `fetchPerformance_${raceId || 'current'}_${playerAddress || 'anonymous'}`
      
      // Check if request is already in progress
      const existingRequest = get().pendingRequests[requestKey]
      if (existingRequest) {
        return existingRequest
      }

      const { setLoading, setError } = get()
      
      const request = (async () => {
        const shouldShowLoading = Date.now() - get().lastFetchTime > 1000
        if (shouldShowLoading) {
          setLoading(true)
        }
        setError(undefined)

        try {
          console.log('📊 Fetching performance phase data...')
          
          // Fetch current race and user bets in parallel
          const promises = [
            raceId ? get().fetchRaceDetails(raceId, false) : get().fetchCurrentRace(false),
          ]
          
          if (playerAddress) {
            promises.push(get().fetchUserBets(playerAddress, false))
          }
          
          await Promise.all(promises)
          
          // Start WebSocket connection for real-time updates if not connected
          if (!get().isConnected) {
            await get().connectWebSocket()
            if (get().race?.raceId) {
              get().subscribeToRace(get().race.raceId)
            }
          }
          
          set({ lastFetchTime: Date.now() })
        } catch (error) {
          console.error('Failed to fetch performance phase data:', error)
          setError(error instanceof Error ? error.message : 'Failed to fetch performance phase data')
        } finally {
          if (shouldShowLoading) {
            setLoading(false)
          }
          delete get().pendingRequests[requestKey]
        }
      })()

      get().pendingRequests[requestKey] = request
      return request
    },

    fetchSettledPhaseData: async (raceId?: number, playerAddress?: string, useCache: boolean = true) => {
      const cacheKey = `settled_${raceId || 'current'}_${playerAddress || 'anonymous'}`
      const requestKey = `fetchSettled_${raceId || 'current'}_${playerAddress || 'anonymous'}`
      
      // Check if request is already in progress
      const existingRequest = get().pendingRequests[requestKey]
      if (existingRequest) {
        return existingRequest
      }

      // Serve cached data when available
      if (useCache) {
        const cached = get().getCachedData<{ race: EnhancedRaceDetails; userBets?: UserBetSummary[] }>(cacheKey)
        if (cached) {
          set({ race: cached.race, userBets: cached.userBets })
          return
        }
      }

      const { setLoading, setError } = get()
      
      const request = (async () => {
        const shouldShowLoading = Date.now() - get().lastFetchTime > 1000
        if (shouldShowLoading) {
          setLoading(true)
        }
        setError(undefined)

        try {
          console.log('📊 Fetching settled phase data...')
          
          // Fetch final race state and user bets
          const promises = [
            raceId ? get().fetchRaceDetails(raceId, false) : get().fetchCurrentRace(false),
          ]
          
          if (playerAddress) {
            promises.push(get().fetchUserBets(playerAddress, false))
          }
          
          await Promise.all(promises)

          // Cache final data
          get().setCachedData(cacheKey, { race: get().race!, userBets: get().userBets }, CACHE_TTL.SETTLED_RACE)

          set({ lastFetchTime: Date.now() })
        } catch (error) {
          console.error('Failed to fetch settled phase data:', error)
          setError(error instanceof Error ? error.message : 'Failed to fetch settled phase data')
        } finally {
          if (shouldShowLoading) {
            setLoading(false)
          }
          delete get().pendingRequests[requestKey]
        }
      })()

      get().pendingRequests[requestKey] = request
      return request
    },

    // Transaction methods
    placeBet: async (playerAddress: string, raceId: number, assetIdx: number, amount: number, connection: Connection, signAndSendTransaction: any): Promise<boolean> => {
      const { setLoading, setError } = get()
      setLoading(true)
      setError(undefined)

      try {
        console.log(`🎯 Placing bet: ${amount} micro-USDC on asset ${assetIdx} for race ${raceId}`)
        
        // Create on-chain service instance
        const onChainService = new OnChainService(connection)
        
        // Create place bet transaction
        const { transaction, latestBlockhash, minContextSlot } = await onChainService.createPlaceBetTransaction({
          playerPublicKey: new PublicKey(playerAddress),
          raceId,
          assetIdx,
          amount,
        })
        
        // Send transaction via wallet
        const signature = await signAndSendTransaction(transaction, minContextSlot)
        
        // Confirm transaction
        await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')
        
        console.log('✅ Bet placed successfully, signature:', signature)
        
        // Clear relevant cache entries
        const raceKey = `race_${raceId}`
        const userBetsKey = `userBets_${playerAddress}`
        const commitKey = `commit_${raceId}_${playerAddress}`
        
        get().cache.delete(raceKey)
        get().cache.delete(userBetsKey)
        get().cache.delete(commitKey)
        
        // Wait for blockchain to process
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Refresh data
        await get().fetchCurrentRace(false)
        await get().fetchUserBets(playerAddress, false)
        
        return true
      } catch (error) {
        console.error('Failed to place bet:', error)
        setError(error instanceof Error ? error.message : 'Failed to place bet')
        return false
      } finally {
        setLoading(false)
      }
    },

    claimPayout: async (playerAddress: string, raceId: number, connection: Connection, signAndSendTransaction: any): Promise<boolean> => {
      const { setLoading, setError } = get()
      setLoading(true)
      setError(undefined)

      try {
        console.log(`💰 Claiming payout for race ${raceId}`)
        
        // Create on-chain service instance
        const onChainService = new OnChainService(connection)
        
        // Create claim payout transaction
        const { transaction, latestBlockhash, minContextSlot } = await onChainService.createClaimPayoutTransaction({
          playerPublicKey: new PublicKey(playerAddress),
          raceId,
        })
        
        // Send transaction via wallet
        const signature = await signAndSendTransaction(transaction, minContextSlot)
        
        // Confirm transaction
        await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')
        
        console.log('✅ Payout claimed successfully, signature:', signature)
        
        // Clear relevant cache entries
        const raceKey = `race_${raceId}`
        const userBetsKey = `userBets_${playerAddress}`
        const settledKey = `settled_${raceId}_${playerAddress}`
        
        get().cache.delete(raceKey)
        get().cache.delete(userBetsKey)
        get().cache.delete(settledKey)
        
        // Wait longer for blockchain to process the claim transaction
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Refresh data with force refresh (useCache=false)
        console.log(`🔄 Force refreshing data after claim for race ${raceId}...`)
        await Promise.all([
          get().fetchRaceDetails(raceId, false), // useCache=false
          get().fetchUserBets(playerAddress, false) // useCache=false
        ])
        
        console.log(`✅ Data force refreshed after claim`)
        
        return true
      } catch (error) {
        console.error('Failed to claim payout:', error)
        setError(error instanceof Error ? error.message : 'Failed to claim payout')
        return false
      } finally {
        setLoading(false)
      }
    },

    // Utility methods
    setLoading: (loading: boolean) => set((state) => ({ ...state, isLoading: loading })),
    setError: (error?: string) => set((state) => ({ ...state, error })),
    clear: () => {
      get().clearCache()
      get().disconnectWebSocket()
      set((state) => ({ 
        ...state,
        race: undefined, 
        userBet: undefined, 
        odds: undefined,
        assetInfo: undefined,
        userBets: undefined,
        liveRaceData: undefined,
        priceUpdates: new Map(),
        error: undefined,
        pendingRequests: {},
        lastFetchTime: 0,
        isLoading: false,
      }))
    },
  }))
)

// Helper types and functions
export type Phase = 'commit' | 'performance' | 'settled'

// Helper function to convert RaceState to phase
export const derivePhaseFromTimestamps = (
  now: number,
  startTs: number,
  lockTs: number,
  settleTs: number
): Phase => {
  if (now < lockTs) {
    return 'commit'
  } else if (now < settleTs) {
    return 'performance'
  } else {
    return 'settled'
  }
}

// Helper function to determine current phase from race
export const getCurrentPhase = (race: EnhancedRaceDetails): Phase => {
  const now = Math.floor(Date.now() / 1000)
  return derivePhaseFromTimestamps(now, race.startTs, race.lockTs, race.settleTs)
}

// Helper function to format time remaining
export const getTimeRemaining = (race: EnhancedRaceDetails, phase: Phase): number => {
  const now = Math.floor(Date.now() / 1000)
  
  switch (phase) {
    case 'commit':
      return Math.max(0, race.lockTs - now)
    case 'performance':
      return Math.max(0, race.settleTs - now)
    default:
      return 0
  }
} 