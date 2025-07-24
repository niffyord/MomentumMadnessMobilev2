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
  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection' | 'topping' | 'dropping_from_top', context?: string) => {
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
        case 'topping':
          // Special pattern for reaching #1: Triple heavy impact with success notification
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          await new Promise(resolve => setTimeout(resolve, 80))
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          await new Promise(resolve => setTimeout(resolve, 80))
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          break
        case 'dropping_from_top':
          // Special pattern for dropping from #1: Sharp double impact with warning
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          await new Promise(resolve => setTimeout(resolve, 50))
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          await new Promise(resolve => setTimeout(resolve, 50))
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
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
        const previousRank = previousUserRank.current
        const currentRank = userPosition.rank
        
        if (rankImproved) {
          // Check if user just reached the top position
          if (currentRank === 1) {
            triggerHaptic('topping', `🏆 REACHED #1! Your asset is now leading the race!`)
          } else {
            triggerHaptic('success', `rank improved to #${currentRank}`)
          }
          
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
          // Check if user just dropped from the top position
          if (previousRank === 1) {
            triggerHaptic('dropping_from_top', `💔 Dropped from #1 to #${currentRank}! Your asset lost the lead!`)
          } else {
            triggerHaptic('error', `rank dropped to #${currentRank}`)
          }
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
            <View style={styles.headerLiveIndicator}>
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
              <Text style={styles.headerLiveText}>
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
            {/* Redesigned User Position Header */}
            <View style={styles.userPositionHeader}>
              <View style={styles.userPositionMainInfo}>
                <View style={styles.positionBadge}>
                  <Animated.View
                    style={{
                      transform: [{ scale: pulseAnim }],
                    }}
                  >
                    <MaterialCommunityIcons 
                      name={userPosition.isCurrentlyWinning ? "trophy" : userPosition.rank <= 2 ? "medal" : "account-star"} 
                      size={20} 
                      color={userPosition.profitLoss > 0 ? '#00FF88' : '#FF4444'} 
                    />
                  </Animated.View>
                  <Text style={styles.positionRank}>#{userPosition.rank}</Text>
                </View>
                
                <View style={styles.userPositionTitleSection}>
                  <Text style={styles.userPositionTitle}>Your Race Position</Text>
                  <View style={styles.userPositionDetails}>
                    <Text style={styles.assetSymbol}>{userPosition.asset.symbol}</Text>
                    <View style={styles.winChanceContainer}>
                      <MaterialCommunityIcons name="target" size={12} color="#FFD700" />
                      <Text style={styles.winChanceText}>
                        {(typeof userPosition.winProbability === 'number' && !isNaN(userPosition.winProbability)) ? userPosition.winProbability.toFixed(0) : '0'}% chance
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              
              <View style={styles.performanceDisplaySection}>
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
            
            {/* Redesigned Bet Summary Cards */}
            <View style={styles.betSummarySection}>
              <View style={styles.betSummaryGrid}>
                <View style={styles.betSummaryCard}>
                  <Text style={styles.betSummaryLabel}>Original Bet</Text>
                  <View style={styles.betSummaryValueContainer}>
                    <MaterialCommunityIcons name="currency-usd" size={16} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.betSummaryValue}>
                      ${(typeof userPosition.originalAmount === 'number' && !isNaN(userPosition.originalAmount)) ? userPosition.originalAmount.toFixed(2) : '0.00'}
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.betSummaryCard, styles.currentValueCard]}>
                  <Text style={styles.betSummaryLabel}>Current Value</Text>
                  <View style={styles.betSummaryValueContainer}>
                    <MaterialCommunityIcons 
                      name={userPosition.profitLoss >= 0 ? "trending-up" : "trending-down"} 
                      size={16} 
                      color={userPosition.profitLoss >= 0 ? '#00FF88' : '#FF4444'} 
                    />
                    <Animated.Text
                      style={[
                        styles.betSummaryValue,
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
                </View>
              </View>
              
              <View style={styles.potentialWinCard}>
                <View style={styles.potentialWinHeader}>
                  <MaterialCommunityIcons name="trophy-award" size={18} color="#FFD700" />
                  <Text style={styles.potentialWinLabel}>Potential Win</Text>
                </View>
                <Text style={styles.potentialWinValue}>
                  ${(typeof userPosition.potentialPayout === 'number' && !isNaN(userPosition.potentialPayout)) ? userPosition.potentialPayout.toFixed(2) : '0.00'}
                </Text>
              </View>
            </View>
            
            {/* Enhanced Profit/Loss Hero Section */}
            <View style={styles.profitLossHeroSection}>
              <View style={styles.profitLossMainCard}>
                <View style={styles.profitLossHeader}>
                  <MaterialCommunityIcons 
                    name={userPosition.profitLoss >= 0 ? "rocket-launch" : "trending-down"} 
                    size={20} 
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
            </View>
            
            {/* Race Statistics Grid */}
            <View style={styles.raceStatsGrid}>
              <View style={styles.raceStatCard}>
                <Text style={styles.raceStatLabel}>Pool Share</Text>
                <Text style={styles.raceStatValue}>{(typeof userPosition.userPoolShare === 'number' && !isNaN(userPosition.userPoolShare)) ? userPosition.userPoolShare.toFixed(2) : '0.00'}%</Text>
              </View>
              
              <View style={[styles.raceStatCard, userPosition.isCurrentlyWinning ? styles.winningCard : styles.losingCard]}>
                <Text style={styles.raceStatLabel}>Status</Text>
                <Animated.Text
                  style={[
                    styles.raceStatValue,
                    {
                      color: userPosition.isCurrentlyWinning ? '#00FF88' : '#FF4444',
                      transform: [{
                        scale: pulseAnim,
                      }],
                    },
                  ]}
                >
                  {userPosition.isCurrentlyWinning ? 'WINNING' : 'LOSING'}
                </Animated.Text>
              </View>
              
              <View style={styles.raceStatCard}>
                <Text style={styles.raceStatLabel}>Trend</Text>
                <View style={styles.trendValueContainer}>
                  <MaterialCommunityIcons 
                    name={
                      getOddsTrend(userPosition.asset.index) === 'increasing' ? "trending-up" : 
                      getOddsTrend(userPosition.asset.index) === 'decreasing' ? "trending-down" : "trending-neutral"
                    } 
                    size={16} 
                    color={
                      getOddsTrend(userPosition.asset.index) === 'increasing' ? '#FF4444' : 
                      getOddsTrend(userPosition.asset.index) === 'decreasing' ? '#00FF88' : '#FFD700'
                    } 
                  />
                  <Text style={[styles.raceStatValue, styles.trendText]}>
                    {getOddsTrend(userPosition.asset.index) === 'increasing' ? 'Rising' : 
                     getOddsTrend(userPosition.asset.index) === 'decreasing' ? 'Falling' : 'Stable'}
                  </Text>
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

        {/* 🚀 ULTRA-THIN RACING CARDS - Redesigned for Maximum Excitement */}
        <View style={styles.assetLeaderboard}>
          {assetPerformances.map((asset: any, position: number) => {
            const isRecentlyUpdated = recentlyUpdatedAssets.has(asset.symbol)
            const isMovingUp = asset.performance >= 0
            const isHot = asset.velocity === 'hot'
            const isCrashing = asset.velocity === 'crash'
            const momentumIntensity = Math.min(Math.max(asset.momentum / 5, 0.2), 1)
            
            return (
              <Animated.View 
                key={asset.index} 
                style={[
                  styles.ultraThinRaceCard,
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
              {/* 🌟 Ultra-Thin Glassmorphism Card */}
              <LinearGradient
                colors={
                  asset.isUserAsset
                    ? ['rgba(153, 69, 255, 0.8)', 'rgba(20, 241, 149, 0.6)', 'rgba(0, 0, 0, 0.95)']
                    : position === 0
                    ? ['rgba(255, 215, 0, 0.8)', 'rgba(255, 165, 0, 0.6)', 'rgba(0, 0, 0, 0.95)']
                    : isHot
                    ? ['rgba(255, 107, 107, 0.8)', 'rgba(255, 68, 68, 0.6)', 'rgba(0, 0, 0, 0.95)']
                    : isCrashing
                    ? ['rgba(255, 68, 68, 0.8)', 'rgba(139, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.95)']
                    : isMovingUp
                    ? ['rgba(0, 255, 136, 0.6)', 'rgba(20, 241, 149, 0.4)', 'rgba(0, 0, 0, 0.95)']
                    : ['rgba(255, 68, 68, 0.6)', 'rgba(220, 38, 127, 0.4)', 'rgba(0, 0, 0, 0.95)']
                }
                style={styles.ultraThinGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* 🏆 Enhanced Premium Position Badge */}
                <Animated.View style={[
                  styles.compactPositionBadge,
                  position === 0 ? styles.goldBadge :
                  position === 1 ? styles.silverBadge :
                  position === 2 ? styles.bronzeBadge :
                  styles.regularBadge,
                  position < 3 && {
                    transform: [{
                      scale: priceUpdateFlashAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.08],
                      })
                    }]
                  }
                ]}>
                  <LinearGradient
                    colors={
                      position === 0 ? ['#FFD700', '#FFA500', '#FF8C00'] : 
                      position === 1 ? ['#E8E8E8', '#C0C0C0', '#A8A8A8'] : 
                      position === 2 ? ['#CD853F', '#CD7F32', '#8B4513'] : 
                      ['rgba(153, 69, 255, 1)', 'rgba(79, 70, 229, 0.8)', 'rgba(67, 56, 202, 0.6)']
                    }
                    style={[
                      styles.positionBadgeGradient,
                      position === 0 ? styles.goldBadge :
                      position === 1 ? styles.silverBadge :
                      position === 2 ? styles.bronzeBadge :
                      styles.regularBadge
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {/* Subtle Inner Glow Effect */}
                    <View style={[
                      StyleSheet.absoluteFillObject,
                      {
                        borderRadius: 16,
                        backgroundColor: position < 3 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                        opacity: 0.6,
                      }
                    ]} />
                    
                    {/* Icons and Numbers */}
                    {position === 0 && (
                      <MaterialCommunityIcons 
                        name="crown" 
                        size={14} 
                        color="#1A202C" 
                        style={{ position: 'absolute', top: 2 }}
                      />
                    )}
                    {position === 1 && (
                      <MaterialCommunityIcons 
                        name="trophy-variant" 
                        size={12} 
                        color="#2D3748" 
                        style={{ position: 'absolute', top: 2 }}
                      />
                    )}
                    {position === 2 && (
                      <MaterialCommunityIcons 
                        name="medal" 
                        size={12} 
                        color="#2D3748" 
                        style={{ position: 'absolute', top: 2 }}
                      />
                    )}
                    
                    <Text style={[
                      styles.positionNumber,
                      position < 3 ? styles.topThreePosition : { color: '#FFFFFF' },
                      {
                        marginTop: position < 3 ? 8 : 0,
                        fontSize: position < 3 ? 10 : 12,
                        fontWeight: '900',
                        textShadowColor: 'rgba(0, 0, 0, 0.8)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 2,
                      }
                    ]}>
                      {position + 1}
                    </Text>
                  </LinearGradient>
                </Animated.View>
                {/* 🔥 Dynamic Effects */}
                {isHot && (
                  <Animated.View style={[styles.hotIndicator, { opacity: sparkleAnim }]}>
                    <MaterialCommunityIcons name="fire" size={12} color="#FF6B6B" />
                  </Animated.View>
                )}

                {isCrashing && (
                  <Animated.View style={[styles.crashIndicator, { opacity: priceUpdateFlashAnim }]}>
                    <MaterialCommunityIcons name="trending-down" size={12} color="#FF4444" />
                  </Animated.View>
                )}



                  {/* ⚡ Main Info Row - Ultra Compact */}
                  <View style={styles.mainInfoRow}>
                    <View style={styles.assetInfo}>
                      <View style={[styles.assetDot, { backgroundColor: asset.color }]} />
                      <View style={styles.nameSection}>
                        <View style={styles.symbolRow}>
                          <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                          {asset.hasLivePrice && (
                            <Animated.View style={[styles.liveIndicator, { opacity: liveIndicatorAnim }]}>
                              <Text style={styles.liveText}>●</Text>
                            </Animated.View>
                          )}
                        </View>
                        <Text style={styles.assetName}>{asset.name}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.performanceSection}>
                      <Animated.Text style={[
                        styles.performanceText,
                        { 
                          color: isMovingUp ? '#00FF88' : '#FF4444',
                          transform: isRecentlyUpdated ? [{ scale: priceUpdateFlashAnim }] : []
                        }
                      ]}>
                        {asset.performance >= 0 ? '+' : ''}{asset.performance?.toFixed(2) || '0.00'}%
                      </Animated.Text>
                      <MaterialCommunityIcons 
                        name={isMovingUp ? "trending-up" : "trending-down"} 
                        size={14} 
                        color={isMovingUp ? '#00FF88' : '#FF4444'} 
                      />
                    </View>
                  </View>

                  {/* 💨 Speed Lines for Movement */}
                  {(isHot || isCrashing || Math.abs(asset.momentum) > 2) && (
                    <Animated.View style={[
                      styles.speedLines,
                      { 
                        opacity: momentumBarAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 0.8]
                        })
                      }
                    ]}>
                      <View style={[styles.speedLine, { backgroundColor: isMovingUp ? '#00FF88' : '#FF4444' }]} />
                      <View style={[styles.speedLine, { backgroundColor: isMovingUp ? '#00FF88' : '#FF4444', opacity: 0.7 }]} />
                      <View style={[styles.speedLine, { backgroundColor: isMovingUp ? '#00FF88' : '#FF4444', opacity: 0.5 }]} />
                    </Animated.View>
                  )}

                  {/* 📊 Ultra-Thin Momentum Bar */}
                  <View style={styles.momentumBarSection}>
                    <View style={styles.momentumTrack}>
                      <Animated.View style={[
                        styles.momentumFill,
                        {
                          width: `${Math.min(100, Math.max(10, (asset.momentum || 0) * 20 + 20))}%`,
                          backgroundColor: 
                            asset.momentum > 3 ? '#FF6B6B' :
                            asset.momentum > 2 ? '#FFD700' :
                            asset.momentum > 1 ? '#00FF88' : 
                            '#555'
                        }
                      ]} />
                      {/* Pulse effect for high momentum */}
                      {asset.momentum > 3 && (
                        <Animated.View style={[
                          styles.momentumPulse,
                          { opacity: sparkleAnim }
                        ]} />
                      )}
                    </View>
                    <View style={styles.momentumLabelContainer}>
                      <Text style={styles.momentumLabel}>
                        {asset.momentum > 3 ? 'EXTREME' :
                         asset.momentum > 2 ? 'HIGH' : 
                         asset.momentum > 1 ? 'MED' : 'LOW'}
                      </Text>
                      {/* 💎 Your Bet Indicator - Centered */}
                      {asset.isUserAsset && (
                        <Animated.View style={[styles.yourBetBadge, { transform: [{ scale: pulseAnim }] }]}>
                          <MaterialCommunityIcons name="diamond" size={10} color="#FFD700" />
                          <Text style={styles.yourBetText}>YOURS</Text>
                        </Animated.View>
                      )}
                    </View>
                  </View>

                  {/* 💰 Price & Pool Info */}
                  <View style={styles.pricePoolRow}>
                    <View style={styles.priceInfo}>
                      <Text style={styles.priceLabel}>Price</Text>
                      <Animated.Text style={[
                        styles.priceValue,
                        isRecentlyUpdated && { transform: [{ scale: priceUpdateFlashAnim }] }
                      ]}>
                        ${asset.currentPrice?.toLocaleString('en-US', { 
                          minimumFractionDigits: asset.symbol === 'BTC' ? 0 : 2, 
                          maximumFractionDigits: asset.symbol === 'BTC' ? 0 : 2 
                        })}
                      </Animated.Text>
                    </View>
                    <View style={styles.poolInfo}>
                      <Text style={styles.poolLabel}>Pool</Text>
                      <Text style={styles.poolValue}>{asset.poolShare?.toFixed(1) || '0.0'}%</Text>
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
                            <Text style={[styles.assetTrendText, { color: '#00FF88' }]}>
                              WINNER
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.trendIndicator, { backgroundColor: 'rgba(255, 68, 68, 0.2)' }]}>
                            <MaterialCommunityIcons name="close" size={12} color="#FF4444" />
                            <Text style={[styles.assetTrendText, { color: '#FF4444' }]}>
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
  headerLiveIndicator: {
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
  headerLiveText: {
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
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  userPositionMainInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  positionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(153, 69, 255, 0.2)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.4)',
    shadowColor: '#9945FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  positionRank: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  userPositionTitleSection: {
    flex: 1,
  },
  userPositionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
    fontFamily: 'Orbitron-Bold',
    marginBottom: 4,
  },
  userPositionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assetSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9945FF',
    fontFamily: 'Orbitron-SemiBold',
  },
  winChanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  winChanceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Orbitron-Regular',
  },
  performanceDisplaySection: {
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
  // Redesigned Bet Summary Section
  betSummarySection: {
    marginTop: 20,
    gap: 16,
  },
  betSummaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  betSummaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  currentValueCard: {
    borderColor: 'rgba(153, 69, 255, 0.3)',
    backgroundColor: 'rgba(153, 69, 255, 0.08)',
  },
  betSummaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
    marginBottom: 8,
  },
  betSummaryValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  betSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  potentialWinCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    alignItems: 'center',
  },
  potentialWinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  potentialWinLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Orbitron-SemiBold',
  },
  potentialWinValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFD700',
    fontFamily: 'Orbitron-ExtraBold',
  },
  
  // Enhanced Profit/Loss Hero Section
  profitLossHeroSection: {
    marginTop: 20,
  },
  profitLossMainCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  profitLossHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  profitLossLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  profitLossValue: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'Orbitron-ExtraBold',
  },
  
  // Race Statistics Grid
  raceStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  raceStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  winningCard: {
    borderColor: 'rgba(0, 255, 136, 0.3)',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  losingCard: {
    borderColor: 'rgba(255, 68, 68, 0.3)',
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
  },
  raceStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
    marginBottom: 6,
  },
  raceStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14F195',
    fontFamily: 'Orbitron-Bold',
    textAlign: 'center',
  },
  trendValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 11,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
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
  oldPriceInfo: {
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
  oldPriceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  oldPriceValue: {
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
  oldMomentumLabel: {
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

  // 🚀 ULTRA-THIN RACING CARDS - New Styles
  ultraThinRaceCard: {
    marginBottom: SPACING.sm,
    marginHorizontal: isTablet ? SPACING.lg : SPACING.md,
    borderRadius: isTablet ? 16 : 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    height: 96, // Increased height to properly show price and pool content
  },
  
  ultraThinGradient: {
    flex: 1,
    borderRadius: isTablet ? 16 : 12,
    overflow: 'hidden',
    position: 'relative',
  },

  // 🏆 Enhanced Compact Position Badge
  compactPositionBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 12,
  },

  positionBadgeGradient: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
  },

  // Enhanced Badge Styles for Different Positions
  goldBadge: {
    borderColor: 'rgba(255, 215, 0, 0.8)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 15,
  },

  silverBadge: {
    borderColor: 'rgba(192, 192, 192, 0.8)',
    shadowColor: '#C0C0C0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 12,
  },

  bronzeBadge: {
    borderColor: 'rgba(205, 127, 50, 0.8)',
    shadowColor: '#CD7F32',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 12,
  },

  regularBadge: {
    borderColor: 'rgba(153, 69, 255, 0.6)',
    shadowColor: '#9945FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },

  positionNumber: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'Orbitron-Black',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  topThreePosition: {
    color: '#1A202C',
    fontSize: 13,
    marginTop: 8,
  },

  // 🔥 Dynamic Effect Indicators
  hotIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 8,
  },

  crashIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    zIndex: 8,
  },

  // Container for momentum label and badge
  momentumLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // 💎 Your Bet Badge
  yourBetBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    marginLeft: 8,
  },

  yourBetText: {
    fontSize: 8,
    color: '#000',
    fontWeight: '800',
    fontFamily: 'Orbitron-Bold',
    marginLeft: 2,
  },

  // ⚡ Main Content Layout
  mainInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    zIndex: 2,
  },

  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  nameSection: {
    flex: 1,
  },

  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },



  assetName: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Orbitron-Regular',
    marginTop: 1,
  },

  performanceSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  performanceText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Orbitron-Bold',
    marginRight: 4,
  },

  // 💨 Speed Lines
  speedLines: {
    position: 'absolute',
    left: 40,
    top: 20,
    zIndex: 1,
  },

  speedLine: {
    height: 1,
    marginVertical: 1,
    borderRadius: 0.5,
  },

  // 📊 Ultra-Thin Momentum Bar
  momentumBarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
    zIndex: 2,
  },

  momentumTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1.5,
    marginRight: 8,
    position: 'relative',
    overflow: 'hidden',
  },

  momentumFill: {
    height: 3,
    borderRadius: 1.5,
    minWidth: '10%',
  },

  // 💰 Price & Pool Row
  pricePoolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 2,
  },

  poolInfo: {
    alignItems: 'flex-end',
  },

  poolLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Orbitron-Regular',
  },

  poolValue: {
    fontSize: 11,
    color: '#FFD700',
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
    marginTop: 1,
  },

  // 🔥 Live Indicator & Effects
  liveIndicator: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginLeft: 4,
  },

  liveText: {
    fontSize: 7,
    color: '#FFFFFF',
    fontWeight: '800',
    fontFamily: 'Orbitron-Bold',
  },

  momentumLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Orbitron-Regular',
    marginLeft: 4,
  },

  momentumPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  priceInfo: {
    alignItems: 'flex-start',
  },

  priceLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Orbitron-Regular',
  },

  priceValue: {
    fontSize: 11,
    color: '#14F195',
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
    marginTop: 1,
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
  assetTrendText: {
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
  originalRaceStatsGrid: {
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