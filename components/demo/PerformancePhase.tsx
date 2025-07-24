import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { useRaceStore } from '../../store/useRaceStore'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

// Responsive design tokens
const isTablet = screenWidth >= 768
const isLandscape = screenWidth > screenHeight

// Accessibility constants
const MIN_TOUCH_TARGET = 44
const ANIMATION_REDUCE_MOTION = false // Should be from system preference

// Design tokens for consistency
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const

const COLORS = {
  success: '#00FF88',
  error: '#FF4444',
  warning: '#FFD700',
  primary: '#9945FF',
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.8)',
    tertiary: 'rgba(255,255,255,0.6)',
  }
} as const

const TYPOGRAPHY = {
  display: { fontSize: isTablet ? 32 : 28, lineHeight: isTablet ? 40 : 36 },
  title: { fontSize: isTablet ? 24 : 20, lineHeight: isTablet ? 32 : 28 },
  subtitle: { fontSize: isTablet ? 18 : 16, lineHeight: isTablet ? 26 : 24 },
  body: { fontSize: isTablet ? 16 : 14, lineHeight: isTablet ? 24 : 20 },
  caption: { fontSize: isTablet ? 14 : 12, lineHeight: isTablet ? 20 : 18 },
  small: { fontSize: isTablet ? 12 : 10, lineHeight: isTablet ? 18 : 16 },
} as const

// Proper TypeScript interfaces
interface AssetPerformance {
  index: number
  symbol: string
  name: string
  color: string
  performance: number
  currentPrice: number
  startPrice: number
  isUserAsset: boolean
  poolShare: number
  momentum: number
  velocity: 'hot' | 'up' | 'stable' | 'down' | 'crash'
  priceChange: number
  confidence: number
  hasLivePrice: boolean
  marketCap: number
  volume24h: number
}

interface UserPosition {
  asset: AssetPerformance
  originalAmount: number
  currentBetValue: number
  profitLoss: number
  profitLossPercent: number
  isCurrentlyWinning: boolean
  userPoolShare: number
  rank: number
  potentialPayout: number
  winProbability: number
}

interface LivePriceData {
  price: number
  confidence: number
  changePercent: number
}

interface PerformancePhaseProps {
  race: any
  userBet: any
  phaseConfig: any
  formatValue: (value: number) => string
  isLoading?: boolean
  error?: string | null
  account?: any
}

export const EnhancedPerformancePhase = memo(_EnhancedPerformancePhase)

function _EnhancedPerformancePhase({ 
  race, 
  userBet, 
  phaseConfig, 
  formatValue,
  isLoading = false,
  error = null,
  account
}: PerformancePhaseProps) {
  // Get race store data for real-time updates
  const { 
    odds, 
    previousOdds, 
    priceUpdates, 
    isConnected,
    connectWebSocket,
    subscribeToRace,
    forceReconnectWebSocket,
    liveRaceData,
    userBets
  } = useRaceStore()

  // Enhanced animation refs with cleanup tracking
  const raceTrackAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const sparkleAnim = useRef(new Animated.Value(0)).current
  const leaderboardAnim = useRef(new Animated.Value(0)).current
  const oddsChangeAnim = useRef(new Animated.Value(0)).current
  const profitGlowAnim = useRef(new Animated.Value(0)).current
  
  // New animation refs for enhanced interactions
  const priceUpdateFlashAnim = useRef(new Animated.Value(0)).current
  const positionShiftAnim = useRef(new Animated.Value(0)).current
  const votingPulseAnim = useRef(new Animated.Value(1)).current
  const intensityPulseAnim = useRef(new Animated.Value(1)).current
  const liveIndicatorAnim = useRef(new Animated.Value(0)).current
  const momentumBarAnim = useRef(new Animated.Value(0)).current
  const rankChangeAnim = useRef(new Animated.Value(0)).current
  
  // Animation refs for cleanup
  const animationRefs = useRef<Animated.CompositeAnimation[]>([])
  const intervalRefs = useRef<number[]>([])
  
  // Enhanced performance tracking state
  const [raceIntensity, setRaceIntensity] = useState<'low' | 'medium' | 'high' | 'extreme'>('medium')
  const [reduceMotion, setReduceMotion] = useState(ANIMATION_REDUCE_MOTION)
  const [recentlyUpdatedAssets, setRecentlyUpdatedAssets] = useState<Set<string>>(new Set())

  // --- PERFORMANCE FIX: useRef for internal state ---
  // Using useRef for values that don't trigger re-renders prevents infinite loops.
  const lastHapticTime = useRef(0)
  const previousUserRank = useRef<number | null>(null)
  const previousProfitLoss = useRef<number | null>(null)
  const previousIntensity = useRef<'low' | 'medium' | 'high' | 'extreme'>('medium')

  // Crowd sentiment voting system
  const [crowdVotes, setCrowdVotes] = useState<Map<string, { upvotes: number, downvotes: number }>>(new Map())
  const [userVotes, setUserVotes] = useState<Map<string, 'up' | 'down' | null>>(new Map())

  // App state tracking for WebSocket reconnection
  const appState = useRef(AppState.currentState)
  const [isAppActive, setIsAppActive] = useState(true)

  // Store previous prices for calculating recent price changes
  const previousPrices = useRef<Map<string, { price: number, timestamp: number }>>(new Map())
  const [lastPriceUpdate, setLastPriceUpdate] = useState(Date.now())

  // Animation for price updates
  const priceUpdateAnim = useRef(new Animated.Value(0)).current

  // --- PERFORMANCE FIX: Stable haptic function ---
  // useCallback with an empty dependency array ensures this function is created only once.
  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection', context?: string) => {
    const now = Date.now()
    if (now - lastHapticTime.current < 50) return // Shorter debounce for live racing
    
    lastHapticTime.current = now
    
    try {
      switch (type) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          break
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          break
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          break
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          break
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          break
        case 'selection':
          await Haptics.selectionAsync()
          break
      }
      
      if (context) {
        console.log(`🎮 Haptic feedback: ${type} (${context})`)
      }
    } catch (error) {
      // Silent fail - haptics not critical
    }
  }, [])

  // Convert priceUpdates Map to expected format for backward compatibility
  const livePrices = useMemo(() => {
    const priceMap = new Map<string, LivePriceData>()
    
    // Convert race store price updates to expected format
    priceUpdates.forEach((priceData, symbol) => {
      if (priceData && typeof priceData.price === 'number') {
        // Store previous price for change calculation
        const currentPrevious = previousPrices.current.get(symbol)
        if (currentPrevious && currentPrevious.price !== priceData.price) {
          // Price has changed, update the previous price store
          previousPrices.current.set(symbol, { 
            price: currentPrevious.price, 
            timestamp: currentPrevious.timestamp 
          })
        } else if (!currentPrevious) {
          // First time seeing this price
          previousPrices.current.set(symbol, { 
            price: priceData.price, 
            timestamp: priceData.timestamp || Date.now() 
          })
        }

        priceMap.set(symbol, {
          price: priceData.price,
          confidence: priceData.confidence || 100,
          changePercent: 0, // Will be calculated below
        })
      }
    })
    
    // Fallback to asset current prices if no live prices available
    if (priceMap.size === 0 && race?.assets) {
      race.assets.forEach((asset: any) => {
        if (asset.currentPrice && asset.symbol) {
          priceMap.set(asset.symbol, {
            price: asset.currentPrice,
            confidence: 100,
            changePercent: 0,
          })
        }
      })
    }
    
    return priceMap
  }, [priceUpdates, race?.assets])

  // Enhanced price update tracking with haptic feedback
  useEffect(() => {
    setLastPriceUpdate(Date.now())
    
    // Track which assets were recently updated for visual feedback
    const updatedAssets = new Set<string>()
    let significantUpdate = false
    
    priceUpdates.forEach((priceData, symbol) => {
      if (priceData && typeof priceData.price === 'number') {
        const previous = previousPrices.current.get(symbol)
        if (previous && previous.price !== priceData.price) {
          updatedAssets.add(symbol)
          
          // Check for significant price movement (>1%)
          const priceChange = Math.abs((priceData.price - previous.price) / previous.price) * 100
          if (priceChange > 1) {
            significantUpdate = true
          }
        }
      }
    })
    
    if (updatedAssets.size > 0) {
      setRecentlyUpdatedAssets(prev => {
        const newSet = new Set(prev)
        updatedAssets.forEach(a => newSet.add(a))
        return newSet
      })
      
      // Haptic feedback for price updates (REMOVED)
      // if (significantUpdate) {
      //   triggerHaptic('light', 'significant price update')
      // } else if (updatedAssets.size > 2) {
      //   triggerHaptic('selection', 'multiple price updates')
      // }
      
      // Enhanced price update animation with flash effect
      Animated.parallel([
        Animated.timing(priceUpdateAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(priceUpdateFlashAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(priceUpdateFlashAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        Animated.timing(priceUpdateAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }).start()
      })
      
      // Clear the recently updated set after animation
      setTimeout(() => {
        setRecentlyUpdatedAssets(() => new Set())
      }, 1000)
    }
  }, [priceUpdates])

  // Calculate race progress for progress indicator
  const raceProgress = useMemo(() => {
    if (!race) return 0
    const now = Math.floor(Date.now() / 1000)
    const raceStart = race.lockTs
    const raceEnd = race.settleTs
    const totalDuration = raceEnd - raceStart
    const elapsed = now - raceStart
    return Math.max(0, Math.min(1, elapsed / totalDuration))
  }, [race, lastPriceUpdate]) // Update with price updates for smoother progress

  // Initialize crowd sentiment when race loads
  useEffect(() => {
    if (race?.assets && crowdVotes.size === 0) {
      const initialVotes = new Map()
      const initialUserVotes = new Map()
      race.assets.forEach((asset: any) => {
        // Start with some random crowd sentiment to make it look active
        const baseVotes = Math.floor(Math.random() * 20) + 10
        initialVotes.set(asset.symbol, {
          upvotes: baseVotes + Math.floor(Math.random() * 15),
          downvotes: baseVotes + Math.floor(Math.random() * 10)
        })
        initialUserVotes.set(asset.symbol, null)
      })
      setCrowdVotes(initialVotes)
      setUserVotes(initialUserVotes)
    }
  }, [race?.assets])

  // Calculate crowd sentiment percentage
  const getCrowdSentiment = useCallback((symbol: string) => {
    const votes = crowdVotes.get(symbol)
    if (!votes) return { upPercent: 50, downPercent: 50, total: 0 }
    
    const total = votes.upvotes + votes.downvotes
    if (total === 0) return { upPercent: 50, downPercent: 50, total: 0 }
    
    return {
      upPercent: Math.round((votes.upvotes / total) * 100),
      downPercent: Math.round((votes.downvotes / total) * 100),
      total
    }
  }, [crowdVotes])

  // Handle app state changes for WebSocket reconnection
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground, reconnect WebSocket
        setIsAppActive(true)
        
        if (race?.raceId) {
          // Force reconnect WebSocket
          forceReconnectWebSocket().then(() => {
            subscribeToRace(race.raceId)
            const { wsService } = useRaceStore.getState()
            wsService.subscribeToPrice()
          }).catch((error) => {
            console.error('❌ Failed to reconnect WebSocket:', error)
          })
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App going to background
        setIsAppActive(false)
      }
      
      appState.current = nextAppState
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)
    
    return () => {
      subscription?.remove()
    }
  }, [race?.raceId, forceReconnectWebSocket, subscribeToRace])

  // Ensure WebSocket connection for real-time updates
  useEffect(() => {
    if (!isConnected && race?.raceId && isAppActive) {
      connectWebSocket().then(() => {
        subscribeToRace(race.raceId)
        // Also subscribe to price updates
        const { wsService } = useRaceStore.getState()
        wsService.subscribeToPrice()
      }).catch((error) => {
        console.error('❌ Failed to connect to WebSocket:', error)
      })
    } else if (isConnected && race?.raceId && isAppActive) {
      subscribeToRace(race.raceId)
      // Ensure price subscription
      const { wsService } = useRaceStore.getState()
      wsService.subscribeToPrice()
    }
  }, [race?.raceId, isConnected, connectWebSocket, subscribeToRace, isAppActive])

  // Performance: Check accessibility settings
  useEffect(() => {
    const checkReduceMotion = async () => {
      if (Platform.OS === 'ios') {
        const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled()
        setReduceMotion(isReduceMotionEnabled)
      }
    }
    checkReduceMotion()
  }, [])

  // Performance: Cleanup animations and intervals on unmount
  useEffect(() => {
    return () => {
      animationRefs.current.forEach(animation => {
        if (animation && typeof animation.stop === 'function') animation.stop()
      })
      intervalRefs.current.forEach(interval => {
        clearInterval(interval)
      })
      animationRefs.current = []
      intervalRefs.current = []
    }
  }, [])

  // Error handling: Early returns for error states
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons 
          name="alert-circle" 
          size={48} 
          color={COLORS.error}
          accessibilityLabel="Error icon"
        />
        <Text style={styles.errorTitle}>Unable to Load Live Race Data</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    )
  }

  // Loading state handling
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons 
          name="loading" 
          size={48} 
          color={COLORS.primary}
          accessibilityLabel="Loading race performance data"
        />
        <Text style={styles.loadingText}>Loading Race Performance...</Text>
      </View>
    )
  }

  // Empty state handling
  if (!race) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons 
          name="car-speed-limiter" 
          size={48} 
          color={COLORS.text.tertiary}
          accessibilityLabel="No race data"
        />
        <Text style={styles.emptyTitle}>No Active Race</Text>
        <Text style={styles.emptyMessage}>Waiting for race to begin...</Text>
      </View>
    )
  }
  
  // Simple and reliable asset performance data
  const assetPerformances = useMemo(() => {
    if (!race?.assets) return []
    
    return race.assets.map((asset: any, index: number) => {
      const livePrice = livePrices.get(asset.symbol)
      const currentPrice = livePrice?.price || asset.currentPrice || asset.startPrice || 100
      
      // Simple performance calculation
      let performance = 0
      const backendLeaderboard = liveRaceData?.leaderboard
      if (backendLeaderboard) {
        const backendAsset = backendLeaderboard.find((item: any) => item.index === index)
        if (backendAsset && typeof backendAsset.performance === 'number') {
          performance = backendAsset.performance
        }
      }
      
      // Fallback calculation
      if (performance === 0 && asset.startPrice && currentPrice) {
        const startPrice = asset.startPrice
        if (typeof startPrice === 'number' && typeof currentPrice === 'number' && startPrice > 0) {
          performance = ((currentPrice - startPrice) / startPrice) * 100
          if (Math.abs(performance) > 50) {
            performance = Math.sign(performance) * Math.min(Math.abs(performance), 50)
          }
        }
      }
      
      // Simple user asset detection - check both userBet and userBets
      // Simplified user-asset detection: mark true if any of the user's bets for this race targets this asset.
      const isUserAsset =
        (userBet && userBet.assetIdx === index) ||
        (userBets && race?.raceId
          ? userBets.some((bet: any) => bet.raceId === race.raceId && bet.assetIdx === index)
          : false)
      
      // Simple pool calculations
      const totalPool = race.totalPool || 0
      const assetPool = race.assetPools?.[index] || 0
      const poolShare = totalPool > 0 ? (assetPool / totalPool) * 100 : 0
      
      // Simple price change calculation
      let priceChange = 0
      if (backendLeaderboard) {
        const backendAsset = backendLeaderboard.find((item: any) => item.index === index)
        if (backendAsset && typeof backendAsset.startPrice === 'number' && typeof currentPrice === 'number') {
          const backendStartPrice = backendAsset.startPrice
          if (backendStartPrice > 0) {
            priceChange = ((currentPrice - backendStartPrice) / backendStartPrice) * 100
          }
        }
      }
      
      if (priceChange === 0) {
        const startPrice = asset.startPrice || 100
        if (startPrice > 0 && typeof currentPrice === 'number') {
          priceChange = ((currentPrice - startPrice) / startPrice) * 100
        }
      }
      
      // Simple momentum and velocity
      const momentum = Math.abs(performance)
      const velocity = performance > 2 ? 'hot' : performance > 0.5 ? 'up' : 
                     performance < -2 ? 'crash' : performance < -0.5 ? 'down' : 'stable'
      
      return {
        ...asset,
        index,
        performance,
        currentPrice,
        startPrice: asset.startPrice || 100,
        isUserAsset,
        poolShare,
        momentum,
        velocity,
        priceChange,
        confidence: livePrice?.confidence || 0,
        hasLivePrice: livePrices.has(asset.symbol),
        marketCap: 0,
        volume24h: 0,
      }
    }).sort((a: any, b: any) => b.performance - a.performance)
  }, [race?.assets, livePrices, liveRaceData?.leaderboard, userBet, userBets, race?.raceId, race?.totalPool, race?.assetPools])



  // Odds trend calculation using real odds data
  const getOddsTrend = useCallback((assetIndex: number) => {
    if (!odds || !previousOdds) return 'stable'
    
    // ... (rest of the code remains the same)
    const current = odds[assetIndex]
    const previous = previousOdds[assetIndex]
    if (!current || !previous) return 'stable'
    
    const change = ((current - previous) / previous) * 100
    if (Math.abs(change) < 0.5) return 'stable'
    return change > 0 ? 'increasing' : 'decreasing'
  }, [odds, previousOdds])

  // Simple user position calculation
  const userPosition = useMemo(() => {
    // Find user bet - check both userBet and userBets
    let currentUserBet = userBet
    if (!currentUserBet && userBets && race?.raceId) {
      currentUserBet = userBets.find((bet: any) => bet.raceId === race.raceId)
    }
    
    if (!currentUserBet) return null

    // Obtain the asset representing the user's pick – fall back to race.assets if not yet in assetPerformances
    let userAsset: any = assetPerformances.find((a: any) => a.index === currentUserBet.assetIdx)

    if (!userAsset && race?.assets?.length) {
      const fallbackAsset = race.assets[currentUserBet.assetIdx] || {}
      userAsset = {
        index: currentUserBet.assetIdx,
        symbol: fallbackAsset.symbol ?? `ASSET${currentUserBet.assetIdx}`,
        name: fallbackAsset.name ?? '',
        color: fallbackAsset.color ?? '#ffffff',
        performance: 0,
        currentPrice: fallbackAsset.currentPrice ?? 0,
        startPrice: fallbackAsset.startPrice ?? 0,
        isUserAsset: true,
        poolShare: 0,
        momentum: 0,
        velocity: 'stable',
        priceChange: 0,
        confidence: 0,
        hasLivePrice: false,
        marketCap: 0,
        volume24h: 0,
      }
    }
    
    // Safety checks for all numeric values
    const originalAmount = (typeof currentUserBet.amount === 'number' && !isNaN(currentUserBet.amount)) ? currentUserBet.amount / 1_000_000 : 0
    
    // SMART CONTRACT WINNER LOGIC: Only asset with HIGHEST performance wins
    // Contract uses: delta_bps = ((end_price - start_price) / start_price) * 10000
    const maxPerformance = Math.max(...assetPerformances.map((a: any) => a.performance))
    const isActuallyWinning = Math.abs(userAsset.performance - maxPerformance) < 0.001 // Account for floating point precision
    
    // SMART CONTRACT PAYOUT LOGIC: Exact same calculation as contract
    let currentBetValue = 0
    let profitLoss = 0
    let potentialPayout = 0
    
    if (isActuallyWinning && race?.totalPool && race?.assetPools) {
      // Calculate EXACT payout using smart contract logic
      const totalPool = race.totalPool / 1_000_000 // Convert to USDC
      const feeBps = race.feeBps || 500 // Default 5% fee
      const netPool = totalPool * (1 - feeBps / 10000) // Deduct protocol fee
      
      // Calculate winning pool (sum of pools for winning assets)
      let winningPool = 0
      assetPerformances.forEach((asset: any) => {
        if (Math.abs(asset.performance - maxPerformance) < 0.001) {
          winningPool += (race.assetPools[asset.index] || 0) / 1_000_000
        }
      })
      
      if (winningPool > 0) {
        // EXACT SMART CONTRACT CALCULATION:
        // payout_ratio = (net_pool * SCALING_FACTOR) / winning_pool
        // individual_payout = (bet_amount * payout_ratio) / SCALING_FACTOR
        // Simplified: individual_payout = (bet_amount * net_pool) / winning_pool
        const SCALING_FACTOR = 1_000_000_000_000 // Same as contract: 1e12
        const payoutRatio = (netPool * SCALING_FACTOR) / winningPool
        potentialPayout = (originalAmount * payoutRatio) / SCALING_FACTOR
        
        // For live performance phase: Show current value based on winning position
        currentBetValue = potentialPayout
        profitLoss = currentBetValue - originalAmount
      } else {
        // Fallback if pool data is incomplete
        const estimatedMultiplier = Math.max(1.2, Math.min(3.0, 1 + (Math.abs(userAsset.performance) / 100)))
        currentBetValue = originalAmount * estimatedMultiplier
        profitLoss = currentBetValue - originalAmount
        potentialPayout = currentBetValue
      }
    } else {
      // Not currently winning: Show declining value based on performance gap
      const performanceGap = maxPerformance - userAsset.performance
      const lossMultiplier = Math.max(0.1, Math.min(1.0, 1 - (performanceGap / 100)))
      currentBetValue = originalAmount * lossMultiplier
      profitLoss = currentBetValue - originalAmount // This will be negative
      potentialPayout = 0 // Zero payout for losing bets (winner-takes-all)
    }
    
    const profitLossPercent = (originalAmount > 0 && typeof profitLoss === 'number' && !isNaN(profitLoss)) ? (profitLoss / originalAmount) * 100 : 0
    
    // Pool share calculation (accurate)
    const totalAssetPool = race?.assetPools?.[currentUserBet.assetIdx] || 0
    const userPoolShare = (totalAssetPool > 0 && typeof currentUserBet.amount === 'number' && !isNaN(currentUserBet.amount)) ? (currentUserBet.amount / totalAssetPool) * 100 : 0
    
    return {
      asset: userAsset,
      originalAmount,
      currentBetValue,
      profitLoss,
      profitLossPercent,
      isCurrentlyWinning: isActuallyWinning,
      userPoolShare,
      rank: assetPerformances.findIndex((a: any) => a.index === currentUserBet.assetIdx) + 1,
      potentialPayout,
      winProbability: isActuallyWinning ? 
        Math.max(70, Math.min(95, 80 + Math.abs(userAsset.performance - assetPerformances[1]?.performance || 0) * 5)) : 
        Math.max(5, Math.min(30, 20 - Math.abs(maxPerformance - userAsset.performance) * 3)),
    }
  }, [userBet, userBets, race?.raceId, assetPerformances, race?.assetPools, race?.totalPool, race?.feeBps])



  // Enhanced race intensity calculation based on real data with haptic feedback
  useEffect(() => {
    if (assetPerformances.length > 0) {
      const performances = assetPerformances.map((a: AssetPerformance) => a.performance)
      const maxPerf = Math.max(...performances)
      const minPerf = Math.min(...performances)
      const spread = maxPerf - minPerf
      const avgMomentum = assetPerformances.reduce((sum: number, a: AssetPerformance) => sum + a.momentum, 0) / assetPerformances.length
      
      let newIntensity: 'low' | 'medium' | 'high' | 'extreme'
      if (spread > 5 || avgMomentum > 4) newIntensity = 'extreme'
      else if (spread > 3 || avgMomentum > 2.5) newIntensity = 'high'
      else if (spread > 1.5 || avgMomentum > 1.5) newIntensity = 'medium'
      else newIntensity = 'low'
      
      // Trigger haptic when intensity increases significantly
      if (newIntensity !== previousIntensity.current) {
        const intensityLevels = { low: 0, medium: 1, high: 2, extreme: 3 }
        const levelChange = intensityLevels[newIntensity] - intensityLevels[previousIntensity.current]
        
        if (levelChange > 0) {
          // Intensity increased
          if (newIntensity === 'extreme') {
            triggerHaptic('heavy', 'race intensity EXTREME')
          } else if (newIntensity === 'high') {
            triggerHaptic('medium', 'race intensity HIGH')
          } else {
            triggerHaptic('light', 'race intensity increased')
          }
        }
        
        previousIntensity.current = newIntensity
      }
      
      setRaceIntensity(newIntensity)
    }
  }, [assetPerformances, triggerHaptic])

  // Enhanced user position tracking with haptic feedback
  useEffect(() => {
    if (userPosition) {
      // Track rank changes
      if (previousUserRank.current !== null && previousUserRank.current !== userPosition.rank) {
        const rankImproved = userPosition.rank < previousUserRank.current
        
        if (rankImproved) {
          triggerHaptic('success', `rank improved to #${userPosition.rank}`)
          
          // Animate rank change
          Animated.sequence([
            Animated.timing(rankChangeAnim, {
              toValue: 1.1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.spring(rankChangeAnim, {
              toValue: 1,
              tension: 150,
              friction: 3,
              useNativeDriver: true,
            }),
          ]).start()
        } else {
          triggerHaptic('error', `rank dropped to #${userPosition.rank}`)
        }
      }
      previousUserRank.current = userPosition.rank
      
      // Track profit/loss changes
      if (previousProfitLoss.current !== null) {
        const profitChange = userPosition.profitLoss - previousProfitLoss.current
        
        if (Math.abs(profitChange) > 10) { // Significant P&L change
          if (profitChange > 0) {
            triggerHaptic('success', 'profit increased significantly')
          } else {
            triggerHaptic('error', 'loss increased significantly')
          }
        }
      }
      previousProfitLoss.current = userPosition.profitLoss
    }
  }, [userPosition, triggerHaptic])

  // Enhanced racing track animation with intensity-based speed and haptics
  useEffect(() => {
    if (reduceMotion) return
    
    const speedMultiplier = raceIntensity === 'extreme' ? 0.5 : 
                           raceIntensity === 'high' ? 0.7 : 
                           raceIntensity === 'medium' ? 1 : 1.5
    
    const trackAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(raceTrackAnim, {
          toValue: 1,
          duration: 2000 * speedMultiplier,
          useNativeDriver: true,
        }),
        Animated.timing(raceTrackAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    )
    animationRefs.current.push(trackAnimation)
    trackAnimation.start()
    
    return () => {
      trackAnimation.stop()
    }
  }, [raceIntensity, reduceMotion])

  // Enhanced pulse animation for extreme moments with haptics
  useEffect(() => {
    if (reduceMotion) {
      pulseAnim.setValue(1)
      intensityPulseAnim.setValue(1)
      return
    }
    
    let pulseAnimation: Animated.CompositeAnimation | null = null
    let intensityAnimation: Animated.CompositeAnimation | null = null
    
    if (raceIntensity === 'extreme') {
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      )
      
      intensityAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(intensityPulseAnim, {
            toValue: 1.05,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(intensityPulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      )
    } else if (raceIntensity === 'high') {
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      )
    } else {
      pulseAnim.setValue(1)
      intensityPulseAnim.setValue(1)
    }
    
    if (pulseAnimation) {
      animationRefs.current.push(pulseAnimation)
      pulseAnimation.start()
    }
    
    if (intensityAnimation) {
      animationRefs.current.push(intensityAnimation)
      intensityAnimation.start()
    }
    
    return () => {
      if (pulseAnimation) pulseAnimation.stop()
      if (intensityAnimation) intensityAnimation.stop()
    }
  }, [raceIntensity, reduceMotion])

  // Enhanced live indicator animation
  useEffect(() => {
    if (!reduceMotion) {
      const liveAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(liveIndicatorAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(liveIndicatorAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      )
      animationRefs.current.push(liveAnimation)
      liveAnimation.start()
      
      return () => liveAnimation.stop()
    }
  }, [reduceMotion])

  // Enhanced profit glow animation for winning positions
  useEffect(() => {
    if (userPosition && userPosition.profitLoss > 0) {
      const glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(profitGlowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(profitGlowAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      )
      animationRefs.current.push(glowAnimation)
      glowAnimation.start()
      
      return () => glowAnimation.stop()
    } else {
      profitGlowAnim.setValue(0)
    }
  }, [userPosition?.profitLoss])

  // Enhanced momentum bar animations
  useEffect(() => {
    if (!reduceMotion) {
      const momentumAnimation = Animated.timing(momentumBarAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false, // We're animating width
      })
      animationRefs.current.push(momentumAnimation)
      momentumAnimation.start()
    }
  }, [assetPerformances, reduceMotion])

  // Enhanced voting function with haptic feedback
  const handleVote = (symbol: string, voteType: 'up' | 'down') => {
    const currentUserVote = userVotes.get(symbol)
    
    // Haptic feedback for voting
    if (currentUserVote === voteType) {
      triggerHaptic('selection', 'vote removed')
    } else {
      triggerHaptic('light', `voted ${voteType} on ${symbol}`)
    }
    
    // Vote button animation
    Animated.sequence([
      Animated.timing(votingPulseAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(votingPulseAnim, {
        toValue: 1,
        tension: 150,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start()
    
    setCrowdVotes(prev => {
      const newVotes = new Map(prev)
      const current = newVotes.get(symbol) || { upvotes: 0, downvotes: 0 }
      
      // Remove previous vote if exists
      if (currentUserVote === 'up') {
        current.upvotes = Math.max(0, current.upvotes - 1)
      } else if (currentUserVote === 'down') {
        current.downvotes = Math.max(0, current.downvotes - 1)
      }
      
      // Add new vote if different from current
      if (currentUserVote !== voteType) {
        if (voteType === 'up') {
          current.upvotes += 1
        } else {
          current.downvotes += 1
        }
      }
      
      newVotes.set(symbol, current)
      return newVotes
    })
    
    setUserVotes(prev => {
      const newUserVotes = new Map(prev)
      // Toggle vote: same vote = remove, different vote = change
      newUserVotes.set(symbol, currentUserVote === voteType ? null : voteType)
      return newUserVotes
    })
  }



  // Leaderboard reveal animation
  useEffect(() => {
    Animated.timing(leaderboardAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start()
  }, [])

  // Simple data polling
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const fetchAll = async () => {
      if (account?.publicKey) {
        try {
          await Promise.all([
            useRaceStore.getState().fetchUserBets(account.publicKey.toBase58(), false),
            useRaceStore.getState().fetchCurrentRace(false),
          ]);
        } catch (e) {
          // Silent fail
        }
      }
    };
    fetchAll(); // Fetch immediately
    pollInterval = setInterval(fetchAll, 2000); // Poll every 2 seconds
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [race?.raceId, account?.publicKey]);



  return (
    <View style={styles.performanceContainer}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* Enhanced Racing Header with Live Intensity */}
      <View style={[styles.racingHeader, { marginHorizontal: 20 }]}>
        <LinearGradient
          colors={
            raceProgress > 0.9 ? ['rgba(255, 68, 68, 0.6)', 'rgba(255, 215, 0, 0.4)', 'rgba(0, 0, 0, 0.8)'] :
            raceIntensity === 'extreme' ? ['rgba(255, 68, 68, 0.4)', 'rgba(255, 215, 0, 0.3)', 'rgba(0, 0, 0, 0.8)'] :
            raceIntensity === 'high' ? ['rgba(0, 255, 136, 0.3)', 'rgba(255, 215, 0, 0.2)', 'rgba(0, 0, 0, 0.8)'] :
            ['rgba(0, 255, 136, 0.2)', 'rgba(20, 241, 149, 0.1)', 'rgba(0, 0, 0, 0.8)']
          }
          style={styles.racingHeaderGradient}
        >
          <Animated.View
            style={[
              styles.racingHeaderContent,
              {
                transform: [{ scale: intensityPulseAnim }],
              },
            ]}
          >
            <View style={styles.liveIndicator}>
              <Animated.View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor: raceProgress > 0.9 ? '#FF4444' :
                                   raceIntensity === 'extreme' ? '#FF4444' : 
                                   raceIntensity === 'high' ? '#FFD700' : '#FF4444',
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.08],
                      outputRange: [0.7, 1],
                    }),
                    transform: [{
                      scale: liveIndicatorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    }],
                  },
                ]}
              />
              <Text style={styles.liveText}>
                {raceProgress > 0.9 ? 'FINAL MOMENTS!' : 'LIVE RACE'}
              </Text>
            </View>
            
            <Animated.View
              style={[
                styles.raceIntensityIndicator,
                {
                  transform: [{ scale: intensityPulseAnim }],
                },
              ]}
            >
              <MaterialCommunityIcons 
                name={raceProgress > 0.9 ? "timer" : raceIntensity === 'extreme' ? "fire" : "flash"} 
                size={16} 
                color={
                  raceProgress > 0.9 ? '#FF4444' :
                  raceIntensity === 'extreme' ? '#FF4444' : 
                  raceIntensity === 'high' ? '#FFD700' : 
                  raceIntensity === 'medium' ? '#FFD700' : '#00FF88'
                } 
              />
              <Text style={[
                styles.intensityText,
                {
                  color: raceProgress > 0.9 ? '#FF4444' :
                         raceIntensity === 'extreme' ? '#FF4444' : 
                         raceIntensity === 'high' ? '#FFD700' : 
                         raceIntensity === 'medium' ? '#FFD700' : '#00FF88'
                }
              ]}>
                {raceProgress > 0.9 ? 'ENDING SOON!' : `${raceIntensity.toUpperCase()} INTENSITY`}
              </Text>
            </Animated.View>
          </Animated.View>
          
          {/* Enhanced Race Progress Bar */}
          <View style={styles.raceProgressContainer}>
            <View style={styles.raceProgressBar}>
              <Animated.View
                style={[
                  styles.raceProgressFill,
                  {
                    width: `${raceProgress * 100}%`,
                    backgroundColor: raceProgress > 0.8 ? '#FF4444' : 
                                   raceProgress > 0.6 ? '#FFD700' : '#00FF88',
                  }
                ]}
              />
            </View>
            <Text style={styles.raceProgressText}>
              Race Progress: {(raceProgress * 100).toFixed(1)}%
            </Text>
          </View>
          
          {/* Enhanced Racing Track Lines with Dynamic Speed */}
          <View style={styles.trackLinesContainer}>
            {[...Array(6)].map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.trackLine,
                  {
                    opacity: raceIntensity === 'extreme' ? 0.8 : 0.6,
                    backgroundColor: raceIntensity === 'extreme' ? '#FF4444' : 'rgba(255, 255, 255, 0.2)',
                    transform: [{
                      translateX: raceTrackAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-80, screenWidth + 80],
                      }),
                    }],
                  },
                ]}
              />
            ))}
          </View>
        </LinearGradient>
      </View>

      {/* Enhanced User Position Card - Premium Design */}
      {userPosition && (
        <Animated.View 
          style={[
            styles.userPositionCard,
            {
              shadowColor: userPosition.isCurrentlyWinning ? '#00FF88' : '#9945FF',
              shadowOpacity: userPosition.isCurrentlyWinning ? 0.4 : 0.2,
              borderColor: userPosition.isCurrentlyWinning ? 'rgba(0, 255, 136, 0.5)' : 'rgba(153, 69, 255, 0.3)',
              transform: [{
                scale: userPosition.isCurrentlyWinning ? 
                  pulseAnim.interpolate({
                    inputRange: [1, 1.08],
                    outputRange: [1, 1.02],
                  }) : 1
              }],
            }
          ]}
        >
          <LinearGradient
            colors={
              userPosition.isCurrentlyWinning ? 
                ['rgba(0, 255, 136, 0.3)', 'rgba(20, 241, 149, 0.2)', 'rgba(0, 0, 0, 0.9)'] :
                userPosition.profitLoss >= 0 ?
                  ['rgba(153, 69, 255, 0.4)', 'rgba(20, 241, 149, 0.2)', 'rgba(0, 0, 0, 0.8)'] :
                  ['rgba(255, 68, 68, 0.3)', 'rgba(153, 69, 255, 0.2)', 'rgba(0, 0, 0, 0.8)']
            }
            style={styles.userPositionGradient}
          >
            <View style={styles.userPositionHeader}>
              <View style={styles.userPositionLeft}>
                <Animated.View
                  style={{
                    transform: [{ scale: pulseAnim }],
                  }}
                >
                  <MaterialCommunityIcons 
                    name={userPosition.isCurrentlyWinning ? "trophy" : userPosition.rank <= 2 ? "medal" : "account-star"} 
                    size={24} 
                    color={userPosition.profitLoss > 0 ? '#00FF88' : '#FF4444'} 
                  />
                </Animated.View>
                <View>
                  <Text style={styles.userPositionTitle}>Your Race Position</Text>
                  <Text style={styles.userPositionSubtitle}>
                    #{userPosition.rank} • {userPosition.asset.symbol} • {(typeof userPosition.winProbability === 'number' && !isNaN(userPosition.winProbability)) ? userPosition.winProbability.toFixed(0) : '0'}% chance
                  </Text>
                </View>
              </View>
              
              <View style={styles.userPositionStats}>
                <Animated.Text
                  style={[
                    styles.userPerformanceValue,
                    { 
                      color: userPosition.profitLoss >= 0 ? '#00FF88' : '#FF4444',
                      transform: [{
                        scale: priceUpdateFlashAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.1],
                        }),
                      }],
                    }
                  ]}
                >
                  {userPosition.profitLossPercent >= 0 ? '+' : ''}{(typeof userPosition.profitLossPercent === 'number' && !isNaN(userPosition.profitLossPercent)) ? userPosition.profitLossPercent.toFixed(1) : '0.0'}%
                </Animated.Text>
                <Text style={styles.userPerformanceLabel}>P&L</Text>
              </View>
            </View>
            
            {/* Enhanced Bet Tracking with Real-time Values */}
            <View style={styles.userBetDetails}>
              <View style={styles.betDetailColumn}>
                <Text style={styles.betDetailLabel}>Original Bet</Text>
                <Text style={styles.betDetailValue}>
                  ${(typeof userPosition.originalAmount === 'number' && !isNaN(userPosition.originalAmount)) ? userPosition.originalAmount.toFixed(2) : '0.00'}
                </Text>
              </View>
              
              <MaterialCommunityIcons 
                name="arrow-right" 
                size={16} 
                color="rgba(255,255,255,0.5)" 
              />
              
              <View style={styles.betDetailColumn}>
                <Text style={styles.betDetailLabel}>Current Value</Text>
                <Animated.Text
                  style={[
                    styles.betDetailValue,
                    { 
                      color: userPosition.profitLoss >= 0 ? '#00FF88' : '#FF4444',
                      transform: [{
                        scale: priceUpdateFlashAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.05],
                        }),
                      }],
                    }
                  ]}
                >
                  ${(typeof userPosition.currentBetValue === 'number' && !isNaN(userPosition.currentBetValue)) ? userPosition.currentBetValue.toFixed(2) : '0.00'}
                </Animated.Text>
              </View>
              
              <MaterialCommunityIcons 
                name="trending-up" 
                size={16} 
                color={userPosition.profitLoss >= 0 ? '#00FF88' : '#FF4444'} 
              />
              
              <View style={styles.betDetailColumn}>
                <Text style={styles.betDetailLabel}>If Win</Text>
                <Text style={[styles.betDetailValue, { color: '#FFD700' }]}>
                  ${(typeof userPosition.potentialPayout === 'number' && !isNaN(userPosition.potentialPayout)) ? userPosition.potentialPayout.toFixed(2) : '0.00'}
                </Text>
              </View>
            </View>
            
            {/* Enhanced Real-time Profit/Loss Display */}
            <View style={styles.profitLossSection}>
              <View style={styles.profitLossMain}>
                <View style={styles.profitLossLabelContainer}>
                  <MaterialCommunityIcons 
                    name={userPosition.profitLoss >= 0 ? "rocket-launch" : "trending-down"} 
                    size={16} 
                    color={userPosition.profitLoss >= 0 ? '#00FF88' : '#FF4444'} 
                  />
                  <Text style={styles.profitLossLabel}>
                    {userPosition.profitLoss >= 0 ? 'Profit' : 'Loss'}
                  </Text>
                </View>
                <Animated.Text
                  style={[
                    styles.profitLossValue,
                    { 
                      color: userPosition.profitLoss >= 0 ? '#00FF88' : '#FF4444',
                      transform: [{
                        scale: priceUpdateFlashAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.08],
                        }),
                      }],
                    }
                  ]}
                >
                  {userPosition.profitLoss >= 0 ? '+' : ''}${(typeof userPosition.profitLoss === 'number' && !isNaN(userPosition.profitLoss)) ? Math.abs(userPosition.profitLoss).toFixed(2) : '0.00'}
                </Animated.Text>
              </View>
              
              {/* Pool Share & Odds Info */}
              <View style={styles.advancedStats}>
                <View style={styles.advancedStatItem}>
                  <Text style={styles.advancedStatLabel}>Pool Share</Text>
                  <Text style={styles.advancedStatValue}>{(typeof userPosition.userPoolShare === 'number' && !isNaN(userPosition.userPoolShare)) ? userPosition.userPoolShare.toFixed(2) : '0.00'}%</Text>
                </View>
                <View style={styles.advancedStatItem}>
                  <Text style={styles.advancedStatLabel}>Status</Text>
                  <Animated.Text
                    style={[
                      styles.advancedStatValue,
                      {
                        transform: [{
                          scale: pulseAnim,
                        }],
                      },
                    ]}
                  >
                    {userPosition.isCurrentlyWinning ? 'WINNING' : 'LOSING'}
                  </Animated.Text>
                </View>
                <View style={styles.advancedStatItem}>
                  <Text style={styles.advancedStatLabel}>Trend</Text>
                  <View style={styles.trendIconContainer}>
                    <MaterialCommunityIcons 
                      name={
                        getOddsTrend(userPosition.asset.index) === 'increasing' ? "trending-up" : 
                        getOddsTrend(userPosition.asset.index) === 'decreasing' ? "trending-down" : "trending-neutral"
                      } 
                      size={14} 
                      color={
                        getOddsTrend(userPosition.asset.index) === 'increasing' ? '#FF4444' : 
                        getOddsTrend(userPosition.asset.index) === 'decreasing' ? '#00FF88' : '#FFD700'
                      } 
                    />
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Enhanced Live Leaderboard with Sophisticated Data */}
      <Animated.View
        style={[
          styles.leaderboardSection,
          {
            opacity: leaderboardAnim,
            transform: [{
              translateY: leaderboardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          },
        ]}
      >
        <View style={styles.leaderboardHeader}>
          <View style={styles.leaderboardTitleContainer}>
            <MaterialCommunityIcons name="trophy" size={20} color="#FFD700" />
            <Text style={styles.leaderboardTitle}>Live Leaderboard</Text>
          </View>
        </View>

        {/* Enhanced Asset Performance Cards with Live Updates */}
        <View style={styles.assetLeaderboard}>
          {assetPerformances.map((asset: any, position: number) => {
            const isRecentlyUpdated = recentlyUpdatedAssets.has(asset.symbol)
            
            return (
              <Animated.View 
                key={asset.index} 
                style={[
                  styles.assetRaceCard,
                  isRecentlyUpdated && {
                    transform: [{
                      scale: priceUpdateAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.02]
                      })
                    }]
                  }
                ]}
              >
              <LinearGradient
                colors={
                  asset.isUserAsset
                    ? ['rgba(153, 69, 255, 0.4)', 'rgba(20, 241, 149, 0.2)', 'rgba(0, 0, 0, 0.8)']
                    : position === 0
                    ? ['rgba(255, 215, 0, 0.3)', 'rgba(255, 165, 0, 0.1)', 'rgba(0, 0, 0, 0.8)']
                    : position === 1
                    ? ['rgba(192, 192, 192, 0.3)', 'rgba(168, 168, 168, 0.1)', 'rgba(0, 0, 0, 0.8)']
                    : position === 2
                    ? ['rgba(205, 127, 50, 0.3)', 'rgba(139, 69, 19, 0.1)', 'rgba(0, 0, 0, 0.8)']
                    : ['rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.8)']
                }
                style={styles.assetRaceGradient}
              >
                {/* Enhanced Leaderboard Rank Badge */}
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 10,
                      shadowColor: position < 3 ? '#000' : 'rgba(255,255,255,0.3)',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 8,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={
                      position === 0 
                        ? ['#FFD700', '#FFA500', '#FF8C00'] // Gold gradient
                        : position === 1 
                        ? ['#E5E5E5', '#C0C0C0', '#A8A8A8'] // Silver gradient
                        : position === 2 
                        ? ['#D2691E', '#CD7F32', '#8B4513'] // Bronze gradient
                        : ['rgba(99, 102, 241, 0.8)', 'rgba(79, 70, 229, 0.6)', 'rgba(55, 48, 163, 0.4)'] // Purple gradient for others
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      {
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: position < 3 ? 3 : 2,
                        borderColor: position === 0 ? '#FFED4A' : position === 1 ? '#F7FAFC' : position === 2 ? '#F6AD55' : 'rgba(255,255,255,0.3)',
                      },
                    ]}
                  >
                    {/* Crown for 1st place, Trophy for 2nd, Medal for 3rd */}
                    {position === 0 && (
                      <View style={{ position: 'absolute', top: -2 }}>
                        <MaterialCommunityIcons name="crown" size={16} color="#8B4513" />
                      </View>
                    )}
                    {position === 1 && (
                      <View style={{ position: 'absolute', top: -1 }}>
                        <MaterialCommunityIcons name="trophy-variant" size={14} color="#4A5568" />
                      </View>
                    )}
                    {position === 2 && (
                      <View style={{ position: 'absolute', top: -1 }}>
                        <MaterialCommunityIcons name="medal" size={14} color="#744210" />
                      </View>
                    )}
                    
                    {/* Rank Number with enhanced styling */}
                    <Text style={[
                      {
                        color: position < 3 ? '#1A202C' : '#FFFFFF',
                        fontSize: position < 3 ? 18 : 16,
                        fontWeight: '900',
                        fontFamily: 'Orbitron-Black',
                        textAlign: 'center',
                        textShadowColor: position < 3 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.8)',
                        textShadowOffset: { width: 1, height: 1 },
                        textShadowRadius: 2,
                        letterSpacing: 0.5,
                        marginTop: position < 3 ? 14 : 2,
                      }
                    ]}>
                      {position + 1}
                    </Text>
                    
                    {/* Subtle glow effect for top 3 */}
                    {position < 3 && (
                      <View style={[
                        {
                          position: 'absolute',
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: position === 0 ? 'rgba(255, 215, 0, 0.2)' : position === 1 ? 'rgba(192, 192, 192, 0.2)' : 'rgba(205, 127, 50, 0.2)',
                          top: -2,
                          left: -2,
                          zIndex: -1,
                        }
                      ]} />
                    )}
                  </LinearGradient>
                </Animated.View>
                <Animated.View
                  style={[
                    styles.votingButtons,
                    styles.hotEffect,
                    {
                      opacity: sparkleAnim,
                      transform: [{
                        rotate: sparkleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      }],
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="fire" size={16} color="#FF4444" />
                </Animated.View>

                {asset.velocity === 'crash' && (
                  <Animated.View
                    style={[
                      styles.crashEffect,
                      {
                        opacity: priceUpdateFlashAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.7, 1],
                        }),
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="trending-down" size={16} color="#FF4444" />
                  </Animated.View>
                )}

                {/* User Asset Indicator */}
                {asset.isUserAsset && (
                  <Animated.View
                    style={[
                      styles.userAssetBadge,
                      {
                        transform: [{ scale: pulseAnim }],
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="account-star" size={12} color="#FFF" />
                    <Text style={styles.userAssetText}>YOUR BET</Text>
                  </Animated.View>
                )}

                <View style={styles.assetRaceContent}>
                  {/* Enhanced Asset Header with Live Data */}
                  <View style={styles.assetRaceHeader}>
                    <View style={styles.assetRaceInfo}>
                      <View style={[styles.assetDot, { backgroundColor: asset.color }]} />
                      <View>
                        <View style={styles.assetSymbolRow}>
                          <Text style={styles.assetRaceSymbol}>{asset.symbol}</Text>
                          {asset.hasLivePrice && (
                              <Animated.View 
                                style={[
                                  styles.liveDataBadge,
                                  {
                                    opacity: liveIndicatorAnim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [0.8, 1],
                                    }),
                                    transform: isRecentlyUpdated ? [{
                                      scale: priceUpdateAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1, 1.1]
                                      })
                                    }] : [],
                                  }
                                ]}
                              >
                                <Text style={styles.liveDataText}>●LIVE</Text>
                              </Animated.View>
                            )}
                            {getCrowdSentiment(asset.symbol).upPercent > 75 && (
                              <MaterialCommunityIcons name="trending-up" size={12} color="#00FF88" />
                          )}
                        </View>
                        <Text style={styles.assetRaceName}>{asset.name}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.assetRaceStats}>
                      <Animated.Text
                        style={[
                          styles.assetRacePerformance,
                          { 
                            color: asset.velocity === 'hot' ? '#FF6B6B' :
                                   asset.velocity === 'crash' ? '#FF4444' :
                                   asset.performance >= 0 ? '#00FF88' : '#FF4444',
                            transform: isRecentlyUpdated ? [{
                              scale: priceUpdateFlashAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.1],
                              }),
                            }] : [],
                          }
                        ]}
                      >
                          {asset.performance >= 0 ? '+' : ''}{(typeof asset.performance === 'number' && !isNaN(asset.performance)) ? asset.performance.toFixed(2) : '0.00'}%
                      </Animated.Text>
                      <MaterialCommunityIcons 
                        name={
                          asset.velocity === 'hot' ? "fire" :
                          asset.velocity === 'crash' ? "trending-down" :
                          asset.velocity === 'up' ? "trending-up" : 
                          asset.velocity === 'down' ? "trending-down" : "trending-neutral"
                        } 
                        size={16} 
                        color={
                          asset.velocity === 'hot' ? '#FF6B6B' :
                          asset.velocity === 'crash' ? '#FF4444' :
                          asset.performance >= 0 ? '#00FF88' : '#FF4444'
                        } 
                      />
                    </View>
                  </View>

                  {/* Enhanced Price Movement with Confidence */}
                  <View style={styles.priceMovement}>
                    <View style={styles.priceInfo}>
                      <View style={styles.priceLeft}>
                        <Text style={styles.priceLabel}>Current Price</Text>
                        <Animated.Text
                          style={[
                            styles.priceValue,
                            isRecentlyUpdated && {
                              transform: [{
                                scale: priceUpdateFlashAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 1.05],
                                }),
                              }],
                            },
                          ]}
                        >
                          ${asset.currentPrice?.toLocaleString('en-US', { 
                            minimumFractionDigits: asset.symbol === 'BTC' ? 0 : 2, 
                            maximumFractionDigits: asset.symbol === 'BTC' ? 0 : 2 
                          })}
                        </Animated.Text>
                      </View>
                      

                    </View>
                    
                    {/* Enhanced Momentum Bar with Velocity Indicators */}
                    <View style={styles.momentumSection}>
                      <View style={styles.momentumHeader}>
                        <Text style={styles.momentumLabel}>Momentum</Text>
                        <Text style={[
                          styles.momentumValue,
                          { 
                            color: asset.momentum > 3 ? '#FF6B6B' :
                                   asset.momentum > 2 ? '#FFD700' :
                                   asset.momentum > 1 ? '#00FF88' : '#888'
                          }
                        ]}>
                            {(typeof asset.momentum === 'number' && !isNaN(asset.momentum)) ? asset.momentum.toFixed(1) : '0.0'}
                        </Text>
                      </View>
                      <View style={styles.momentumBarContainer}>
                        <View style={styles.momentumBarTrack}>
                          <Animated.View
                            style={[
                              styles.momentumBarFill,
                              {
                                width: momentumBarAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['20%', `${Math.min(100, Math.max(20, asset.momentum * 20 + 20))}%`],
                                }),
                                backgroundColor: asset.velocity === 'hot' ? '#FF6B6B' :
                                               asset.velocity === 'crash' ? '#FF4444' :
                                               asset.performance >= 0 ? '#00FF88' : '#FF4444',
                              },
                            ]}
                          />
                          {/* Enhanced momentum pulse effect for high momentum assets */}
                          {asset.momentum > 3 && (
                            <Animated.View
                              style={[
                                styles.momentumPulse,
                                {
                                  opacity: sparkleAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.3, 0.8],
                                  }),
                                },
                              ]}
                            />
                          )}
                        </View>
                        <Text style={styles.momentumText}>
                          {asset.momentum > 3 ? 'Extreme' :
                           asset.momentum > 2 ? 'High' : 
                           asset.momentum > 1 ? 'Med' : 'Low'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Enhanced Pool & Market Data */}
                  <View style={styles.marketDataSection}>
                    <View style={styles.poolShareSection}>
                      <Text style={styles.poolShareLabel}>Pool Share</Text>
                        <Text style={styles.poolShareValue}>{(typeof asset.poolShare === 'number' && !isNaN(asset.poolShare)) ? asset.poolShare.toFixed(1) : '0.0'}%</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
              </Animated.View>
            )
          })}
        </View>
      </Animated.View>

      {/* ACCURATE Pool-Based Payout Display */}
      <View style={styles.oddsSection}>
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.2)', 'rgba(255, 215, 0, 0.1)', 'rgba(0, 0, 0, 0.8)']}
          style={styles.oddsContainer}
        >
          <View style={styles.oddsHeader}>
            <View style={styles.oddsHeaderLeft}>
              <MaterialCommunityIcons name="account-cash" size={20} color="#FFD700" />
              <Text style={styles.oddsTitle}>Payouts</Text>
            </View>
            <Text style={styles.oddsSubtitle}>Winner takes all</Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.oddsScrollView}>
            <View style={styles.oddsGrid}>
              {assetPerformances.map((asset: any, index: number) => {
                // Simple user bet detection
                let isUserBet = false
                if (userBet && userBet.assetIdx === asset.index) {
                  isUserBet = true
                } else if (userBets && race?.raceId) {
                  const foundBet = userBets.find((bet: any) => bet.raceId === race.raceId && bet.assetIdx === asset.index)
                  isUserBet = !!foundBet
                }
                const maxPerformance = Math.max(...assetPerformances.map((a: any) => a.performance))
                const isWinning = Math.abs(asset.performance - maxPerformance) < 0.001
                
                // Calculate EXACT payout multiplier using smart contract logic
                let payoutMultiplier = 0
                
                if (isWinning && race?.totalPool && race?.assetPools) {
                  const totalPool = race.totalPool / 1_000_000 // Convert to USDC
                  const feeBps = race.feeBps || 500 // Default 5% fee
                  const netPool = totalPool * (1 - feeBps / 10000) // Deduct protocol fee
                  
                  // Calculate winning pool (sum of pools for winning assets)
                  let winningPool = 0
                  assetPerformances.forEach((winningAsset: any) => {
                    if (Math.abs(winningAsset.performance - maxPerformance) < 0.001) {
                      winningPool += (race.assetPools[winningAsset.index] || 0) / 1_000_000
                    }
                  })
                  
                  if (winningPool > 0) {
                    // EXACT SMART CONTRACT CALCULATION:
                    // payout_ratio = (net_pool * SCALING_FACTOR) / winning_pool
                    // payout_multiplier = payout_ratio / SCALING_FACTOR = net_pool / winning_pool
                    payoutMultiplier = netPool / winningPool
                  }
                }
                
                return (
                  <View key={asset.index} style={styles.oddsCard}>
                    <LinearGradient
                      colors={
                        isWinning
                          ? ['rgba(0, 255, 136, 0.3)', 'rgba(0, 255, 136, 0.1)']
                          : isUserBet 
                          ? ['rgba(153, 69, 255, 0.3)', 'rgba(153, 69, 255, 0.1)']
                          : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']
                      }
                      style={styles.oddsCardGradient}
                    >
                      <View style={styles.oddsCardHeader}>
                        <Text style={[
                          styles.oddsAssetSymbol,
                          isWinning && { color: '#00FF88', fontWeight: '800' },
                          isUserBet && !isWinning && { color: '#9945FF', fontWeight: '800' }
                        ]}>
                          {asset.symbol}
                        </Text>
                        
                        {/* Winner/Loser Indicator */}
                        {isWinning ? (
                          <View style={[styles.trendIndicator, { backgroundColor: 'rgba(0, 255, 136, 0.3)' }]}>
                            <MaterialCommunityIcons name="trophy" size={12} color="#00FF88" />
                            <Text style={[styles.trendText, { color: '#00FF88' }]}>
                              WINNER
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.trendIndicator, { backgroundColor: 'rgba(255, 68, 68, 0.2)' }]}>
                            <MaterialCommunityIcons name="close" size={12} color="#FF4444" />
                            <Text style={[styles.trendText, { color: '#FF4444' }]}>
                              LOSES
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.oddsValueSection}>
                        <Text style={[
                          styles.oddsValue,
                          { color: isWinning ? '#00FF88' : '#FF4444' },
                          isUserBet && { fontSize: 18 }
                        ]}>
                          {isWinning && payoutMultiplier > 0 ? `${payoutMultiplier.toFixed(2)}x` : '0.00x'}
                        </Text>
                        

                      </View>
                      
                      {isUserBet && (
                        <View style={styles.userBetOddsIndicator}>
                          <Text style={styles.userBetOddsText}>YOUR BET</Text>
                        </View>
                      )}
                    </LinearGradient>
                  </View>
                )
              })}
            </View>
          </ScrollView>
          
          {/* Pool Distribution Summary */}
          <View style={styles.poolSummary}>
            <View style={styles.poolSummaryLeft}>
              <Text style={styles.poolSummaryLabel}>Total Pool</Text>
              <Text style={styles.poolSummaryValue}>{formatValue(race?.totalPool || 0)}</Text>
            </View>
            <View style={styles.poolSummaryCenter}>
              <Text style={styles.poolSummaryLabel}>Protocol Fee</Text>
              <Text style={styles.poolSummaryValue}>
                {((race?.feeBps || 500) / 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.poolSummaryRight}>
              <Text style={styles.poolSummaryLabel}>Winner Pool</Text>
              <Text style={styles.poolSummaryValue}>
                {formatValue((race?.totalPool || 0) * (1 - (race?.feeBps || 500) / 10000))}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ULTRA-ENHANCED Race Statistics Dashboard */}
      <View style={styles.raceStatsSection}>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.9)']}
          style={styles.raceStatsGradient}
        >
          <View style={styles.raceStatsHeader}>
            <Text style={styles.raceStatsTitle}>Market Analytics</Text>
            <View style={styles.marketIndicators}>
              <View style={[
                styles.marketIndicator,
                { backgroundColor: raceIntensity === 'extreme' ? 'rgba(255, 68, 68, 0.2)' : 'rgba(0, 255, 136, 0.2)' }
              ]}>
                <Text style={[
                  styles.marketIndicatorText,
                  { color: raceIntensity === 'extreme' ? '#FF4444' : '#00FF88' }
                ]}>
                  {raceIntensity === 'extreme' ? 'VOLATILE' : 'STABLE'}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.raceStatsGrid}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="account-group" size={20} color="#14F195" />
              <Text style={styles.statValue}>{race?.participantCount || 0}</Text>
              <Text style={styles.statLabel}>Active Racers</Text>
            </View>
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="wallet" size={20} color="#FFD700" />
              <Text style={styles.statValue}>{formatValue(race?.totalPool || 0)}</Text>
              <Text style={styles.statLabel}>Total Pool</Text>
            </View>
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="flash" size={20} color="#FF6B6B" />
              <Text style={styles.statValue}>
                {(typeof Math.max(...assetPerformances.map((a: any) => Math.abs(a.performance))) === 'number' && !isNaN(Math.max(...assetPerformances.map((a: any) => Math.abs(a.performance))))) ? Math.max(...assetPerformances.map((a: any) => Math.abs(a.performance))).toFixed(1) : '0.0'}%
              </Text>
              <Text style={styles.statLabel}>Max Swing</Text>
            </View>
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="chart-line" size={20} color="#9945FF" />
              <Text style={styles.statValue}>
                {(typeof (assetPerformances.reduce((sum: number, a: any) => sum + a.momentum, 0) / assetPerformances.length) === 'number' && !isNaN((assetPerformances.reduce((sum: number, a: any) => sum + a.momentum, 0) / assetPerformances.length))) ? (assetPerformances.reduce((sum: number, a: any) => sum + a.momentum, 0) / assetPerformances.length).toFixed(1) : '0.0'}
              </Text>
              <Text style={styles.statLabel}>Avg Momentum</Text>
            </View>
          </View>
          

        </LinearGradient>
      </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  performanceContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingBottom: 20,
  },
  
  // Racing Header - Responsive
  racingHeader: {
    marginBottom: SPACING.xl,
    marginHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
    borderRadius: isTablet ? 20 : 16,
    overflow: 'hidden',
  },
  racingHeaderGradient: {
    padding: isTablet ? SPACING.xxl : SPACING.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  racingHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
    marginRight: 8,
  },
  liveText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.error,
    fontFamily: 'Orbitron-Bold',
  },
  raceIntensityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intensityText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'Orbitron-SemiBold',
  },
  trackLinesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-around',
    zIndex: 1,
  },
  trackLine: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 60,
  },
  
  // User Position Card - Responsive
  userPositionCard: {
    marginBottom: SPACING.xl,
    marginHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
    borderRadius: isTablet ? 20 : 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
  },
  userPositionGradient: {
    padding: isTablet ? SPACING.xxl : SPACING.xl,
  },
  userPositionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userPositionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userPositionTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginLeft: SPACING.md,
    fontFamily: 'Orbitron-Bold',
  },
  userPositionSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginLeft: SPACING.md,
    fontFamily: 'Orbitron-Regular',
  },
  userPositionStats: {
    alignItems: 'flex-end',
  },
  userPerformanceValue: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'Orbitron-ExtraBold',
  },
  userPerformanceLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  userBetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  betDetailItem: {
    alignItems: 'center',
  },
  betDetailColumn: {
    alignItems: 'center',
    flex: 1,
  },
  betDetailLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    fontFamily: 'Orbitron-Regular',
  },
  betDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  
  // Profit/Loss Section
  profitLossSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  profitLossMain: {
    alignItems: 'center',
  },
  profitLossLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profitLossLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  profitLossValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#00FF88',
    fontFamily: 'Orbitron-ExtraBold',
  },
  
  // Advanced Stats
  advancedStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  advancedStatItem: {
    alignItems: 'center',
  },
  advancedStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  advancedStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#14F195',
    fontFamily: 'Orbitron-Bold',
  },
  
  // Leaderboard
  leaderboardSection: {
    marginBottom: 20,
    marginHorizontal: 20,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
     leaderboardTitleSection: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'space-between',
     flex: 1,
   },
   leaderboardTitleContainer: {
     flexDirection: 'row',
     alignItems: 'center',
   },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 8,
    fontFamily: 'Orbitron-Bold',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(153, 69, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
  },
  connectionText: {
    fontSize: 10,
    color: '#9945FF',
    marginLeft: 4,
    fontFamily: 'Orbitron-SemiBold',
  },
  
  // Asset Leaderboard
  assetLeaderboard: {
    gap: 12,
  },
     assetRaceCard: {
     borderRadius: 16,
     overflow: 'hidden',
     borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.1)',
     marginBottom: 12,
     position: 'relative', // Ensure relative positioning for absolute children
   },
  assetRaceGradient: {
    padding: 16,
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column', // Stack icon above number
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Orbitron-ExtraBold',
  },
  sparkleEffect: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 3,
  },
  userStarBadge: {
    position: 'absolute',
    top: 8,
    right: 32,
    backgroundColor: 'rgba(153, 69, 255, 0.3)',
    borderRadius: 10,
    padding: 4,
    zIndex: 3,
  },
  assetRaceContent: {
    marginRight: 40, // Space for rank badge
  },
  assetRaceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assetRaceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  assetRaceSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  assetRaceName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  assetRaceStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetRacePerformance: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
    fontFamily: 'Orbitron-Bold',
  },
  
  // Price Movement
  priceMovement: {
    marginBottom: 12,
  },
  priceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLeft: {
    flex: 1,
  },
  priceRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Orbitron-SemiBold',
  },
  
     // Momentum Section
   momentumSection: {
     marginTop: 8,
     marginBottom: 8,
   },
  momentumLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  momentumBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  momentumBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  momentumBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  momentumText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Orbitron-SemiBold',
    minWidth: 40,
  },
  
  // Pool Share
  poolShareSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  poolShareLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  poolShareValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#14F195',
    fontFamily: 'Orbitron-SemiBold',
  },
  
  // Enhanced features styles
     intensityBadge: {
     paddingVertical: 4,
     paddingHorizontal: 8,
     borderRadius: 10,
     borderWidth: 1,
     borderColor: 'rgba(255, 255, 255, 0.3)',
     alignSelf: 'flex-start',
   },
  intensityBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },
  leaderboardControls: {
    flexDirection: 'row',
    gap: 8,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(153, 69, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
  },
  detailsToggleText: {
    fontSize: 8,
    color: '#9945FF',
    marginLeft: 4,
    fontFamily: 'Orbitron-SemiBold',
  },
  hotEffect: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
  },
  crashEffect: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    zIndex: 2,
  },
     userAssetBadge: {
     position: 'absolute',
     bottom: 12,
     right: 12,
     backgroundColor: 'rgba(153, 69, 255, 0.9)',
     borderRadius: 12,
     paddingVertical: 4,
     paddingHorizontal: 8,
     zIndex: 4,
     flexDirection: 'row',
     alignItems: 'center',
     borderWidth: 1,
     borderColor: '#9945FF',
   },
     userAssetText: {
     fontSize: 9,
     color: '#FFFFFF',
     fontWeight: '700',
     fontFamily: 'Orbitron-Bold',
     marginLeft: 4,
   },
  assetSymbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDataBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.3)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginLeft: 6,
  },
  liveDataText: {
    fontSize: 8,
    color: '#00FF88',
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },

  momentumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  momentumValue: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },
  momentumPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
     marketDataSection: {
     flexDirection: 'row',
     justifyContent: 'space-around',
     marginTop: 12,
     paddingTop: 12,
     borderTopWidth: 1,
     borderTopColor: 'rgba(255,255,255,0.1)',
   },
  marketStatItem: {
    alignItems: 'center',
  },
  marketStatLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  marketStatValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#14F195',
    fontFamily: 'Orbitron-SemiBold',
  },
  
  // Odds Section
  oddsSection: {
    marginBottom: 20,
    marginHorizontal: 20,
  },
  oddsContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  oddsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  oddsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oddsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 8,
    fontFamily: 'Orbitron-Bold',
  },
  oddsSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  oddsScrollView: {
    paddingHorizontal: 20,
  },
  oddsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  oddsCard: {
    width: 120,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  oddsCardGradient: {
    padding: 12,
    minHeight: 80,
  },
  oddsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  oddsAssetSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  trendIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 8,
    fontWeight: '600',
    marginLeft: 2,
    fontFamily: 'Orbitron-SemiBold',
  },
  oddsValueSection: {
    alignItems: 'center',
  },
  oddsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Orbitron-ExtraBold',
  },
  poolShareOdds: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
    marginTop: 4,
  },
  userBetOddsIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(153, 69, 255, 0.3)',
    padding: 4,
    alignItems: 'center',
  },
  userBetOddsText: {
    fontSize: 8,
    color: '#9945FF',
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },
  
  // Pool Summary
  poolSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  poolSummaryLeft: {
    alignItems: 'center',
  },
  poolSummaryCenter: {
    alignItems: 'center',
  },
  poolSummaryRight: {
    alignItems: 'center',
  },
  poolSummaryLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  poolSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD700',
    fontFamily: 'Orbitron-Bold',
  },
  
  // Race Statistics
  raceStatsSection: {
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 20,
  },
  raceStatsGradient: {
    padding: 20,
  },
  raceStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  raceStatsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  marketIndicators: {
    flexDirection: 'row',
    gap: 8,
  },
  marketIndicator: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  marketIndicatorText: {
    fontSize: 8,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },
  raceStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'Orbitron-Bold',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
  },
  
  // Advanced Analytics
  advancedAnalytics: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  analyticsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analyticsItem: {
    alignItems: 'center',
  },
  analyticsLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  analyticsValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#14F195',
    fontFamily: 'Orbitron-Bold',
  },
  
  // No Bet Card
  noBetCard: {
    marginBottom: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  noBetGradient: {
    padding: 20,
  },
  noBetContent: {
    alignItems: 'center',
  },
  noBetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
    fontFamily: 'Orbitron-Bold',
  },
  noBetDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'Orbitron-Regular',
  },
  noBetStats: {
    alignItems: 'center',
    gap: 8,
  },
  noBetStatsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Orbitron-SemiBold',
    marginLeft: 4,
  },
  noBetStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Error, Loading, and Empty States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  errorTitle: {
    ...TYPOGRAPHY.title,
    fontWeight: '700',
    color: COLORS.warning,
    marginTop: SPACING.md,
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
  },
  errorMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  loadingText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.primary,
    marginTop: SPACING.md,
    textAlign: 'center',
    fontFamily: 'Orbitron-SemiBold',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  emptyTitle: {
    ...TYPOGRAPHY.title,
    fontWeight: '700',
    color: COLORS.warning,
    marginTop: SPACING.md,
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
  },
  emptyMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
  },

  raceProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  raceProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  raceProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  raceProgressText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 8,
    fontFamily: 'Orbitron-SemiBold',
  },

  crowdSentimentLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  votingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  votingButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  voteButtonActive: {
    borderColor: '#00FF88',
    backgroundColor: 'rgba(0,255,136,0.1)',
  },
  voteButtonActiveRed: {
    borderColor: '#FF4444',
    backgroundColor: 'rgba(255,68,68,0.1)',
  },
  voteCount: {
    fontSize: 10,
    color: '#fff',
    marginLeft: 2,
    fontFamily: 'Orbitron-SemiBold',
  },
  sentimentBar: {
    width: 100,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 4,
  },
  sentimentFill: {
    height: '100%',
    borderRadius: 2,
  },
  sentimentText: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Orbitron-SemiBold',
    marginLeft: 4,
  },
  trendIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentimentValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
})