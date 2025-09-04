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
  ActivityIndicator,
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

const isTablet = screenWidth >= 768
const isLandscape = screenWidth > screenHeight

const MIN_TOUCH_TARGET = 44
const ANIMATION_REDUCE_MOTION = false

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
  const playerAddress = account?.publicKey?.toBase58 ? account.publicKey.toBase58() : account?.publicKey?.toString?.()
  const odds = useRaceStore((s) => s.odds)
  const previousOdds = useRaceStore((s) => s.previousOdds)
  const priceUpdates = useRaceStore((s) => s.priceUpdates)
  const isConnected = useRaceStore((s) => s.isConnected)
  const liveRaceData = useRaceStore((s) => s.liveRaceData)
  const userBets = useRaceStore((s) => s.userBets)

  // Stable refs for store actions to avoid effect dependency churn
  const connectWebSocketRef = useRef(useRaceStore.getState().connectWebSocket)
  const subscribeToRaceRef = useRef(useRaceStore.getState().subscribeToRace)
  const forceReconnectWebSocketRef = useRef(useRaceStore.getState().forceReconnectWebSocket)
  const subscribedRaceIdRef = useRef<number | null>(null)

  const raceTrackAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const sparkleAnim = useRef(new Animated.Value(0)).current
  const leaderboardAnim = useRef(new Animated.Value(0)).current
  const oddsChangeAnim = useRef(new Animated.Value(0)).current
  const profitGlowAnim = useRef(new Animated.Value(0)).current
  
  const priceUpdateFlashAnim = useRef(new Animated.Value(0)).current
  const positionShiftAnim = useRef(new Animated.Value(0)).current
  const votingPulseAnim = useRef(new Animated.Value(1)).current
  const intensityPulseAnim = useRef(new Animated.Value(1)).current
  const liveIndicatorAnim = useRef(new Animated.Value(0)).current
  const momentumBarAnim = useRef(new Animated.Value(0)).current
  const rankChangeAnim = useRef(new Animated.Value(0)).current
  // User card upgrades
  const userCardShimmer = useRef(new Animated.Value(0)).current
  const winProbAnim = useRef(new Animated.Value(0)).current
  
  const animationRefs = useRef<Animated.CompositeAnimation[]>([])
  const intervalRefs = useRef<Array<ReturnType<typeof setTimeout>>>([])
  
  const [raceIntensity, setRaceIntensity] = useState<'low' | 'medium' | 'high' | 'extreme'>('medium')
  const [reduceMotion, setReduceMotion] = useState(ANIMATION_REDUCE_MOTION)
  const [recentlyUpdatedAssets, setRecentlyUpdatedAssets] = useState<Set<string>>(new Set())

  const lastHapticTime = useRef(0)
  const previousUserRank = useRef<number | null>(null)
  const previousProfitLoss = useRef<number | null>(null)
  const previousIntensity = useRef<'low' | 'medium' | 'high' | 'extreme'>('medium')

  const [crowdVotes, setCrowdVotes] = useState<Map<string, { upvotes: number, downvotes: number }>>(new Map())
  const [userVotes, setUserVotes] = useState<Map<string, 'up' | 'down' | null>>(new Map())

  const appState = useRef(AppState.currentState)
  const [isAppActive, setIsAppActive] = useState(true)

  const previousPrices = useRef<Map<string, { price: number, timestamp: number }>>(new Map())
  const [lastPriceUpdate, setLastPriceUpdate] = useState(Date.now())

  const priceUpdateAnim = useRef(new Animated.Value(0)).current

  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection' | 'topping' | 'dropping_from_top', context?: string) => {
    const now = Date.now()
    if (now - lastHapticTime.current < 50) return
    
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
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          await new Promise(resolve => setTimeout(resolve, 80))
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          await new Promise(resolve => setTimeout(resolve, 80))
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          break
        case 'dropping_from_top':
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
    }
  }, [])

  const livePrices = useMemo(() => {
    const priceMap = new Map<string, LivePriceData>()
    
    priceUpdates.forEach((priceData: any, symbol: string) => {
      if (priceData && typeof priceData.price === 'number') {
        const currentPrevious = previousPrices.current.get(symbol)
        // Initialize previous price if missing; subsequent updates handled in priceUpdates effect
        if (!currentPrevious) {
          previousPrices.current.set(symbol, { 
            price: priceData.price, 
            timestamp: priceData.timestamp || Date.now() 
          })
        }

        priceMap.set(symbol, {
          price: priceData.price,
          confidence: priceData.confidence || 100,
          changePercent: 0,
        })
      }
    })
    
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

  useEffect(() => {
    setLastPriceUpdate(Date.now())
    
    const updatedAssets = new Set<string>()
    let significantUpdate = false
    
    priceUpdates.forEach((priceData: any, symbol: string) => {
      if (priceData && typeof priceData.price === 'number') {
        const previous = previousPrices.current.get(symbol)
        if (previous && previous.price !== priceData.price) {
          updatedAssets.add(symbol)
          
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
      
      const timeoutId = setTimeout(() => {
        setRecentlyUpdatedAssets(() => new Set())
      }, 1000)
      intervalRefs.current.push(timeoutId)
    }

    // After processing, advance previous prices to current snapshot
    priceUpdates.forEach((priceData: any, symbol: string) => {
      if (priceData && typeof priceData.price === 'number') {
        previousPrices.current.set(symbol, {
          price: priceData.price,
          timestamp: priceData.timestamp || Date.now(),
        })
      }
    })
  }, [priceUpdates])

  const raceProgress = useMemo(() => {
    if (!race) return 0
    const now = Math.floor(Date.now() / 1000)
    const raceStart = race.lockTs
    const raceEnd = race.settleTs
    const totalDuration = raceEnd - raceStart
    const elapsed = now - raceStart
    return Math.max(0, Math.min(1, elapsed / totalDuration))
  }, [race, lastPriceUpdate])

  useEffect(() => {
    if (race?.assets && crowdVotes.size === 0) {
      const initialVotes = new Map()
      const initialUserVotes = new Map()
      race.assets.forEach((asset: any) => {
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

  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        setIsAppActive(true)
        
        if (race?.raceId) {
          forceReconnectWebSocketRef.current().then(() => {
            if (subscribedRaceIdRef.current !== race.raceId) {
              subscribeToRaceRef.current(race.raceId)
              subscribedRaceIdRef.current = race.raceId
            }
            const { wsService } = useRaceStore.getState()
            wsService.subscribeToPrice()
          }).catch((error) => {
            console.error('❌ Failed to reconnect WebSocket:', error)
          })
        }
      } else if (nextAppState.match(/inactive|background/)) {
        setIsAppActive(false)
      }
      
      appState.current = nextAppState
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)
    
    return () => {
      subscription?.remove()
    }
  }, [race?.raceId])

  useEffect(() => {
    if (!race?.raceId || !isAppActive) return

    if (!isConnected) {
      connectWebSocketRef.current()
        .then(() => {
          if (subscribedRaceIdRef.current !== race.raceId) {
            subscribeToRaceRef.current(race.raceId)
            subscribedRaceIdRef.current = race.raceId
          }
          const { wsService } = useRaceStore.getState()
          wsService.subscribeToPrice()
        })
        .catch((error) => {
          console.error('❌ Failed to connect to WebSocket:', error)
        })
    } else {
      if (subscribedRaceIdRef.current !== race.raceId) {
        subscribeToRaceRef.current(race.raceId)
        subscribedRaceIdRef.current = race.raceId
      }
      const { wsService } = useRaceStore.getState()
      wsService.subscribeToPrice()
    }
  }, [race?.raceId, isConnected, isAppActive])

  useEffect(() => {
    const checkReduceMotion = async () => {
      if (Platform.OS === 'ios') {
        const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled()
        setReduceMotion(isReduceMotionEnabled)
      }
    }
    checkReduceMotion()
  }, [])

  // Animate user card shimmer sweep
  useEffect(() => {
    Animated.loop(
      Animated.timing(userCardShimmer, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start()
  }, [])

  // Animate win probability fill when it changes
  useEffect(() => {
    const pct = typeof userPosition?.winProbability === 'number' && !isNaN(userPosition.winProbability)
      ? Math.max(0, Math.min(100, userPosition.winProbability))
      : 0
    Animated.timing(winProbAnim, {
      toValue: pct / 100,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [userPosition?.winProbability])

  useEffect(() => {
    return () => {
      animationRefs.current.forEach(animation => {
        if (animation && typeof animation.stop === 'function') animation.stop()
      })
      intervalRefs.current.forEach(timer => {
        // Clear any pending timers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clearTimeout(timer as any)
        // Also clearInterval in case any intervals were stored here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clearInterval(timer as any)
      })
      animationRefs.current = []
      intervalRefs.current = []
    }
  }, [])

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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} accessibilityLabel="Loading race performance data" />
        <Text style={styles.loadingText}>Loading Race Performance...</Text>
      </View>
    )
  }

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
  
  const assetPerformances = useMemo(() => {
    if (!race?.assets) return []
    
    return race.assets.map((asset: any, index: number) => {
      const livePrice = livePrices.get(asset.symbol)
      const currentPrice = livePrice?.price || asset.currentPrice || asset.startPrice || 100
      
      let performance = 0
      // Prefer live leaderboard; fall back to race payload leaderboard if present
      const backendLeaderboard = (liveRaceData as any)?.leaderboard ?? (race as any)?.leaderboard
      if (backendLeaderboard) {
        const backendAsset = backendLeaderboard.find((item: any) => item.index === index)
        if (backendAsset && typeof backendAsset.performance === 'number') {
          performance = backendAsset.performance
        }
      }
      
      // If backend did not provide performance, compute from known start/current prices
      if (performance === 0 && asset.startPrice && currentPrice) {
        const startPrice = asset.startPrice
        if (typeof startPrice === 'number' && typeof currentPrice === 'number' && startPrice > 0) {
          performance = ((currentPrice - startPrice) / startPrice) * 100
          // Do not clamp to an arbitrary bound; trust computed value
        }
      }
      
      const isUserAsset =
        (userBet && userBet.assetIdx === index) ||
        (userBets && race?.raceId
          ? userBets.some((bet: any) => bet.raceId === race.raceId && bet.assetIdx === index)
          : false)
      
      const totalPool = race.totalPool || 0
      const assetPool = race.assetPools?.[index] || 0
      const poolShare = totalPool > 0 ? (assetPool / totalPool) * 100 : 0
      
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



  const getOddsTrend = useCallback((assetIndex: number) => {
    if (!odds || !previousOdds) return 'stable'
    
    const current = odds[assetIndex]
    const previous = previousOdds[assetIndex]
    if (!current || !previous) return 'stable'
    
    const change = ((current - previous) / previous) * 100
    if (Math.abs(change) < 0.5) return 'stable'
    return change > 0 ? 'increasing' : 'decreasing'
  }, [odds, previousOdds])

  const userPosition = useMemo(() => {
    let currentUserBet = userBet
    if (!currentUserBet && userBets && race?.raceId) {
      currentUserBet = userBets.find((bet: any) => bet.raceId === race.raceId)
    }
    
    if (!currentUserBet) return null

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
    
    const originalAmount = (typeof currentUserBet.amount === 'number' && !isNaN(currentUserBet.amount)) ? currentUserBet.amount / 1_000_000 : 0
    
    const maxPerformance = Math.max(...assetPerformances.map((a: any) => a.performance))
    const isActuallyWinning = Math.abs(userAsset.performance - maxPerformance) < 0.001
    
    let currentBetValue = 0
    let profitLoss = 0
    let potentialPayout = 0
    
    if (isActuallyWinning && race?.totalPool && race?.assetPools) {
      const totalPool = race.totalPool / 1_000_000
      const feeBps = race.feeBps || 500
      const netPool = totalPool * (1 - feeBps / 10000)
      
      let winningPool = 0
      assetPerformances.forEach((asset: any) => {
        if (Math.abs(asset.performance - maxPerformance) < 0.001) {
          winningPool += (race.assetPools[asset.index] || 0) / 1_000_000
        }
      })
      
      if (winningPool > 0) {
        const SCALING_FACTOR = 1_000_000_000_000
        const payoutRatio = (netPool * SCALING_FACTOR) / winningPool
        potentialPayout = (originalAmount * payoutRatio) / SCALING_FACTOR
        
        currentBetValue = potentialPayout
        profitLoss = currentBetValue - originalAmount
      } else {
        // If winningPool is 0, then nobody is actually winning - this is an edge case
        // According to program logic: if no winning pool, you lose everything
        currentBetValue = 0
        profitLoss = -originalAmount
        potentialPayout = 0
      }
    } else {
      // According to program logic: if not winning, you lose everything (100% loss)
      // Only winning assets get payouts, all others lose their entire bet
      currentBetValue = 0
      profitLoss = -originalAmount // Total loss
      potentialPayout = 0
    }
    
    const profitLossPercent = (originalAmount > 0 && typeof profitLoss === 'number' && !isNaN(profitLoss)) ? (profitLoss / originalAmount) * 100 : 0
    
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
        Math.min(99, Math.max(85, 90 + (userAsset.performance - (assetPerformances[1]?.performance || 0)) * 2)) : 
        Math.max(1, Math.min(15, 10 - Math.abs(maxPerformance - userAsset.performance) * 2)),
    }
  }, [userBet, userBets, race?.raceId, assetPerformances, race?.assetPools, race?.totalPool, race?.feeBps])



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
      
      if (newIntensity !== previousIntensity.current) {
        const intensityLevels = { low: 0, medium: 1, high: 2, extreme: 3 }
        const levelChange = intensityLevels[newIntensity] - intensityLevels[previousIntensity.current]
        
        if (levelChange > 0) {
          if (newIntensity === 'extreme') {
            triggerHaptic('heavy', 'race intensity EXTREME')
          } else if (newIntensity === 'high') {
            triggerHaptic('medium', 'race intensity HIGH')
          } else {
            triggerHaptic('light', 'race intensity increased')
          }
        }
        previousIntensity.current = newIntensity
        setRaceIntensity(newIntensity)
      }
    }
  }, [assetPerformances, triggerHaptic])

  useEffect(() => {
    if (userPosition) {
      if (previousUserRank.current !== null && previousUserRank.current !== userPosition.rank) {
        const rankImproved = userPosition.rank < previousUserRank.current
        const previousRank = previousUserRank.current
        const currentRank = userPosition.rank
        
        if (rankImproved) {
          if (currentRank === 1) {
            triggerHaptic('topping', `🏆 REACHED #1! Your asset is now leading the race!`)
          } else {
            triggerHaptic('success', `rank improved to #${currentRank}`)
          }
          
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
          if (previousRank === 1) {
            triggerHaptic('dropping_from_top', `💔 Dropped from #1 to #${currentRank}! Your asset lost the lead!`)
          } else {
            triggerHaptic('error', `rank dropped to #${currentRank}`)
          }
        }
      }
      previousUserRank.current = userPosition.rank
      
      if (previousProfitLoss.current !== null) {
        const profitChange = userPosition.profitLoss - previousProfitLoss.current
        
        if (Math.abs(profitChange) > 10) {
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

  useEffect(() => {
    if (!reduceMotion) {
      const momentumAnimation = Animated.timing(momentumBarAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      })
      animationRefs.current.push(momentumAnimation)
      momentumAnimation.start()
    }
  }, [assetPerformances, reduceMotion])

  const handleVote = (symbol: string, voteType: 'up' | 'down') => {
    const currentUserVote = userVotes.get(symbol)
    
    if (currentUserVote === voteType) {
      triggerHaptic('selection', 'vote removed')
    } else {
      triggerHaptic('light', `voted ${voteType} on ${symbol}`)
    }
    
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
      
      if (currentUserVote === 'up') {
        current.upvotes = Math.max(0, current.upvotes - 1)
      } else if (currentUserVote === 'down') {
        current.downvotes = Math.max(0, current.downvotes - 1)
      }
      
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
      newUserVotes.set(symbol, currentUserVote === voteType ? null : voteType)
      return newUserVotes
    })
  }



  useEffect(() => {
    Animated.timing(leaderboardAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start()
  }, [])

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const fetchAll = async () => {
      if (playerAddress) {
        try {
          await Promise.all([
            useRaceStore.getState().fetchUserBets(playerAddress, false),
            useRaceStore.getState().fetchCurrentRace(false),
          ]);
        } catch (e) {
        }
      }
    };
    fetchAll();
    pollInterval = setInterval(fetchAll, 2000);
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [race?.raceId, playerAddress]);



  return (
    <View style={styles.performanceContainer}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* Live racing header removed per request */}

      {userPosition && (
        <Animated.View 
          style={[
            styles.ultraThinUserPositionCard,
            {
              shadowColor: userPosition.isCurrentlyWinning ? '#00FF88' : '#9945FF',
              shadowOpacity: userPosition.isCurrentlyWinning ? 0.4 : 0.2,
              borderColor: userPosition.isCurrentlyWinning ? 'rgba(0, 255, 136, 0.5)' : 'rgba(153, 69, 255, 0.3)',
              transform: [{
                scale: userPosition.isCurrentlyWinning ? 
                  pulseAnim.interpolate({
                    inputRange: [1, 1.08],
                    outputRange: [1, 1.01],
                  }) : 1
              }],
            }
          ]}
        >
          <LinearGradient
            colors={
              userPosition.isCurrentlyWinning ? 
                ['rgba(0, 255, 136, 0.4)', 'rgba(20, 241, 149, 0.3)', 'rgba(0, 0, 0, 0.95)'] :
                userPosition.profitLoss >= 0 ?
                  ['rgba(153, 69, 255, 0.5)', 'rgba(20, 241, 149, 0.3)', 'rgba(0, 0, 0, 0.95)'] :
                  ['rgba(255, 68, 68, 0.4)', 'rgba(153, 69, 255, 0.3)', 'rgba(0, 0, 0, 0.95)']
            }
            style={styles.ultraThinUserGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Card shimmer sweep */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.userCardShine,
                {
                  transform: [
                    {
                      translateX: userCardShimmer.interpolate({ inputRange: [0, 1], outputRange: [-160, 240] }),
                    },
                    { rotate: '-18deg' },
                  ],
                },
              ]}
            />

            {/* Winning/Trailing ribbon */}
            <View style={[styles.cornerRibbon, userPosition.isCurrentlyWinning ? styles.ribbonWin : styles.ribbonLose]}>
              <Text style={styles.ribbonText}>{userPosition.isCurrentlyWinning ? 'WINNING' : 'TRAILING'}</Text>
            </View>
            {/* Position Badge */}
            <Animated.View style={[
              styles.compactUserPositionBadge,
              userPosition.rank === 1 ? styles.goldBadge :
              userPosition.rank === 2 ? styles.silverBadge :
              userPosition.rank === 3 ? styles.bronzeBadge :
              styles.regularBadge,
              {
                transform: [{
                  scale: userPosition.isCurrentlyWinning ? pulseAnim : 1
                }]
              }
            ]}>
              <LinearGradient
                colors={
                  userPosition.rank === 1 ? ['#FFD700', '#FFA500', '#FF8C00'] : 
                  userPosition.rank === 2 ? ['#E8E8E8', '#C0C0C0', '#A8A8A8'] : 
                  userPosition.rank === 3 ? ['#CD853F', '#CD7F32', '#8B4513'] : 
                  ['rgba(153, 69, 255, 1)', 'rgba(79, 70, 229, 0.8)', 'rgba(67, 56, 202, 0.6)']
                }
                style={styles.positionBadgeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {userPosition.rank === 1 && (
                  <MaterialCommunityIcons 
                    name="crown" 
                    size={12} 
                    color="#1A202C" 
                    style={{ position: 'absolute', top: 1 }}
                  />
                )}
                {userPosition.rank === 2 && (
                  <MaterialCommunityIcons 
                    name="trophy-variant" 
                    size={10} 
                    color="#2D3748" 
                    style={{ position: 'absolute', top: 1 }}
                  />
                )}
                {userPosition.rank === 3 && (
                  <MaterialCommunityIcons 
                    name="medal" 
                    size={10} 
                    color="#2D3748" 
                    style={{ position: 'absolute', top: 1 }}
                  />
                )}
                <Text style={[
                  styles.positionNumber,
                  userPosition.rank <= 3 ? styles.topThreePosition : {}
                ]}>
                  {userPosition.rank}
                </Text>
              </LinearGradient>
            </Animated.View>

            {/* Main Content Row */}
            <View style={styles.ultraThinUserContent}>
              {/* Left: Asset & Position Info */}
              <View style={styles.ultraThinLeftSection}>
                <View style={styles.assetInfoRow}>
                  <Animated.View style={[styles.assetDotRing, { transform: [{ scale: pulseAnim }] }]} />
                  <View style={[styles.assetDotSmall, { backgroundColor: userPosition.asset.color }]} />
                  <Text style={styles.compactAssetSymbol}>{userPosition.asset.symbol}</Text>
                  <MaterialCommunityIcons 
                    name={userPosition.isCurrentlyWinning ? "trophy" : "account-star"} 
                    size={12} 
                    color={userPosition.profitLoss > 0 ? '#00FF88' : '#FF4444'} 
                  />
                </View>
                <Text style={styles.ultraThinPositionText}>Your Position</Text>
              </View>

              {/* Center: Performance */}
              <View style={styles.ultraThinCenterSection}>
                <Animated.Text
                  style={[
                    styles.compactPerformanceValue,
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
                  {userPosition.profitLossPercent >= 0 ? '+' : ''}{(typeof userPosition.profitLossPercent === 'number' && !isNaN(userPosition.profitLossPercent)) ? userPosition.profitLossPercent.toFixed(1) : '0.0'}%
                </Animated.Text>
                <Text style={styles.compactPerformanceLabel}>P&L</Text>
                {/* Win probability micro-bar */}
                <View style={styles.winProbBar}>
                  <Animated.View style={[styles.winProbFill, {
                    width: winProbAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: userPosition.isCurrentlyWinning ? '#00FF88' : '#FFD700',
                  }]} />
                </View>
              </View>

              {/* Right: Bet Values */}
              <View style={styles.ultraThinRightSection}>
                <View style={styles.compactValueRow}>
                  <Text style={styles.compactValueLabel}>Bet:</Text>
                  <Text style={styles.compactValueAmount}>
                    ${(typeof userPosition.originalAmount === 'number' && !isNaN(userPosition.originalAmount)) ? userPosition.originalAmount.toFixed(0) : '0'}
                  </Text>
                </View>
                <View style={styles.compactValueRow}>
                  <Text style={styles.compactValueLabel}>Now:</Text>
                  <Animated.Text
                    style={[
                      styles.compactValueAmount,
                      { 
                        color: userPosition.profitLoss >= 0 ? '#00FF88' : '#FF4444',
                        transform: [{
                          scale: priceUpdateFlashAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.03],
                          }),
                        }],
                      }
                    ]}
                  >
                    ${(typeof userPosition.currentBetValue === 'number' && !isNaN(userPosition.currentBetValue)) ? userPosition.currentBetValue.toFixed(0) : '0'}
                  </Animated.Text>
                </View>
              </View>

              {/* Far Right: Status */}
              <View style={styles.ultraThinStatusSection}>
                <LinearGradient
                  colors={userPosition.isCurrentlyWinning ? ['#00FF88', '#14F195'] : ['#FFD700', '#FFA500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.statusPill}
                >
                  <MaterialCommunityIcons
                    name={userPosition.isCurrentlyWinning ? 'trophy' : 'progress-clock'}
                    size={10}
                    color="#0B0B0B"
                  />
                  <Animated.Text
                    style={[
                      styles.statusPillText,
                      { transform: [{ scale: userPosition.isCurrentlyWinning ? pulseAnim : 1 }] },
                    ]}
                  >
                    {userPosition.isCurrentlyWinning ? 'Winning' : 'Trailing'}
                  </Animated.Text>
                </LinearGradient>
                <Text style={styles.compactWinChance}>
                  {(typeof userPosition.winProbability === 'number' && !isNaN(userPosition.winProbability)) ? userPosition.winProbability.toFixed(0) : '0'}%
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      )}

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
                    <View style={[
                      StyleSheet.absoluteFillObject,
                      {
                        borderRadius: 16,
                        backgroundColor: position < 3 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                        opacity: 0.6,
                      }
                    ]} />
                    
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
                      {asset.isUserAsset && (
                        <Animated.View style={[styles.yourBetBadge, { transform: [{ scale: pulseAnim }] }]}>
                          <MaterialCommunityIcons name="diamond" size={10} color="#FFD700" />
                          <Text style={styles.yourBetText}>YOURS</Text>
                        </Animated.View>
                      )}
                    </View>
                  </View>

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
                let isUserBet = false
                if (userBet && userBet.assetIdx === asset.index) {
                  isUserBet = true
                } else if (userBets && race?.raceId) {
                  const foundBet = userBets.find((bet: any) => bet.raceId === race.raceId && bet.assetIdx === asset.index)
                  isUserBet = !!foundBet
                }
                const maxPerformance = Math.max(...assetPerformances.map((a: any) => a.performance))
                const isWinning = Math.abs(asset.performance - maxPerformance) < 0.001
                
                let payoutMultiplier = 0
                
                if (isWinning && race?.totalPool && race?.assetPools) {
                  const totalPool = race.totalPool / 1_000_000
                  const feeBps = race.feeBps || 500
                  const netPool = totalPool * (1 - feeBps / 10000)
                  
                  let winningPool = 0
                  assetPerformances.forEach((winningAsset: any) => {
                    if (Math.abs(winningAsset.performance - maxPerformance) < 0.001) {
                      winningPool += (race.assetPools[winningAsset.index] || 0) / 1_000_000
                    }
                  })
                  
                  if (winningPool > 0) {
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

      {/* Market Analytics section removed per request */}
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
    paddingTop: SPACING.md,
    paddingBottom: 20,
  },
  
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
    fontFamily: 'Inter-SemiBold',
  },
  raceIntensityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intensityText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'Inter-SemiBold',
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
  
  // Ultra-thin user position card (similar to leaderboard design)
  ultraThinUserPositionCard: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    marginHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
    borderRadius: isTablet ? 16 : 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    height: 76, // Slightly increased for breathing room
  },
  
  ultraThinUserGradient: {
    flex: 1,
    borderRadius: isTablet ? 16 : 12,
    overflow: 'hidden',
    position: 'relative',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  compactUserPositionBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
  },

  ultraThinUserContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 32, // Space for badge
    paddingVertical: 6,
  },

  ultraThinLeftSection: {
    flex: 1,
    minWidth: 0, // Allow text truncation
  },

  assetInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },

  compactAssetSymbol: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Sora-Bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  ultraThinPositionText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Regular',
  },

  ultraThinCenterSection: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  compactPerformanceValue: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Sora-ExtraBold',
    textAlign: 'center',
  },

  compactPerformanceLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },

  ultraThinRightSection: {
    alignItems: 'flex-end',
    minWidth: 60,
  },

  compactValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 1,
  },

  compactValueLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Regular',
  },

  compactValueAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },

  ultraThinStatusSection: {
    alignItems: 'center',
    minWidth: 40,
  },

  compactStatusText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Sora-ExtraBold',
    textAlign: 'center',
  },

  compactWinChance: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },

  assetDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 2,
  },

  // Shared styles for asset symbol (used in leaderboard)
  assetSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
    fontFamily: 'Inter-Regular',
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
    fontFamily: 'Inter-SemiBold',
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
    fontFamily: 'Inter-SemiBold',
  },
  potentialWinValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFD700',
    fontFamily: 'Sora-ExtraBold',
    letterSpacing: 0.2,
  },
  
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
    fontFamily: 'Sora-Bold',
  },
  profitLossValue: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'Sora-ExtraBold',
    letterSpacing: 0.4,
  },
  
  raceStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 8,
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
    fontFamily: 'Inter-Regular',
    marginBottom: 6,
  },
  raceStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14F195',
    fontFamily: 'Inter-SemiBold',
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
    fontFamily: 'Sora-Bold',
    letterSpacing: 0.3,
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
    fontFamily: 'Inter-SemiBold',
  },
  
  assetLeaderboard: {
    gap: 12,
  },
     assetRaceCard: {
     borderRadius: 16,
     overflow: 'hidden',
     borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.1)',
     marginBottom: 12,
     position: 'relative',
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
    fontFamily: 'Sora-ExtraBold',
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
    marginRight: 40,
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
    fontFamily: 'Sora-Bold',
    letterSpacing: 0.3,
  },
  assetRaceName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
  },
  assetRaceStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetRacePerformance: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
    fontFamily: 'Inter-SemiBold',
  },
  
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
    fontFamily: 'Inter-Regular',
  },
  oldPriceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  
   momentumSection: {
     marginTop: 8,
     marginBottom: 8,
   },
  oldMomentumLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
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
    fontFamily: 'Inter-SemiBold',
    minWidth: 40,
  },
  
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
    fontFamily: 'Inter-Regular',
  },
  poolShareValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#14F195',
    fontFamily: 'Inter-SemiBold',
  },
  
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
    fontFamily: 'Inter-SemiBold',
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
    fontFamily: 'Inter-SemiBold',
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
     fontFamily: 'Inter-SemiBold',
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
    fontFamily: 'Inter-SemiBold',
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
    fontFamily: 'Inter-SemiBold',
  },

  ultraThinRaceCard: {
    marginBottom: SPACING.sm,
    marginHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
    borderRadius: isTablet ? 16 : 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    height: 96,
  },
  
  ultraThinGradient: {
    flex: 1,
    borderRadius: isTablet ? 16 : 12,
    overflow: 'hidden',
    position: 'relative',
  },

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
    fontFamily: 'Sora-ExtraBold',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  topThreePosition: {
    color: '#1A202C',
    fontSize: 13,
    marginTop: 8,
  },

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

  momentumLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

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
    fontFamily: 'Inter-SemiBold',
    marginLeft: 2,
  },

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
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: 'Inter-Regular',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  performanceSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  performanceText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Inter-SemiBold',
    marginRight: 4,
  },

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
    fontFamily: 'Inter-Regular',
  },

  poolValue: {
    fontSize: 11,
    color: '#FFD700',
    fontWeight: '700',
    fontFamily: 'Inter-SemiBold',
    marginTop: 1,
  },

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
    fontFamily: 'Inter-SemiBold',
  },

  momentumLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Inter-Regular',
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
    fontFamily: 'Inter-Regular',
  },

  priceValue: {
    fontSize: 11,
    color: '#14F195',
    fontWeight: '700',
    fontFamily: 'Inter-SemiBold',
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
    fontFamily: 'Inter-Regular',
  },
  marketStatValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#14F195',
    fontFamily: 'Inter-SemiBold',
  },
  
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
    fontFamily: 'Sora-Bold',
  },
  oddsSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
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
    fontFamily: 'Sora-Bold',
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
    fontFamily: 'Inter-SemiBold',
  },
  oddsValueSection: {
    alignItems: 'center',
  },
  oddsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Sora-ExtraBold',
    letterSpacing: 0.2,
  },
  poolShareOdds: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
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
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Inter-SemiBold',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  
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
    fontFamily: 'Inter-Regular',
  },
  poolSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD700',
    fontFamily: 'Inter-SemiBold',
  },
  
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
    fontFamily: 'Sora-Bold',
  },
  noBetDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  noBetStats: {
    alignItems: 'center',
    gap: 8,
  },
  noBetStatsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter-SemiBold',
    marginLeft: 4,
  },
  noBetStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

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
    fontFamily: 'Sora-Bold',
  },
  errorMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
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
    fontFamily: 'Inter-SemiBold',
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
    fontFamily: 'Sora-Bold',
  },
  emptyMessage: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
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
    fontFamily: 'Inter-SemiBold',
  },

  crowdSentimentLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
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
    fontFamily: 'Inter-SemiBold',
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
    fontFamily: 'Inter-SemiBold',
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
