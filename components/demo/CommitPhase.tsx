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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  View,
} from 'react-native'

import { MaterialCommunityIcons } from '@expo/vector-icons'
import { PoolDonut } from '@/components/ui/PoolDonut'
import SolanaLogo from '@/components/ui/SolanaLogo'
import { PublicKey } from '@solana/web3.js'

import { useRaceStore } from '../../store/useRaceStore'
import {
  useCanPlaceBet,
  usePlaceBet,
} from './use-place-bet'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

const isTablet = screenWidth >= 768
const isLandscape = screenWidth > screenHeight

const MIN_TOUCH_TARGET = 44
const MAX_BET = 1000

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
  secondary: '#14F195',
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255,255,255,0.8)',
    tertiary: 'rgba(255,255,255,0.6)',
  },
  accent: {
    purple: '#9945FF',
    green: '#14F195',
    gold: '#FFD700',
    orange: '#FFA500',
  },
} as const

const TYPOGRAPHY = {
  display: { fontSize: isTablet ? 32 : 28, lineHeight: isTablet ? 40 : 36 },
  title: { fontSize: isTablet ? 24 : 20, lineHeight: isTablet ? 32 : 28 },
  subtitle: { fontSize: isTablet ? 18 : 16, lineHeight: isTablet ? 26 : 24 },
  body: { fontSize: isTablet ? 16 : 14, lineHeight: isTablet ? 24 : 20 },
  caption: { fontSize: isTablet ? 14 : 12, lineHeight: isTablet ? 20 : 18 },
  small: { fontSize: isTablet ? 12 : 10, lineHeight: isTablet ? 18 : 16 },
} as const

const calculatePotentialPayout = (
  betAmount: string,
  race: any,
  selectedAssetIdx: number,
  existingUserMicro?: number | null,
): {
  totalPayout: number; // USDC
  profit: number; // USDC
  yourSharePct: number; // 0..100
  fieldCut: number; // USDC
  netPool: number; // USDC
  feePct: number; // 0..100
  winnerPool: number; // USDC
  note: string;
} => {
  const amountUsd = parseFloat(betAmount || '0')
  if (!isFinite(amountUsd) || amountUsd <= 0) {
    return { totalPayout: 0, profit: 0, yourSharePct: 0, fieldCut: 0, netPool: 0, feePct: (race?.feeBps||0)/100, note: 'Enter bet amount' }
  }

  const pools = race?.assetPools as number[] | undefined
  const totalMicro = Number(race?.totalPool || 0)
  const feeBps = Number(race?.feeBps || 500)
  if (!pools || selectedAssetIdx < 0 || selectedAssetIdx >= pools.length || totalMicro <= 0) {
    return { totalPayout: 0, profit: 0, yourSharePct: 0, fieldCut: 0, netPool: 0, feePct: feeBps/100, note: 'Waiting for pools…' }
  }

  const addMicro = Math.floor(amountUsd * 1_000_000)
  const winnerMicro0 = Number(pools[selectedAssetIdx] || 0)
  const otherMicro0 = Math.max(0, totalMicro - winnerMicro0)
  const userExisting = Math.max(0, Number(existingUserMicro || 0))

  const newWinnerMicro = winnerMicro0 + addMicro
  const newTotalMicro = totalMicro + addMicro
  if (newWinnerMicro <= 0 || newTotalMicro <= 0) {
    return { totalPayout: 0, profit: 0, yourSharePct: 0, fieldCut: 0, netPool: 0, feePct: feeBps/100, note: 'Enter bet amount' }
  }

  const feeMicro = Math.floor((newTotalMicro * feeBps) / 10_000)
  const netMicro = Math.max(0, newTotalMicro - feeMicro)

  const yourMicro = userExisting + addMicro
  const yourShare = yourMicro / Math.max(1, newWinnerMicro)
  const payoutMicro = Math.floor(yourShare * netMicro)
  const fieldCutMicro = Math.floor(yourShare * otherMicro0)

  const toUsd = (m: number) => m / 1_000_000
  const totalPayout = toUsd(payoutMicro)
  const profit = Math.max(0, totalPayout - amountUsd)
  const yourSharePct = Math.max(0, Math.min(100, yourShare * 100))
  const fieldCut = toUsd(fieldCutMicro)
  const netPool = toUsd(netMicro)
  const winnerPool = toUsd(newWinnerMicro)
  const feePct = feeBps / 100
  const note = yourSharePct >= 50 ? 'Leading pool — good odds' : yourSharePct >= 30 ? 'Competitive pool' : 'Underdog pick — high risk'

  return { totalPayout, profit, yourSharePct, fieldCut, netPool, feePct, winnerPool, note }
}

interface CommitPhaseProps {
  selectedAssetIdx: number
  setSelectedAssetIdx: (index: number) => void
  betAmount: string
  setBetAmount: (amount: string) => void
  account: any
}

export const EnhancedCommitPhase = memo(_EnhancedCommitPhase)

function _EnhancedCommitPhase({
  selectedAssetIdx,
  setSelectedAssetIdx,
  betAmount,
  setBetAmount,
  account,
}: CommitPhaseProps) {
  const [showBetConfirmation, setShowBetConfirmation] = React.useState(false)
  const confirmationAnim = React.useRef(new Animated.Value(0)).current
  const cancelRef = React.useRef<any>(null)
  const confirmRef = React.useRef<any>(null)

  const race = useRaceStore((s) => s.race)
  const userBets = useRaceStore((s) => s.userBets)
  const isLoading = useRaceStore((s) => s.isLoading)
  const error = useRaceStore((s) => s.error)
  const fetchCommitPhaseData = useRaceStore((s) => s.fetchCommitPhaseData)
  const fetchUserBets = useRaceStore((s) => s.fetchUserBets)
  const priceUpdates = useRaceStore((s) => s.priceUpdates)
  const liveRaceData = useRaceStore((s) => s.liveRaceData)
  const connectWebSocket = useRaceStore((s) => s.connectWebSocket)
  const subscribeToRace = useRaceStore((s) => s.subscribeToRace)
  const isConnected = useRaceStore((s) => s.isConnected)
  const forceReconnectWebSocket = useRaceStore((s) => s.forceReconnectWebSocket)
  const playerAddress = account?.publicKey?.toBase58 ? account.publicKey.toBase58() : account?.publicKey?.toString?.()

  const placeBetMutation = usePlaceBet()
  const isPlacingBet = placeBetMutation.isPending

  const [step, setStep] = useState<'welcome' | 'select' | 'bet' | 'confirm'>('welcome')
  const [showTips, setShowTips] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [userBalance, setUserBalance] = useState<number | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  const [showIncreaseBet, setShowIncreaseBet] = useState(false)
  const [additionalBetAmount, setAdditionalBetAmount] = useState('')

  const lastHapticTime = useRef(0)
  const selectedAssetIdx_prev = useRef(-1)

  const glowAnim = useRef(new Animated.Value(0)).current
  const shakeAnim = useRef(new Animated.Value(0)).current
  const fadeInAnim = useRef(new Animated.Value(0)).current
  const slideInAnim = useRef(new Animated.Value(50)).current

  const assetSelectionPulseAnim = useRef(new Animated.Value(1)).current
  const betInputFocusAnim = useRef(new Animated.Value(0)).current
  const quickAmountScaleAnim = useRef(new Animated.Value(1)).current
  const successCelebrationAnim = useRef(new Animated.Value(0)).current
  const balanceRefreshAnim = useRef(new Animated.Value(0)).current
  const increaseBetExpandAnim = useRef(new Animated.Value(0)).current
  const placeBetPulseAnim = useRef(new Animated.Value(1)).current
  const previewSlideAnim = useRef(new Animated.Value(0)).current
  const assetsCollapseAnim = useRef(new Animated.Value(1)).current
  const [assetsOpen, setAssetsOpen] = useState(true)
  const chevronRotate = assetsCollapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '0deg'],
  })
  const headerPressScale = useRef(new Animated.Value(1)).current

  const commitAnimationRefs = useRef<Animated.CompositeAnimation[]>([])

  const appState = useRef(AppState.currentState)
  const [isAppActive, setIsAppActive] = useState(true)

  const userBet = useMemo(() => {
    if (!userBets || !race?.raceId) return undefined
    return userBets.find((bet) => bet.raceId === race.raceId)
  }, [userBets, race?.raceId])

  const payout = useMemo(
    () => calculatePotentialPayout(betAmount, race, selectedAssetIdx, userBet?.amount ?? null),
    [betAmount, race?.totalPool, race?.assetPools, race?.feeBps, selectedAssetIdx, userBet?.amount],
  )

  const handleChangeAdditional = useCallback(
    (text: string) => {
      const digitsOnly = text.replace(/[^0-9.]/g, '')
      const firstDot = digitsOnly.indexOf('.')
      let sanitized = firstDot >= 0
        ? digitsOnly.slice(0, firstDot + 1) + digitsOnly.slice(firstDot + 1).replace(/\./g, '')
        : digitsOnly
      if (sanitized.includes('.')) {
        const [intPart, decPart] = sanitized.split('.')
        sanitized = intPart + '.' + decPart.slice(0, 2)
      }
      if (sanitized.startsWith('00')) {
        sanitized = '0'
      }
      if (sanitized === '.') sanitized = '0.'
      setAdditionalBetAmount(sanitized)
    },
    [],
  )

  const toggleAssetsOpen = useCallback(() => {
    const next = !assetsOpen
    setAssetsOpen(next)
    Animated.timing(assetsCollapseAnim, {
      toValue: next ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start()
    triggerHaptic('selection', next ? 'expand racers' : 'collapse racers')
  }, [assetsOpen, assetsCollapseAnim, triggerHaptic])

  const handleChangeAmount = useCallback(
    (text: string) => {
      // Sanitize: allow only digits and one decimal point, limit to 2 decimals
      const digitsOnly = text.replace(/[^0-9.]/g, '')
      const firstDot = digitsOnly.indexOf('.')
      let sanitized = firstDot >= 0
        ? digitsOnly.slice(0, firstDot + 1) + digitsOnly.slice(firstDot + 1).replace(/\./g, '')
        : digitsOnly
      // Limit decimals to 2
      if (sanitized.includes('.')) {
        const [intPart, decPart] = sanitized.split('.')
        sanitized = intPart + '.' + decPart.slice(0, 2)
      }
      // Prevent leading zeros like 00 -> 0
      if (sanitized.startsWith('00')) {
        sanitized = '0'
      }
      // If user types just '.', make it '0.'
      if (sanitized === '.') sanitized = '0.'
      setBetAmount(sanitized)
    },
    [setBetAmount],
  )

  const { canPlaceBet, validationMessage, validationErrors } = useCanPlaceBet({
    userBalance,
    betAmount,
    selectedAssetIdx,
    race,
    userBet,
  })

  const triggerHaptic = useCallback(
    async (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection', context?: string) => {
      const now = Date.now()
      if (now - lastHapticTime.current < 100) return
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
          console.log(`🎮 Commit Haptic: ${type} (${context})`)
        }
      } catch (error) {}
    },
    [],
  )

  React.useEffect(() => {
    if (showBetConfirmation) {
      Animated.timing(confirmationAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        if (confirmRef.current && typeof (confirmRef.current as any).focus === 'function') {
          setTimeout(
            () => confirmRef.current && (confirmRef.current as any).focus && (confirmRef.current as any).focus(),
            100,
          )
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      })
    } else {
      Animated.timing(confirmationAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start()
    }
  }, [showBetConfirmation])

  useEffect(() => {
    const checkReduceMotion = async () => {
      if (Platform.OS === 'ios') {
        const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled()
        setReduceMotion(isReduceMotionEnabled)
      }
    }
    checkReduceMotion()
  }, [])

  useEffect(() => {
    if (userBet && !reduceMotion) {
      triggerHaptic('success', 'bet placed successfully')

      const celebrationAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(successCelebrationAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(successCelebrationAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 },
      )

      commitAnimationRefs.current.push(celebrationAnimation)
      celebrationAnimation.start()
    }
  }, [userBet, reduceMotion, triggerHaptic])

  useEffect(() => {
    if (betAmount && !isNaN(parseFloat(betAmount)) && parseFloat(betAmount) >= 0.1) {
      Animated.timing(previewSlideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(previewSlideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [betAmount])

  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      console.log('📱 App state change in commit phase:', appState.current, '->', nextAppState)

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔄 App returned to foreground, checking WebSocket connection...')
        setIsAppActive(true)

        if (race?.raceId) {
          forceReconnectWebSocket()
            .then(() => {
              subscribeToRace(race.raceId)
              const { wsService } = useRaceStore.getState()
              wsService.subscribeToPrice()
              console.log('✅ WebSocket reconnected after app returned to foreground in commit phase')
            })
            .catch((error) => {
              console.error('❌ Failed to reconnect WebSocket in commit phase:', error)
            })
        }
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('📱 App going to background from commit phase')
        setIsAppActive(false)
      }

      appState.current = nextAppState
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      subscription?.remove()
    }
  }, [race?.raceId, forceReconnectWebSocket, subscribeToRace])

  useEffect(() => {
    if (playerAddress) {
      fetchCommitPhaseData(undefined, playerAddress, true)
    } else {
      fetchCommitPhaseData(undefined, undefined, true)
    }
  }, [playerAddress, fetchCommitPhaseData])

  useEffect(() => {
    if (!race?.raceId || !isAppActive) return
    if (!isConnected) {
      connectWebSocket()
        .then(() => {
          subscribeToRace(race.raceId)
          const { wsService } = useRaceStore.getState()
          wsService.subscribeToPrice()
          console.log('✅ WebSocket connected for commit phase')
        })
        .catch((error) => {
          console.error('❌ Failed to connect to WebSocket:', error)
        })
    } else {
      subscribeToRace(race.raceId)
      const { wsService } = useRaceStore.getState()
      wsService.subscribeToPrice()
    }
  }, [race?.raceId, isConnected, connectWebSocket, subscribeToRace, isAppActive])

  useEffect(() => {
    if (playerAddress && userBalance === null && !isLoadingBalance) {
      setIsLoadingBalance(true)

      const { apiService } = useRaceStore.getState()
      apiService
        .getUserBalance(playerAddress)
        .then((response) => {
          if (response.success && response.data) {
            setUserBalance(response.data.usdcBalance)
            console.log(`💰 User USDC balance: ${response.data.usdcBalance}`)
          } else {
            console.warn('Failed to fetch user balance:', response.error)
            setUserBalance(100)
          }
        })
        .catch((error: any) => {
          console.error('Failed to fetch user balance:', error)
          setUserBalance(100)
        })
        .finally(() => {
          setIsLoadingBalance(false)
        })
    }
  }, [playerAddress, userBalance, isLoadingBalance])

  useEffect(() => {
    if (userBet) {
      setStep('confirm')
    } else if (!account) {
      setStep('welcome')
    } else if (selectedAssetIdx >= 0 && betAmount) {
      setStep('bet')
    } else {
      setStep('select')
    }
  }, [userBet, account, selectedAssetIdx, betAmount])

  useEffect(() => {
    if (reduceMotion) return

    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    )

    commitAnimationRefs.current.push(glowAnimation)
    glowAnimation.start()

    return () => {
      glowAnimation.stop()
    }
  }, [reduceMotion])

  useEffect(() => {
    return () => {
      commitAnimationRefs.current.forEach((animation) => {
        animation.stop()
        animation.reset()
      })
    }
  }, [reduceMotion])

  const derivedUserBet = useMemo(() => {
    if (userBet) return userBet
    if (userBets && race?.raceId) {
      return userBets.find((bet: any) => bet.raceId === race.raceId)
    }
    return undefined
  }, [userBet, userBets, race?.raceId])

  const triggerShake = useCallback(() => {
    triggerHaptic('error', 'validation error')

    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start()
  }, [triggerHaptic])

  const refreshUserBalance = async () => {
    if (!account?.publicKey) return

    triggerHaptic('light', 'balance refresh')

    Animated.sequence([
      Animated.timing(balanceRefreshAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(balanceRefreshAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()

    setIsLoadingBalance(true)
    try {
      const { apiService } = useRaceStore.getState()
      const response = await apiService.getUserBalance(account.publicKey.toBase58())

      if (response.success && response.data) {
        setUserBalance(response.data.usdcBalance)
        triggerHaptic('selection', 'balance loaded')
        console.log(`💰 Refreshed user USDC balance: ${response.data.usdcBalance}`)
      } else {
        triggerHaptic('error', 'balance refresh failed')
        console.warn('Failed to refresh user balance:', response.error)
      }
    } catch (error) {
      triggerHaptic('error', 'balance refresh error')
      console.error('Failed to refresh user balance:', error)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const livePrices = useMemo(() => {
    const priceMap = new Map<string, { price: number; confidence: number; changePercent: number }>()

    priceUpdates.forEach((priceData: any, symbol: string) => {
      if (priceData && typeof priceData.price === 'number') {
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

  const enhancedAssets = useMemo(() => {
    if (!race?.assets) return []

    return race.assets.map((asset: any, index: number) => {
      const livePrice = livePrices.get(asset.symbol)
      const currentPrice = livePrice?.price || asset.currentPrice || asset.startPrice || 100

      let performance = 0
      const backendLeaderboard = (liveRaceData as any)?.leaderboard ?? (race as any)?.leaderboard
      if (backendLeaderboard) {
        const backendAsset = backendLeaderboard.find((item: any) => item.index === index)
        if (backendAsset && typeof backendAsset.performance === 'number') {
          performance = backendAsset.performance
        }
      }

      if (performance === 0 && asset.startPrice && currentPrice) {
        const startPrice = asset.startPrice
        if (typeof startPrice === 'number' && typeof currentPrice === 'number' && startPrice > 0) {
          performance = ((currentPrice - startPrice) / startPrice) * 100
        }
      }

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
      const velocity =
        performance > 2
          ? 'hot'
          : performance > 0.5
            ? 'up'
            : performance < -2
              ? 'crash'
              : performance < -0.5
                ? 'down'
                : 'stable'

      return {
        ...asset,
        index,
        performance,
        currentPrice,
        startPrice: asset.startPrice || 100,
        poolShare,
        momentum,
        velocity,
        priceChange,
        confidence: livePrice?.confidence || 0,
        hasLivePrice: livePrices.has(asset.symbol),
      }
    })
  }, [race?.assets, livePrices, liveRaceData?.leaderboard])

  const handleAssetSelection = useCallback(
    (index: number) => {
      if (selectedAssetIdx !== index) {
        triggerHaptic('medium', `selected ${enhancedAssets[index]?.symbol}`)

        Animated.sequence([
          Animated.timing(assetSelectionPulseAnim, {
            toValue: 1.05,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.spring(assetSelectionPulseAnim, {
            toValue: 1,
            tension: 150,
            friction: 3,
            useNativeDriver: true,
          }),
        ]).start()
        setSelectedAssetIdx(index)
        selectedAssetIdx_prev.current = selectedAssetIdx
      }
    },
    [selectedAssetIdx, triggerHaptic, enhancedAssets, setSelectedAssetIdx],
  )

  const handleQuickAmountSelection = useCallback(
    (amount: number) => {
      triggerHaptic('light', `quick amount ${amount}`)

      Animated.sequence([
        Animated.timing(quickAmountScaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(quickAmountScaleAnim, {
          toValue: 1,
          tension: 150,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start()

      // Clamp to available balance and max bet
      const allowedMax = Math.min(userBalance ?? MAX_BET, MAX_BET)
      const finalAmount = Math.max(0.1, Math.min(amount, allowedMax))
      setBetAmount(finalAmount.toFixed(2))
    },
    [triggerHaptic, userBalance],
  )

  const handleMaxBetAmount = useCallback(() => {
    const maxAmount = userBalance !== null ? Math.min(userBalance, MAX_BET).toFixed(2) : '100.00'
    triggerHaptic('selection', 'max bet amount')

    setBetAmount(maxAmount)
  }, [userBalance, triggerHaptic])

  const handleQuickPercentSelection = useCallback(
    (percent: number) => {
      // Only allow if we know balance; otherwise ignore
      if (userBalance === null || isNaN(userBalance)) return
      triggerHaptic('light', `quick percent ${Math.round(percent * 100)}%`)

      Animated.sequence([
        Animated.timing(quickAmountScaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(quickAmountScaleAnim, {
          toValue: 1,
          tension: 150,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start()

      const allowedMax = Math.min(userBalance ?? MAX_BET, MAX_BET)
      const target = Math.max(0.1, Math.min(allowedMax, (userBalance || 0) * percent))
      setBetAmount(target.toFixed(2))
    },
    [userBalance, quickAmountScaleAnim, triggerHaptic],
  )

  const handleBetInputFocus = useCallback(() => {
    triggerHaptic('light', 'bet input focus')

    Animated.timing(betInputFocusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [triggerHaptic])

  const handleBetInputBlur = useCallback(() => {
    Animated.timing(betInputFocusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }, [])

  const handleToggleIncreaseBet = useCallback(() => {
    const newState = !showIncreaseBet
    triggerHaptic('selection', newState ? 'expand increase bet' : 'collapse increase bet')

    Animated.timing(increaseBetExpandAnim, {
      toValue: newState ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start()

    setShowIncreaseBet(newState)
    if (!newState) {
      setAdditionalBetAmount('')
    }
  }, [showIncreaseBet, triggerHaptic])

  const formatValue = (microUsdc: number) => {
    const usdc = microUsdc / 1_000_000
    if (usdc >= 1_000_000) return `$${(usdc / 1_000_000).toFixed(2)}M`
    if (usdc >= 1_000) return `$${(usdc / 1_000).toFixed(1)}K`
    return `$${usdc.toFixed(0)}`
  }

  const handlePlaceBet = () => {
    if (!account?.publicKey || !race?.raceId || !canPlaceBet) {
      triggerHaptic('error', 'cannot place bet')
      triggerShake()
      return
    }

    triggerHaptic('heavy', 'placing bet')

    Animated.sequence([
      Animated.timing(placeBetPulseAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(placeBetPulseAnim, {
        toValue: 1,
        tension: 150,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start()

    const amount = parseFloat(betAmount)
    placeBetMutation.mutate({
      raceId: race.raceId,
      assetIdx: selectedAssetIdx,
      amount,
      playerAddress: new PublicKey(account.publicKey.toString()),
    })
  }

  const confirmBet = async () => {
    setShowBetConfirmation(false)
    handlePlaceBet()

    setTimeout(() => {
      refreshUserBalance()
    }, 3000)
  }

  useEffect(() => {
    if (placeBetMutation.isSuccess && playerAddress) {
      fetchUserBets(playerAddress, false)
      console.log('✅ Refreshing user bets after successful bet placement')
    }
  }, [placeBetMutation.isSuccess, playerAddress, fetchUserBets])

  // Load user balance once when address is available
  useEffect(() => {
    if (!playerAddress || userBalance !== null || isLoadingBalance) return
    setIsLoadingBalance(true)
    const { apiService } = useRaceStore.getState()
    apiService
      .getUserBalance(playerAddress)
      .then((response) => {
        if (response.success && response.data) {
          setUserBalance(response.data.usdcBalance)
          console.log(`💰 User USDC balance: ${response.data.usdcBalance}`)
        } else {
          console.warn('Failed to fetch user balance:', response.error)
          setUserBalance(100)
        }
      })
      .catch((error: any) => {
        console.error('Failed to fetch user balance:', error)
        setUserBalance(100)
      })
      .finally(() => setIsLoadingBalance(false))
  }, [playerAddress, userBalance, isLoadingBalance])

  useEffect(() => {
    if (userBet) {
      setStep('confirm')
    } else if (!account) {
      setStep('welcome')
    } else if (selectedAssetIdx >= 0 && betAmount) {
      setStep('bet')
    } else {
      setStep('select')
    }
  }, [userBet, account, selectedAssetIdx, betAmount])

  useEffect(() => {
    if (reduceMotion) return

    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    )

    commitAnimationRefs.current.push(glowAnimation)
    glowAnimation.start()

    return () => {
      glowAnimation.stop()
    }
  }, [reduceMotion])

  const handleBetAttempt = () => {
    if (!canPlaceBet) {
      triggerShake()
      return
    }
    triggerHaptic('selection', 'bet confirmation shown')
    setShowBetConfirmation(true)
  }

  if (error) {
    return (
      <View style={styles.errorContainerCommit}>
        <MaterialCommunityIcons name="alert-circle" size={48} color={COLORS.error} accessibilityLabel="Error icon" />
        <Text style={styles.errorTitleCommit}>Unable to Load Race Data</Text>
        <Text style={styles.errorMessageCommit}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { minHeight: MIN_TOUCH_TARGET }]}
          onPress={() => {
            if (account?.publicKey) {
              fetchCommitPhaseData(undefined, account.publicKey.toBase58(), false)
            } else {
              fetchCommitPhaseData(undefined, undefined, false)
            }
          }}
          accessibilityLabel="Retry loading race data"
          accessibilityRole="button"
          accessibilityHint="Attempts to reload the race information"
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainerCommit}>
        <MaterialCommunityIcons
          name="loading"
          size={48}
          color={COLORS.primary}
          accessibilityLabel="Loading race data"
        />
        <Text style={styles.loadingTextCommit}>Loading Race...</Text>
        <View style={styles.loadingProgressContainer}>
          <Text style={styles.loadingProgressText}>Preparing betting interface...</Text>
        </View>
      </View>
    )
  }

  if (!race) {
    return (
      <View style={styles.loadingContainerCommit}>
        <MaterialCommunityIcons
          name="loading"
          size={48}
          color={COLORS.primary}
          accessibilityLabel="Loading race data"
        />
        <Text style={styles.loadingTextCommit}>Loading Race...</Text>
        <View style={styles.loadingProgressContainer}>
          <Text style={styles.loadingProgressText}>Fetching race information...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.phaseContent}>
      {step === 'welcome' && !account && (
        <View style={styles.welcomeSection}>
          <LinearGradient colors={['rgba(153, 69, 255, 0.2)', 'rgba(20, 241, 149, 0.1)']} style={styles.welcomeCard}>
            <View style={styles.welcomeHeader}>
              <MaterialCommunityIcons name="rocket-launch" size={32} color="#9945FF" />
              <View style={styles.welcomeTitleContainer}>
                <MaterialCommunityIcons name="flag-checkered" size={20} color="#9945FF" />
                <Text style={styles.welcomeTitle}>Ready to Race?</Text>
              </View>
            </View>

            <Text style={styles.welcomeDescription}>
              Predict which crypto will have the highest momentum in the next 3 minutes and win USDC!
            </Text>

            <View style={styles.howItWorksSteps}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>Connect your Solana wallet</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>Pick the crypto you think will pump</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>Place your bet and watch the race!</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.connectWalletMainButton, { minHeight: MIN_TOUCH_TARGET }]}
              accessibilityLabel="Connect your Solana wallet to start racing"
              accessibilityRole="button"
              accessibilityHint="Opens wallet connection dialog to link your Solana wallet for betting"
            >
              <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.connectWalletMainGradient}>
                <MaterialCommunityIcons name="wallet-plus" size={20} color="#000" />
                <Text style={styles.connectWalletMainText}>Connect Wallet to Start</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.learnMoreButton, { minHeight: MIN_TOUCH_TARGET, paddingVertical: SPACING.sm }]}
              onPress={() => setShowTips(true)}
              accessibilityLabel="Learn more about momentum madness"
              accessibilityRole="button"
              accessibilityHint="Opens help information about how momentum madness works"
            >
              <Text style={styles.learnMoreText}>Learn More About Racing</Text>
              <MaterialCommunityIcons name="help-circle-outline" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {userBet && race && (
        <View style={styles.successSection}>
          <LinearGradient
            colors={['rgba(10,10,10,0.9)', 'rgba(0,0,0,0.75)', 'rgba(10,10,10,0.9)']}
            style={styles.successCard}
          >
            {/* subtle shimmer */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.successShine,
                {
                  transform: [
                    {
                      translateX: successCelebrationAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-200, 240],
                      }),
                    },
                    { rotate: '-18deg' },
                  ],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.successIconContainer,
                {
                  transform: [
                    {
                      scale: successCelebrationAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.1],
                      }),
                    },
                  ],
                  shadowOpacity: successCelebrationAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.8],
                  }),
                },
              ]}
            >
              <LinearGradient colors={['#F2C94C', '#DFA944']} style={styles.successIconGradient}>
                <MaterialCommunityIcons name="trophy" size={28} color="#0B0B0B" />
              </LinearGradient>
            </Animated.View>

            <View style={styles.successTitleContainer}>
              <MaterialCommunityIcons name="target" size={20} color="#F2C94C" />
              <Text style={styles.successTitle}>You're In The Race!</Text>
            </View>
            <View style={styles.successBadgesRow}>
              {race.assets[userBet.assetIdx]?.symbol === 'BTC' ? (
                <View style={styles.assetIconCircleBtc}><MaterialCommunityIcons name="currency-btc" size={14} color="#0B0B0B" /></View>
              ) : race.assets[userBet.assetIdx]?.symbol === 'ETH' ? (
                <View style={styles.assetIconCircleEth}><MaterialCommunityIcons name="ethereum" size={14} color="#FFFFFF" /></View>
              ) : race.assets[userBet.assetIdx]?.symbol === 'SOL' ? (
                <View style={styles.assetIconCircleSol}>
                  <SolanaLogo size={14} />
                </View>
              ) : null}
              <View style={[styles.successChip, { borderColor: 'rgba(242,201,76,0.5)', backgroundColor: 'rgba(242,201,76,0.15)' }]}>
                <MaterialCommunityIcons name="check-decagram" size={12} color="#F2C94C" />
                <Text style={styles.successChipText}>Bet Placed</Text>
              </View>
              <View style={[styles.successChip, { borderColor: 'rgba(20,241,149,0.5)', backgroundColor: 'rgba(20,241,149,0.12)' }]}>
                <MaterialCommunityIcons name="cash" size={12} color="#14F195" />
                <Text style={styles.successChipText}>${(userBet.amount / 1_000_000).toFixed(2)} USDC</Text>
              </View>
            </View>

            <Animated.View
              style={[
                styles.raceInfoMini,
                {
                  opacity: successCelebrationAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ]}
            >
              <View style={styles.raceInfoItem}>
                <Text style={styles.raceInfoLabel}>Current Bet</Text>
                <Text style={styles.raceInfoValue}>${(userBet.amount / 1_000_000).toFixed(2)} USDC</Text>
              </View>
              <View style={styles.raceInfoDivider} />
              <View style={styles.raceInfoItem}>
                <Text style={styles.raceInfoLabel}>IF You Win</Text>
                {(() => {
                  try {
                    const pools = race?.assetPools as number[] | undefined
                    const totalMicro = Number(race?.totalPool || 0)
                    const feeBps = Number(race?.feeBps || 500)
                    const assetIdx = Number(userBet.assetIdx)
                    const userMicro = Number(userBet.amount || 0)
                    const winnerMicro0 = pools && pools[assetIdx] ? Number(pools[assetIdx]) : 0
                    if (pools && winnerMicro0 > 0 && totalMicro > 0 && userMicro > 0) {
                      const feeMicro = Math.floor((totalMicro * feeBps) / 10_000)
                      const netMicro = Math.max(0, totalMicro - feeMicro)
                      const payoutMicro = Math.floor((userMicro / Math.max(1, winnerMicro0)) * netMicro)
                      const usd = payoutMicro / 1_000_000
                      return (
                        <Text style={styles.raceInfoValue}>${usd.toFixed(2)}</Text>
                      )
                    }
                  } catch {}
                  return <Text style={styles.raceInfoValue}>—</Text>
                })()}
              </View>
              {/* Risk warning removed per request */}
              <View style={styles.raceInfoDivider} />
              <View style={styles.raceInfoItem}>
                <Text style={styles.raceInfoLabel}>Race Pool</Text>
                <Text style={styles.raceInfoValue}>{formatValue(race.totalPool)}</Text>
              </View>
            </Animated.View>

            {!showIncreaseBet ? (
              <TouchableOpacity
                style={styles.increaseBetButton}
                onPress={handleToggleIncreaseBet}
                accessibilityLabel="Increase your bet amount"
                accessibilityRole="button"
                accessibilityHint="Opens interface to add more money to your existing bet"
              >
                <LinearGradient
                  colors={['#9945FF', '#14F195']}
                  style={styles.increaseBetGradient}
                >
                  <View pointerEvents="none" style={styles.increaseBetShine} />
                  <MaterialCommunityIcons name="plus-circle" size={18} color="#9945FF" />
                  <Text style={styles.increaseBetText}>Increase Your Bet</Text>
                  <MaterialCommunityIcons name="trending-up" size={16} color="#14F195" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <Animated.View
                style={[
                  styles.increaseBetPanel,
                  {
                    maxHeight: increaseBetExpandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 500],
                    }),
                    opacity: increaseBetExpandAnim,
                  },
                ]}
              >
                <View style={styles.increaseBetHeader}>
                  <Text style={styles.increaseBetTitle}>Add More to Your Bet</Text>
                  <TouchableOpacity
                    style={styles.increaseBetCloseButton}
                    onPress={handleToggleIncreaseBet}
                    accessibilityLabel="Close increase bet panel"
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.increaseBetSubtitle}>
                  Betting on {race.assets[userBet.assetIdx]?.symbol} • Current: $
                  {(userBet.amount / 1_000_000).toFixed(2)}
                </Text>

                <View style={styles.additionalBetInputSection}>
                  <View style={styles.additionalBetInputHeader}>
                    <Text style={styles.additionalBetLabel}>Additional Amount</Text>
                    <TouchableOpacity
                      style={styles.balanceIndicatorSmall}
                      onPress={refreshUserBalance}
                      disabled={isLoadingBalance}
                      accessibilityLabel="Tap to refresh USDC balance"
                      accessibilityRole="button"
                      accessibilityHint="Refreshes your current USDC balance from the blockchain"
                    >
                      <Animated.View
                        style={{
                          transform: [
                            {
                              rotate: balanceRefreshAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '360deg'],
                              }),
                            },
                          ],
                        }}
                      >
                        <MaterialCommunityIcons
                          name={isLoadingBalance ? 'loading' : 'wallet'}
                          size={12}
                          color={COLORS.secondary}
                        />
                      </Animated.View>
                      <Text style={styles.balanceTextSmall}>
                        Balance:{' '}
                        {isLoadingBalance
                          ? 'Loading...'
                          : userBalance !== null
                            ? `$${userBalance.toFixed(2)}`
                            : 'Tap to load'}
                      </Text>
                      {!isLoadingBalance && (
                        <Animated.View
                          style={{
                            transform: [
                              {
                                rotate: balanceRefreshAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '360deg'],
                                }),
                              },
                            ],
                          }}
                        >
                          <MaterialCommunityIcons name="refresh" size={10} color={COLORS.secondary} />
                        </Animated.View>
                      )}
                    </TouchableOpacity>
                  </View>
                  <View style={styles.additionalBetInputWrapper}>
                    <View style={styles.currencyContainer}>
                      <Text style={styles.currencySymbolEnhanced}>$</Text>
                      <Text style={styles.currencyLabel}>USDC</Text>
                    </View>
                    <TextInput
                      style={styles.additionalBetInput}
                      value={additionalBetAmount}
                      onChangeText={handleChangeAdditional}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.text.tertiary}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      returnKeyType="done"
                      maxLength={12}
                      blurOnSubmit
                      selectTextOnFocus={true}
                      accessibilityLabel="Additional bet amount input"
                      accessibilityHint="Enter additional USDC amount to add to your existing bet"
                      onSubmitEditing={() => {
                        // move focus to confirm button if visible
                        if (confirmRef.current && typeof (confirmRef.current as any).focus === 'function') {
                          (confirmRef.current as any).focus()
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.maxButtonSmall}
                      onPress={() => {
                        const currentBet = userBet ? userBet.amount / 1_000_000 : 0
                        const remainingCap = Math.max(0, MAX_BET - currentBet)
                        const maxAdditional = Math.max(
                          0,
                          Math.min(userBalance !== null ? userBalance : 0, remainingCap),
                        )
                        setAdditionalBetAmount(maxAdditional.toFixed(2))
                        triggerHaptic('light', 'max additional amount')
                      }}
                      accessibilityLabel="Set maximum additional bet amount"
                      accessibilityRole="button"
                      accessibilityHint="Sets the additional bet amount to your available USDC balance or maximum allowed"
                    >
                      <Text style={styles.maxButtonTextSmall}>MAX</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.quickAdditionalGrid}>
                  {[5, 10, 25, 50].map((amount) => {
                    const isSelected = !isNaN(parseFloat(additionalBetAmount)) && parseFloat(additionalBetAmount) === amount
                    const currentBet = userBet ? userBet.amount / 1_000_000 : 0
                    const remainingCap = Math.max(0, MAX_BET - currentBet)
                    const maxAdditional = Math.max(
                      0,
                      Math.min(userBalance !== null ? userBalance : 0, remainingCap),
                    )
                    const isDisabled = amount > maxAdditional
                    return (
                      <Animated.View
                        key={amount}
                        style={{
                          transform: [{ scale: isSelected ? quickAmountScaleAnim : 1 }],
                        }}
                      >
                        <TouchableOpacity
                          style={[
                            styles.quickAdditionalButton,
                            isSelected && styles.quickAdditionalButtonSelected,
                            isDisabled && { opacity: 0.5 },
                          ]}
                          onPress={() => {
                            if (isDisabled) return
                            setAdditionalBetAmount(amount.toFixed(2))
                            triggerHaptic('light', `additional ${amount}`)
                          }}
                          disabled={isDisabled}
                          accessibilityLabel={`Add ${amount} dollars to bet`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                          accessibilityHint={
                            isDisabled
                              ? 'Exceeds remaining cap or your balance'
                              : `Adds ${amount} dollars to your existing bet`
                          }
                        >
                          <Text
                            style={[
                              styles.quickAdditionalText,
                              isSelected && styles.quickAdditionalTextSelected,
                            ]}
                          >
                            +${amount}
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )
                  })}
                </View>

                {additionalBetAmount &&
                  !isNaN(parseFloat(additionalBetAmount)) &&
                  parseFloat(additionalBetAmount) > 0 && (
                    <View style={styles.newTotalPreview}>
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>Current Bet</Text>
                        <Text style={styles.previewValue}>${(userBet.amount / 1_000_000).toFixed(2)}</Text>
                      </View>
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>Additional</Text>
                        <Text style={styles.previewValue}>+${parseFloat(additionalBetAmount).toFixed(2)}</Text>
                      </View>
                      <View style={styles.previewDivider} />
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabelTotal}>New Total</Text>
                        <Text style={styles.previewValueTotal}>
                          ${(userBet.amount / 1_000_000 + parseFloat(additionalBetAmount)).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  )}

                <TouchableOpacity
                  style={[
                    styles.confirmAdditionalBetButton,
                    (!additionalBetAmount ||
                      isNaN(parseFloat(additionalBetAmount)) ||
                      parseFloat(additionalBetAmount) <= 0 ||
                      (userBalance !== null &&
                        parseFloat(additionalBetAmount) >
                          Math.min(
                            userBalance,
                            Math.max(0, MAX_BET - (userBet ? userBet.amount / 1_000_000 : 0)),
                          )) ||
                      isPlacingBet) &&
                      styles.confirmAdditionalBetButtonDisabled,
                  ]}
                  onPress={() => {
                    if (
                      additionalBetAmount &&
                      !isNaN(parseFloat(additionalBetAmount)) &&
                      parseFloat(additionalBetAmount) > 0 &&
                      !(userBalance !== null &&
                        parseFloat(additionalBetAmount) >
                          Math.min(
                            userBalance,
                            Math.max(0, MAX_BET - (userBet ? userBet.amount / 1_000_000 : 0)),
                          ))
                    ) {
                      triggerHaptic('heavy', 'confirm additional bet')
                      const additionalAmount = parseFloat(additionalBetAmount)

                      placeBetMutation.mutate(
                        {
                          raceId: race.raceId,
                          assetIdx: userBet.assetIdx,
                          amount: additionalAmount,
                          playerAddress: new PublicKey(account.publicKey.toString()),
                        },
                        {
                          onSuccess: () => {
                            setShowIncreaseBet(false)
                            setAdditionalBetAmount('')

                            if (account?.publicKey) {
                              fetchUserBets(account.publicKey.toBase58(), false)
                            }
                          },
                        },
                      )
                    }
                  }}
                  disabled={
                    !additionalBetAmount ||
                    isNaN(parseFloat(additionalBetAmount)) ||
                    parseFloat(additionalBetAmount) <= 0 ||
                    (userBalance !== null &&
                      parseFloat(additionalBetAmount) >
                        Math.min(
                          userBalance,
                          Math.max(0, MAX_BET - (userBet ? userBet.amount / 1_000_000 : 0)),
                        )) ||
                    isPlacingBet
                  }
                  accessibilityLabel={`Add ${additionalBetAmount} dollars to your bet on ${race.assets[userBet.assetIdx]?.symbol}`}
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={
                      additionalBetAmount &&
                      !isNaN(parseFloat(additionalBetAmount)) &&
                      parseFloat(additionalBetAmount) > 0 &&
                      !(userBalance !== null &&
                        parseFloat(additionalBetAmount) >
                          Math.min(
                            userBalance,
                            Math.max(0, MAX_BET - (userBet ? userBet.amount / 1_000_000 : 0)),
                          )) &&
                      !isPlacingBet
                        ? ['#F2C94C', '#DFA944']
                        : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']
                    }
                    style={styles.confirmAdditionalBetGradient}
                  >
                    {!(isPlacingBet) && (
                      <View pointerEvents="none" style={styles.confirmBetShine} />
                    )}
                    {isPlacingBet ? (
                      <View style={styles.loadingContainerEnhanced}>
                        <ActivityIndicator size="small" color="#000" />
                        <Text style={styles.confirmAdditionalBetText}>ADDING...</Text>
                      </View>
                    ) : (
                      <View style={styles.betButtonContentEnhanced}>
                        <MaterialCommunityIcons name="plus-circle" size={18} color="#0B0B0B" />
                        <Text style={styles.confirmAdditionalBetText}>ADD ${additionalBetAmount || '0.00'} TO BET</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
          </LinearGradient>
        </View>
      )}

      {/* Removed duplicate Live Race Stats card to avoid redundancy */}

      {account && !derivedUserBet && enhancedAssets.length > 0 && (
        <View style={styles.assetSelectionSection}>
          <LinearGradient
            colors={[`rgba(153,69,255,0.25)`, 'rgba(20,241,149,0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.collapsibleHeaderGradient}
          >
            <Animated.View style={[styles.headerSurface, { transform: [{ scale: headerPressScale }] }]}>
              <TouchableOpacity
                onPress={toggleAssetsOpen}
                onPressIn={() => Animated.spring(headerPressScale, { toValue: 0.98, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(headerPressScale, { toValue: 1, useNativeDriver: true }).start()}
                accessibilityRole="button"
                accessibilityLabel={`${assetsOpen ? 'Collapse' : 'Expand'} Choose Your Racer section`}
                accessibilityHint={assetsOpen ? 'Hides the racer grid' : 'Shows the racer grid'}
                style={styles.sectionHeaderEnhanced}
                activeOpacity={0.9}
              >
                <View style={styles.sectionTitleContainer}>
                  <View style={styles.sectionTitleWithIcon}>
                    <Text style={styles.sectionTitleMain}>Choose Your Racer</Text>
                  </View>
                  <Text style={[styles.sectionSubtitleEnhanced, styles.sectionSubtitleTight]}>
                    Pick the crypto you think will have the{' '}
                    <Text style={styles.subtitleEmphasis}>highest momentum</Text>
                  </Text>
                </View>
                <View style={styles.collapsibleRightRow}>
                  <View style={styles.collapsibleCountPill}>
                    <Text style={styles.collapsibleCountText}>{enhancedAssets.length}</Text>
                  </View>
                  <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                    <MaterialCommunityIcons
                      name={'chevron-up'}
                      size={20}
                      color="#FFFFFF"
                      style={styles.collapsibleChevron}
                    />
                  </Animated.View>
                </View>
              </TouchableOpacity>
              <View style={styles.headerGlowContainer} pointerEvents="none">
                <LinearGradient
                  colors={[ 'rgba(153,69,255,0.35)', 'rgba(20,241,149,0.15)', 'transparent' ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.headerGlow}
                />
              </View>
              <LinearGradient
                colors={[ 'transparent', 'rgba(153,69,255,0.35)', 'transparent' ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerBottomAccent}
              />
            </Animated.View>
          </LinearGradient>

          {!assetsOpen && enhancedAssets[selectedAssetIdx] && (
            <View style={styles.collapsibleSummary}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {enhancedAssets[selectedAssetIdx]?.symbol === 'BTC' ? (
                  <View style={styles.assetIconCircleBtc}>
                    <MaterialCommunityIcons name="currency-btc" size={16} color="#0B0B0B" />
                  </View>
                ) : enhancedAssets[selectedAssetIdx]?.symbol === 'ETH' ? (
                  <View style={styles.assetIconCircleEth}>
                    <MaterialCommunityIcons name="ethereum" size={16} color="#FFFFFF" />
                  </View>
                ) : enhancedAssets[selectedAssetIdx]?.symbol === 'SOL' ? (
                  <View style={styles.assetIconCircleSol}>
                    <SolanaLogo size={16} />
                  </View>
                ) : (
                  <View style={[styles.assetDot, { backgroundColor: enhancedAssets[selectedAssetIdx]?.color || '#FFD700' }]} />
                )}
                <Text style={{ fontFamily: 'Sora-Bold', color: '#fff' }}>
                  {enhancedAssets[selectedAssetIdx]?.symbol}
                </Text>
                <Text style={{ fontFamily: 'Inter-Regular', color: 'rgba(255,255,255,0.8)' }}>
                  {enhancedAssets[selectedAssetIdx]?.name}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Inter-SemiBold', color: '#FFD700', fontSize: 12 }}>
                    {enhancedAssets[selectedAssetIdx]?.poolShare?.toFixed?.(1) ?? 0}%
                  </Text>
                  <Text style={{ fontFamily: 'Inter-Regular', color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Pool</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Inter-SemiBold', color: '#14F195', fontSize: 12 }}>
                    {(enhancedAssets[selectedAssetIdx]?.performance ?? 0).toFixed(2)}%
                  </Text>
                  <Text style={{ fontFamily: 'Inter-Regular', color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Momentum</Text>
                </View>
              </View>
            </View>
          )}

          {assetsOpen && (
            <View style={styles.assetCardsContainer}>
            {enhancedAssets.map((asset: any, index: number) => {
              const isSelected = selectedAssetIdx === index

              const performance = asset.performance || 0

              const allPerformances = enhancedAssets.map((a: any) => a.performance || 0)
              const maxPerformance = Math.max(...allPerformances)
              const isLeading = Math.abs(performance - maxPerformance) < 0.001

              const poolShare = asset.poolShare?.toFixed(1) || '0.0'

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.assetCardEnhanced,

                    isSelected ? styles.assetCardSelected : isLeading ? styles.assetCardLeading : null,
                    { minHeight: MIN_TOUCH_TARGET + 60 },
                  ]}
                  onPress={() => handleAssetSelection(index)}
                  activeOpacity={0.8}
                  accessibilityLabel={`Select ${asset.symbol} (${asset.name}) for betting. Current momentum: ${performance >= 0 ? '+' : ''}${performance.toFixed(2)}%. ${isSelected ? 'Currently selected' : 'Tap to select'}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityHint={`Choose ${asset.symbol} as your racing asset. ${isLeading ? 'This asset is currently leading.' : ''}`}
                >
                  <Animated.View
                    style={{
                      transform: [{ scale: isSelected ? assetSelectionPulseAnim : 1 }],
                    }}
                  >
                    <LinearGradient
                      colors={
                        isSelected
                          ? [`${asset.color}40`, `${asset.color}20`, `${asset.color}10`]
                          : isLeading
                            ? ['rgba(255, 215, 0, 0.2)', 'rgba(0, 0, 0, 0.6)']
                            : ['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.4)']
                      }
                      style={styles.assetCardGradientEnhanced}
                    >
                      {isLeading && (
                        <View style={styles.leadingBadge}>
                          <MaterialCommunityIcons name="crown" size={12} color="#000" />
                          <Text style={styles.leadingBadgeText}>LEADING</Text>
                        </View>
                      )}

                      <View style={styles.assetHeaderEnhanced}>
                        {asset.symbol === 'BTC' ? (
                          <View style={styles.assetIconCircleBtc}>
                            <MaterialCommunityIcons name="currency-btc" size={16} color="#0B0B0B" />
                          </View>
                        ) : asset.symbol === 'ETH' ? (
                          <View style={styles.assetIconCircleEth}>
                            <MaterialCommunityIcons name="ethereum" size={16} color="#FFFFFF" />
                          </View>
                        ) : asset.symbol === 'SOL' ? (
                          <View style={styles.assetIconCircleSol}>
                            <SolanaLogo size={isTablet ? 20 : 16} />
                          </View>
                        ) : (
                          <View style={[styles.assetIconEnhanced, { backgroundColor: asset.color }]}>
                            <Text style={styles.assetSymbolIconEnhanced}>{asset.symbol[0]}</Text>
                          </View>
                        )}
                        <View style={styles.assetInfoEnhanced}>
                          <Text style={styles.assetSymbolEnhanced}>{asset.symbol}</Text>
                          <Text style={styles.assetNameEnhanced}>{asset.name}</Text>
                        </View>
                        <View style={styles.assetChipsRow}>
                          <View style={styles.assetChip}> 
                            <MaterialCommunityIcons name="account-group" size={10} color="#FFD700" />
                            <Text style={styles.assetChipText}>{poolShare}%</Text>
                          </View>
                        </View>
                        {isSelected && (
                          <Animated.View
                            style={[
                              styles.selectedIndicator,
                              {
                                transform: [{ scale: assetSelectionPulseAnim }],
                              },
                            ]}
                          >
                            <MaterialCommunityIcons name="check-circle" size={16} color="#000" />
                          </Animated.View>
                        )}
                      </View>

                      <View style={styles.performanceSection}>
                        <View style={styles.assetPerformanceHeader}>
                          <Text style={styles.performanceLabel}>Current Momentum</Text>
                          <View style={styles.performanceValueContainer}>
                            <Text
                              style={[
                                styles.performanceValueEnhanced,
                                { color: asset.performance >= 0 ? '#00FF88' : '#FF4444' },
                              ]}
                            >
                              {asset.performance >= 0 ? '+' : ''}
                              {typeof asset.performance === 'number' && !isNaN(asset.performance)
                                ? asset.performance.toFixed(2)
                                : '0.00'}
                              %
                            </Text>
                            <MaterialCommunityIcons
                              name={asset.performance >= 0 ? 'trending-up' : 'trending-down'}
                              size={14}
                              color={asset.performance >= 0 ? '#00FF88' : '#FF4444'}
                            />
                          </View>
                        </View>

                        <View style={styles.momentumVisualization}>
                          <View style={styles.momentumTrack}>
                            <Animated.View
                              style={[
                                styles.momentumIndicatorBar,
                                {
                                  width: `${Math.min(100, Math.max(20, Math.abs(asset.performance) * 10 + 20))}%`,
                                  backgroundColor: asset.color,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.momentumIndicatorText}>
                            {Math.abs(asset.performance) > 2
                              ? 'High'
                              : Math.abs(asset.performance) > 1
                                ? 'Medium'
                                : 'Low'}{' '}
                            momentum
                          </Text>
                        </View>
                      </View>

                      <View style={styles.assetMetrics}>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricLabel}>Pool Share</Text>
                          <Text style={styles.metricValue}>{poolShare}%</Text>
                        </View>
                        <View style={styles.metricDivider} />
                        <View style={styles.metricItem}>
                          <Text style={styles.metricLabel}>Current Price</Text>
                          <Text style={styles.metricValue}>${asset.currentPrice?.toFixed(2) || '0.00'}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </Animated.View>
                </TouchableOpacity>
              )
            })}
          </View>
          )}

          {assetsOpen && selectedAssetIdx >= 0 && enhancedAssets[selectedAssetIdx] && (
            <View style={styles.selectionHint}>
              <MaterialCommunityIcons name="lightbulb-on" size={16} color="#FFD700" />
              <Text style={styles.selectionHintText}>
                Good choice! {enhancedAssets[selectedAssetIdx].symbol} has{' '}
                {Math.abs(enhancedAssets[selectedAssetIdx].performance || 0).toFixed(1)}% momentum
              </Text>
            </View>
          )}
        </View>
      )}

      {account && !derivedUserBet && selectedAssetIdx >= 0 && enhancedAssets.length > 0 && (
        <View style={styles.bettingSection}>
          <LinearGradient
            colors={[`rgba(153,69,255,0.25)`, 'rgba(20,241,149,0.15)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.collapsibleHeaderGradient}
          >
            <View style={styles.headerSurface}>
              <View style={styles.sectionHeaderEnhanced}>
                <View style={styles.sectionTitleContainer}>
                  <View style={styles.sectionTitleWithIcon}>
                    <Text style={styles.sectionTitleMain}>Place Your Bet</Text>
                  </View>
                  <Text style={[styles.sectionSubtitleEnhanced, styles.sectionSubtitleTight]}>
                    How much do you want to risk on{' '}
                    <Text style={styles.subtitleEmphasis}>{enhancedAssets[selectedAssetIdx]?.symbol}</Text>?
                  </Text>
                </View>
              </View>
              <LinearGradient
                colors={[ 'transparent', 'rgba(153,69,255,0.35)', 'transparent' ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerBottomAccent}
              />
            </View>
          </LinearGradient>

          <LinearGradient
            colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.8)']}
            style={styles.bettingPanel}
          >
            {/* Pool dynamics donut */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <PoolDonut
                totalPoolUsd={payout.winnerPool || 0}
                yourBetUsd={0}
                title="Pool Dynamics"
                sharePct={payout.yourSharePct}
                subLabel="Winner Pool Share"
                poolLabel="Winner Pool"
              />
            </View>
            <View style={styles.betInputSectionEnhanced}>
              <View style={styles.betInputHeader}>
                <Text style={styles.betInputLabelEnhanced}>Bet Amount</Text>
                <TouchableOpacity
                  style={styles.balanceIndicator}
                  onPress={refreshUserBalance}
                  disabled={isLoadingBalance}
                  accessibilityLabel="Tap to refresh USDC balance"
                  accessibilityRole="button"
                  accessibilityHint="Refreshes your current USDC balance from the blockchain"
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: balanceRefreshAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    <MaterialCommunityIcons
                      name={isLoadingBalance ? 'loading' : 'wallet'}
                      size={14}
                      color={COLORS.secondary}
                    />
                  </Animated.View>
                  <Text style={styles.balanceText}>
                    Balance:{' '}
                    {isLoadingBalance
                      ? 'Loading...'
                      : userBalance !== null
                        ? `$${userBalance.toFixed(2)} USDC`
                        : 'Tap to load'}
                  </Text>
                  {!isLoadingBalance && (
                    <Animated.View
                      style={{
                        transform: [
                          {
                            rotate: balanceRefreshAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            }),
                          },
                        ],
                      }}
                    >
                      <MaterialCommunityIcons name="refresh" size={12} color={COLORS.secondary} />
                    </Animated.View>
                  )}
                </TouchableOpacity>
              </View>

              <Animated.View
                style={[
                  styles.betInputWrapperEnhanced,
                  !canPlaceBet && validationErrors.invalidAmount && { transform: [{ translateX: shakeAnim }] },
                  {
                    borderColor: betInputFocusAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['rgba(255,255,255,0.3)', 'rgba(153,69,255,0.6)'],
                    }),
                    shadowOpacity: betInputFocusAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ]}
              >
                <View style={styles.currencyContainer}>
                  <View style={styles.currencyIconCircle}>
                    <MaterialCommunityIcons name="currency-usd" size={16} color="#0B0B0B" />
                  </View>
                  <Text style={styles.currencyLabel}>USDC</Text>
                </View>
                <TextInput
                  style={styles.betInputEnhanced}
                  value={betAmount}
                  onChangeText={handleChangeAmount}
                  onFocus={handleBetInputFocus}
                  onBlur={handleBetInputBlur}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.text.tertiary}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  returnKeyType="done"
                  maxLength={12}
                  blurOnSubmit
                  selectTextOnFocus={true}
                  accessibilityLabel="Bet amount input"
                  accessibilityHint="Enter the amount in USDC you want to bet on the selected asset"
                  accessibilityValue={{ text: betAmount ? `${betAmount} dollars` : 'No amount entered' }}
                  onSubmitEditing={() => {
                    if (canPlaceBet && !isPlacingBet) {
                      handleBetAttempt()
                    }
                  }}
                />
                <TouchableOpacity
                  style={styles.maxButtonEnhanced}
                  onPress={handleMaxBetAmount}
                  accessibilityLabel="Set maximum bet amount"
                  accessibilityRole="button"
                  accessibilityHint="Sets the bet amount to your available USDC balance or maximum allowed bet"
                >
                  <Text style={styles.maxButtonTextEnhanced}>MAX</Text>
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.inputHelperText}>
                Min $0.10 • Fee {((race?.feeBps || 500) / 100).toFixed(2)}%
              </Text>
            </View>

            <View style={styles.quickBetSectionEnhanced}>
              <View style={styles.quickBetLabelContainer}>
                <MaterialCommunityIcons name="cash-multiple" size={16} color="#9945FF" />
                <Text style={styles.quickBetLabelEnhanced}>Quick Amounts</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickBetRow}
              >
                {[0.25, 0.5, 0.75, 1].map((pct) => {
                  const balanceVal = userBalance ?? 0
                  const target = Math.max(0.1, Math.min(MAX_BET, balanceVal * pct))
                  const label = `${Math.round(pct * 100)}%`
                  const valueText = label
                  const isSelected =
                    !isNaN(parseFloat(betAmount)) && Math.abs(parseFloat(betAmount) - target) < 0.01
                  const isDisabled = (userBalance ?? 0) <= 0.1
                  return (
                    <Animated.View
                      key={pct}
                      style={{ transform: [{ scale: isSelected ? quickAmountScaleAnim : 1 }] }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.quickBetButtonEnhanced,
                          isSelected && styles.quickBetButtonSelectedEnhanced,
                          isDisabled && styles.quickBetButtonDisabledEnhanced,
                          { minHeight: MIN_TOUCH_TARGET },
                        ]}
                        onPress={() => !isDisabled && handleQuickPercentSelection(pct)}
                        accessibilityLabel={`Quick bet ${label} of balance`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                        accessibilityHint={
                          isDisabled
                            ? 'Balance too low for percentage shortcuts'
                            : `Sets your bet amount to ${label} of your USDC balance`
                        }
                        activeOpacity={0.8}
                        disabled={isDisabled}
                      >
                        <LinearGradient
                          colors={
                            isDisabled
                              ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.03)']
                              : isSelected
                                ? ['rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 0.1)']
                                : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']
                          }
                          style={styles.quickBetGradientBackground}
                        >
                          <Text
                            style={[
                              styles.quickBetTextEnhanced,
                              isSelected && styles.quickBetTextSelectedEnhanced,
                              isDisabled && styles.quickBetTextDisabledEnhanced,
                           ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                           >
                             {valueText}
                           </Text>
                         </LinearGradient>
                       </TouchableOpacity>
                     </Animated.View>
                   )
                 })}
              </ScrollView>
            </View>

            {betAmount && !isNaN(parseFloat(betAmount)) && parseFloat(betAmount) >= 0.1 && (
              <Animated.View
                style={[
                  styles.betPreviewSection,
                  {
                    opacity: previewSlideAnim,
                    transform: [
                      {
                        translateY: previewSlideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={['rgba(153, 69, 255, 0.2)', 'rgba(20, 241, 149, 0.1)']}
                  style={styles.betPreviewCard}
                >
                  <View style={styles.betPreviewHeader}>
                    <MaterialCommunityIcons name="calculator" size={16} color="#9945FF" />
                    <Text style={styles.betPreviewTitle}>Bet Preview</Text>
                  </View>

                  <View style={styles.betPreviewDetails}>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Your Bet</Text>
                      <Text style={styles.previewValue}>${parseFloat(betAmount).toFixed(2)}</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>If {enhancedAssets[selectedAssetIdx]?.symbol} wins</Text>
                      <Text style={[styles.previewValue, styles.previewWin]}>
                        +${payout.profit.toFixed(2)} profit
                      </Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Your share of winner pool</Text>
                      <Text style={styles.previewValue}>{payout.yourSharePct.toFixed(1)}%</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Net pool after fee</Text>
                      <Text style={styles.previewValue}>${payout.netPool.toFixed(2)} ({payout.feePct.toFixed(2)}% fee)</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Your cut of field</Text>
                      <Text style={styles.previewValue}>${payout.fieldCut.toFixed(2)}</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>If {enhancedAssets[selectedAssetIdx]?.symbol} loses</Text>
                      <Text style={[styles.previewValue, styles.previewLoss]}>
                        -${parseFloat(betAmount).toFixed(2)} (100% loss)
                      </Text>
                    </View>
                    
                    <View style={styles.riskWarningRow}>
                      <MaterialCommunityIcons name="alert" size={14} color="#FFD700" />
                      <Text style={styles.riskWarningText}>{payout.note}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>
            )}

            {!canPlaceBet && betAmount && (
              <Animated.View style={styles.errorContainerEnhanced}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#FF4444" />
                <Text style={styles.betErrorTextEnhanced}>{validationMessage}</Text>
              </Animated.View>
            )}

            <View style={styles.placeBetSection}>
              {showBetConfirmation && race && enhancedAssets.length > 0 ? (
                <Animated.View
                  style={[
                    styles.confirmationModalInline,
                    {
                      opacity: confirmationAnim,
                      transform: [
                        { scale: confirmationAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
                      ],
                    },
                  ]}
                  accessibilityViewIsModal={true}
                  accessibilityLiveRegion="polite"
                  accessible={true}
                  onAccessibilityEscape={() => setShowBetConfirmation(false)}
                >
                  <LinearGradient
                    colors={['rgba(0, 0, 0, 0.95)', 'rgba(0, 0, 0, 0.9)']}
                    style={styles.confirmationModalContent}
                  >
                    <View style={styles.confirmationHeader}>
                      <MaterialCommunityIcons name="check-decagram" size={32} color="#9945FF" />
                      <Text style={styles.confirmationTitle}>Confirm Your Bet</Text>
                      <Text style={styles.confirmationSubtitle}>Review before placing</Text>
                    </View>
                    <View style={styles.confirmationDetails}>
                      <View style={styles.confirmationRow}>
                        <Text style={styles.confirmationLabel}>Asset</Text>
                        <Text style={styles.confirmationValue}>{enhancedAssets[selectedAssetIdx]?.symbol}</Text>
                      </View>
                      <View style={styles.confirmationRow}>
                        <Text style={styles.confirmationLabel}>Bet Amount</Text>
                        <Text style={styles.confirmationValue}>${betAmount} USDC</Text>
                      </View>
                      <View style={styles.confirmationRow}>
                        <Text style={styles.confirmationLabel}>IF {enhancedAssets[selectedAssetIdx]?.symbol} Wins</Text>
                        <Text style={[styles.confirmationValue, styles.confirmationWin]}>
                          ${payout.totalPayout.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.confirmationRow}>
                        <Text style={styles.confirmationLabel}>IF {enhancedAssets[selectedAssetIdx]?.symbol} Loses</Text>
                        <Text style={[styles.confirmationValue, { color: '#FF4444' }]}>
                          -${betAmount} (100% loss)
                        </Text>
                      </View>
                      <View style={styles.confirmationRiskWarning}>
                        <MaterialCommunityIcons name="alert" size={14} color="#FFD700" />
                        <Text style={styles.confirmationRiskText}>
                          Winner-takes-all: Only the highest performing asset wins
                        </Text>
                      </View>
                    </View>
                    <View style={styles.confirmationActions}>
                      <TouchableOpacity
                        ref={cancelRef}
                        style={styles.confirmationCancelButton}
                        onPress={() => {
                          setShowBetConfirmation(false)
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                        }}
                        disabled={isPlacingBet}
                        accessibilityLabel="Cancel bet confirmation"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isPlacingBet }}
                        accessibilityHint="Dismisses the bet confirmation dialog"
                        onFocus={() => {}}
                        activeOpacity={0.7}
                      >
                        <View style={styles.confirmationCancelInner}>
                          <MaterialCommunityIcons name="close" size={24} color="#fff" />
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        ref={confirmRef}
                        style={styles.confirmationConfirmButton}
                        onPress={() => {
                          confirmBet()
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                        }}
                        disabled={isPlacingBet}
                        activeOpacity={0.8}
                        accessibilityLabel="Confirm bet placement"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isPlacingBet }}
                        accessibilityHint="Places your bet and submits it to the race"
                        onFocus={() => {}}
                      >
                        <LinearGradient colors={['#9945FF', '#14F195']} style={styles.confirmationConfirmGradient}>
                          <View
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 }}
                          >
                            {isPlacingBet ? (
                              <ActivityIndicator size="small" color="#000" />
                            ) : (
                              <MaterialCommunityIcons name="check" size={24} color="#000" />
                            )}
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </Animated.View>
              ) : (
                <Animated.View
                  style={{
                    transform: [{ scale: placeBetPulseAnim }],
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.placeBetButtonEnhanced,
                      (!canPlaceBet || isPlacingBet) && styles.placeBetButtonDisabledEnhanced,
                      { minHeight: MIN_TOUCH_TARGET + 12 },
                    ]}
                    onPress={() => {
                      handleBetAttempt()
                    }}
                    disabled={!canPlaceBet || isPlacingBet}
                    activeOpacity={0.8}
                    accessibilityLabel={
                      isPlacingBet
                        ? 'Placing bet, please wait'
                        : !canPlaceBet
                          ? validationMessage
                          : `Place ${betAmount} dollar bet on ${race?.assets[selectedAssetIdx]?.symbol}`
                    }
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: !canPlaceBet || isPlacingBet,
                      busy: isPlacingBet,
                    }}
                    accessibilityHint={
                      isPlacingBet ? 'Your bet is being processed' : 'Confirms and submits your bet to the race'
                    }
                  >
                    <LinearGradient
                      colors={
                        canPlaceBet && !isPlacingBet
                          ? ['#F2C94C', '#DFA944']
                          : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']
                      }
                      style={styles.placeBetGradientEnhanced}
                    >
                      {/* Shine overlay */}
                      {canPlaceBet && !isPlacingBet && (
                        <View pointerEvents="none" style={styles.placeBetShine} />
                      )}
                      {isPlacingBet ? (
                        <View style={styles.loadingContainerEnhanced}>
                          <ActivityIndicator size="small" color="#000" />
                          <Text style={styles.placeBetButtonTextEnhanced}>PLACING BET...</Text>
                        </View>
                      ) : (
                        <View style={styles.betButtonContentEnhanced}>
                          <MaterialCommunityIcons name="rocket-launch" size={20} color="#000" />
                          <Text style={styles.placeBetButtonTextEnhanced}>
                            BET ${betAmount || '0'} ON {enhancedAssets[selectedAssetIdx]?.symbol}
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              )}
              <View style={styles.trustSignals}>
                <View style={styles.trustItem}>
                  <MaterialCommunityIcons name="shield-check" size={12} color="#14F195" />
                  <Text style={styles.trustText}>Secure</Text>
                </View>
                <View style={styles.trustDivider} />
                <View style={styles.trustItem}>
                  <MaterialCommunityIcons name="flash" size={12} color="#14F195" />
                  <Text style={styles.trustText}>Instant</Text>
                </View>
                <View style={styles.trustDivider} />
                <View style={styles.trustItem}>
                  <MaterialCommunityIcons name="account-group" size={12} color="#14F195" />
                  <Text style={styles.trustText}>{race.participantCount || 0} racing</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  confirmationModalInline: {
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.97)',
    padding: 20,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#9945FF',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(153,69,255,0.20)',
  },
  phaseContent: {
    paddingHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
    paddingBottom: SPACING.sm,
  },

  welcomeSection: {
    marginBottom: 20,
  },
  welcomeCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: 'rgba(153, 69, 255, 0.3)',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  welcomeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 8,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Sora-Bold',
    letterSpacing: 0.3,
  },
  welcomeDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    fontFamily: 'Inter-Regular',
  },
  howItWorksSteps: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    marginBottom: 20,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumberText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Sora-Bold',
  },
  stepText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  connectWalletMainButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  connectWalletMainGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    gap: 8,
  },
  connectWalletMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Sora-Bold',
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  learnMoreText: {
    fontSize: 12,
    color: '#9945FF',
    fontWeight: '600',
    marginRight: 4,
    fontFamily: 'Inter-SemiBold',
  },

  successSection: {
    marginBottom: 20,
  },
  successCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  successShine: {
    position: 'absolute',
    top: -40,
    left: -160,
    width: 220,
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
  },
  successIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  successIconGradient: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 36,
  },
  successTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Sora-Bold',
  },
  successSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
  },
  successBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  successChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  successChipText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  raceInfoMini: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  raceInfoItem: {
    alignItems: 'center',
  },
  raceInfoLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  raceInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  raceInfoWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  raceInfoWarningText: {
    fontSize: 10,
    color: '#FFD700',
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  raceInfoDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  raceStatsSection: {
    marginBottom: 20,
  },
  raceStatsCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  raceStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  raceStatsTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  raceStatsTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
    fontFamily: 'Sora-Bold',
  },
  raceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Sora-Bold',
  },
  raceStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  raceStatItem: {
    alignItems: 'center',
  },
  raceStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  raceStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },

  assetSelectionSection: {
    marginBottom: SPACING.xl,
    paddingHorizontal: isTablet ? SPACING.sm : 0,
  },
  assetCardsContainer: {
    flexDirection: isTablet && isLandscape ? 'row' : 'row',
    flexWrap: 'wrap',
    gap: isTablet ? SPACING.lg : SPACING.md,
    justifyContent: 'center',
  },
  assetCardsAnimated: {
    overflow: 'hidden',
  },
  collapsibleHeaderGradient: {
    borderRadius: 16,
    marginHorizontal: isTablet ? SPACING.xl : SPACING.lg,
    marginBottom: SPACING.sm,
    padding: 2,
  },
  headerSurface: {
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    paddingHorizontal: isTablet ? SPACING.xl : SPACING.lg,
    paddingVertical: isTablet ? SPACING.md : SPACING.sm,
  },
  headerBottomAccent: {
    height: 2,
  },
  // Removed headerIconContainer for a cleaner title-only header
  sectionSubtitleTight: {
    marginTop: 2,
    letterSpacing: 0.2,
    lineHeight: 18,
    opacity: 0.95,
  },
  subtitleEmphasis: {
    color: '#14F195',
    fontFamily: 'Inter-SemiBold',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerGlowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  headerGlow: {
    height: '100%',
  },
  collapsibleChevron: {
    marginLeft: SPACING.md,
  },
  collapsibleSummary: {
    marginHorizontal: isTablet ? SPACING.xl : SPACING.lg,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsibleRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  collapsibleCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  collapsibleCountText: {
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    fontSize: 12,
  },
  assetCardEnhanced: {
    flex: isTablet ? 0 : 1,
    width: isTablet ? (screenWidth - 80) / 3 - 16 : undefined,
    minWidth: isTablet ? 200 : '45%',
    maxWidth: isTablet ? 250 : '48%',
    borderRadius: isTablet ? 20 : 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  assetCardSelected: {
    borderColor: COLORS.success,
    borderWidth: 3,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  assetCardLeading: {
    borderColor: COLORS.warning,
    borderWidth: 2,
    shadowColor: COLORS.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  assetCardGradientEnhanced: {
    padding: isTablet ? SPACING.xl : SPACING.lg,
    minHeight: isTablet ? 140 : 120,
    position: 'relative',
  },
  assetHeaderEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  assetIconEnhanced: {
    width: isTablet ? 40 : 32,
    height: isTablet ? 40 : 32,
    borderRadius: isTablet ? 20 : 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  assetIconCircleBtc: {
    width: isTablet ? 40 : 32,
    height: isTablet ? 40 : 32,
    borderRadius: isTablet ? 20 : 16,
    backgroundColor: '#F7931A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)'
  },
  assetIconCircleEth: {
    width: isTablet ? 40 : 32,
    height: isTablet ? 40 : 32,
    borderRadius: isTablet ? 20 : 16,
    backgroundColor: '#627EEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)'
  },
  assetIconCircleSol: {
    width: isTablet ? 40 : 32,
    height: isTablet ? 40 : 32,
    borderRadius: isTablet ? 20 : 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)'
  },
  assetInfoEnhanced: {
    flex: 1,
    justifyContent: 'center',
  },
  assetSymbolEnhanced: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
    color: COLORS.text.primary,
    fontFamily: 'Sora-Bold',
    letterSpacing: 0.3,
    marginBottom: SPACING.xs / 2,
  },
  assetNameEnhanced: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontFamily: 'Inter-Regular',
    lineHeight: isTablet ? 16 : 14,
  },
  assetChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)',
    backgroundColor: 'rgba(255,215,0,0.12)'
  },
  assetChipText: {
    fontSize: 10,
    color: '#FFD700',
    fontFamily: 'Inter-SemiBold'
  },
  selectedIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 6,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  performanceSection: {
    marginTop: SPACING.md,
  },
  assetPerformanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  performanceLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.text.tertiary,
    fontFamily: 'Inter-Regular',
  },
  performanceValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  performanceValueEnhanced: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter-SemiBold',
  },
  momentumVisualization: {
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  momentumTrack: {
    width: '100%',
    height: isTablet ? 10 : 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: isTablet ? 5 : 4,
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  momentumIndicatorBar: {
    height: '100%',
    borderRadius: isTablet ? 5 : 4,
  },
  momentumIndicatorText: {
    ...TYPOGRAPHY.small,
    color: COLORS.text.secondary,
    fontFamily: 'Inter-Regular',
  },
  assetMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.text.tertiary,
    marginTop: SPACING.xs,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  metricValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.text.primary,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  metricDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  selectionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: isTablet ? 16 : 12,
    paddingHorizontal: isTablet ? SPACING.lg : SPACING.md,
    paddingVertical: isTablet ? SPACING.sm : SPACING.xs,
    marginTop: SPACING.md,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  inputHelperText: {
    marginTop: 8,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
  },
  selectionHintText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    marginLeft: SPACING.sm,
    fontFamily: 'Inter-Regular',
    fontWeight: '600',
  },

  bettingSection: {
    marginBottom: 20,
  },
  bettingPanel: {
    borderRadius: isTablet ? 24 : 16,
    padding: isTablet ? SPACING.xxl : SPACING.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 16,
  },
  betInputSectionEnhanced: {
    marginBottom: 16,
  },
  betInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  betInputLabelEnhanced: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text.primary,
    fontFamily: 'Sora-Bold',
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  balanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 241, 149, 0.15)',
    borderRadius: isTablet ? 16 : 12,
    paddingVertical: isTablet ? SPACING.xs + 2 : SPACING.xs,
    paddingHorizontal: isTablet ? SPACING.md : SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.4)',
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
    gap: 4,
  },
  balanceText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    marginLeft: SPACING.xs,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  betInputWrapperEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: isTablet ? 16 : 12,
    paddingHorizontal: isTablet ? SPACING.xl : SPACING.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
    minHeight: MIN_TOUCH_TARGET + 8,
  },
  currencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: isTablet ? SPACING.md : SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  currencyIconCircle: {
    width: isTablet ? 28 : 24,
    height: isTablet ? 28 : 24,
    borderRadius: isTablet ? 14 : 12,
    backgroundColor: '#F2C94C',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  currencyLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.text.tertiary,
    fontFamily: 'Inter-Regular',
    marginTop: 0,
  },
  betInputEnhanced: {
    flex: 1,
    ...TYPOGRAPHY.title,
    color: COLORS.text.primary,
    paddingVertical: isTablet ? SPACING.lg : SPACING.md,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },
  quickBetSectionEnhanced: {
    marginBottom: SPACING.lg,
  },
  quickBetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? SPACING.xl : SPACING.lg,
    marginBottom: 12,
  },
  quickBetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: isTablet ? SPACING.xl : SPACING.lg,
    paddingBottom: 8,
  },
  quickBetButtonEnhanced: {
    // Horizontal row: size to content, keep large targets
    flexShrink: 0,
    borderRadius: isTablet ? 14 : 12,
    paddingVertical: isTablet ? SPACING.md : SPACING.sm,
    paddingHorizontal: isTablet ? SPACING.md : SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
    minHeight: MIN_TOUCH_TARGET + 6,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 0,
    marginRight: 8,
  },
  quickBetTextEnhanced: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    zIndex: 2,
  },
  quickBetButtonSelectedEnhanced: {
    borderColor: COLORS.warning,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    shadowColor: COLORS.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  quickBetButtonDisabledEnhanced: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  quickBetTextSelectedEnhanced: {
    color: COLORS.warning,
    fontWeight: '800',
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  quickBetTextDisabledEnhanced: {
    color: 'rgba(255,255,255,0.85)',
  },
  quickBetGradientBackground: {
    // Do not force stretch; let content size the button
    flex: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: isTablet ? 12 : 10,
    paddingVertical: isTablet ? SPACING.md : SPACING.sm,
    paddingHorizontal: isTablet ? SPACING.md : SPACING.sm,
  },
  betPreviewSection: {
    marginBottom: 16,
  },
  betPreviewCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.2)',
  },
  betPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  betPreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9945FF',
    fontFamily: 'Sora-Bold',
    letterSpacing: 0.2,
  },
  betPreviewDetails: {
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  previewWin: {
    color: '#14F195',
  },
  previewLoss: {
    color: '#FF4444',
  },
  previewDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 10,
  },
  riskWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  riskWarningText: {
    fontSize: 10,
    color: '#FFD700',
    fontFamily: 'Inter-Regular',
    flex: 1,
  },
  previewLabelTotal: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
  },
  previewValueTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  errorContainerEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  betErrorTextEnhanced: {
    fontSize: 12,
    color: '#FF4444',
    marginLeft: 8,
    fontFamily: 'Inter-Regular',
  },
  placeBetSection: {
    marginTop: 16,
  },
  placeBetButtonEnhanced: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeBetButtonDisabledEnhanced: {
    opacity: 0.5,
  },
  placeBetGradientEnhanced: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeBetShine: {
    position: 'absolute',
    top: -16,
    left: -120,
    width: 180,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
  },
  betButtonContentEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingContainerEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBetButtonTextEnhanced: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Sora-Bold',
  },
  trustSignals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustText: {
    fontSize: 12,
    color: '#14F195',
    marginLeft: 4,
    fontFamily: 'Inter-SemiBold',
  },
  trustDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  confirmationModal: {
    width: '90%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  confirmationModalContent: {
    padding: 24,
  },
  confirmationHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Sora-Bold',
  },
  confirmationSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  confirmationDetails: {
    gap: 12,
    marginBottom: 20,
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmationLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
  },
  confirmationValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  confirmationWin: {
    color: '#14F195',
  },
  confirmationRiskWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  confirmationRiskText: {
    fontSize: 11,
    color: '#FFD700',
    fontFamily: 'Inter-Regular',
    flex: 1,
    lineHeight: 16,
  },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    gap: 12,
  },
  confirmationCancelButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmationCancelInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 52,
    width: '100%',
  },
  confirmationCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  confirmationConfirmButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 52,
    shadowColor: '#9945FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  confirmationConfirmGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 52,
    width: '100%',
  },
  confirmationConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Sora-Bold',
    textAlign: 'center',
    letterSpacing: 0.5,
    flexShrink: 1,
    flexGrow: 1,
    width: '100%',
    includeFontPadding: false,
  },

  sectionHeaderEnhanced: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitleMain: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Sora-Bold',
  },
  sectionSubtitleEnhanced: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
  },
  helpIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(153, 69, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
  },
  leadingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    borderRadius: 14,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.warning,
    zIndex: 5,
  },
  leadingBadgeText: {
    fontSize: isTablet ? 10 : 8,
    color: '#000',
    fontWeight: '800',
    marginLeft: SPACING.xs,
    fontFamily: 'Inter-SemiBold',
  },
  assetSymbolIconEnhanced: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Sora-Bold',
  },
  quickBetLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: isTablet ? SPACING.md : SPACING.sm,
  },
  quickBetLabelEnhanced: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.text.primary,
    fontFamily: 'Sora-Bold',
    fontWeight: '700',
  },
  maxButtonEnhanced: {
    paddingHorizontal: isTablet ? SPACING.md : SPACING.sm,
    backgroundColor: 'rgba(20, 241, 149, 0.2)',
    borderRadius: isTablet ? 12 : 8,
    marginLeft: isTablet ? SPACING.md : SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: MIN_TOUCH_TARGET + 8,
  },
  maxButtonTextEnhanced: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    fontWeight: '800',
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1,
  },

  errorContainerCommit: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: isTablet ? 20 : 16,
    marginHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
  },
  errorTitleCommit: {
    ...TYPOGRAPHY.title,
    fontWeight: '700',
    color: COLORS.error,
    marginTop: SPACING.md,
    textAlign: 'center',
    fontFamily: 'Sora-Bold',
  },
  errorMessageCommit: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  retryButtonText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    fontFamily: 'Sora-Bold',
  },

  loadingContainerCommit: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: isTablet ? 20 : 16,
    marginHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
  },
  loadingTextCommit: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.primary,
    marginTop: SPACING.md,
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },
  loadingProgressContainer: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  loadingProgressText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },

  increaseBetButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  increaseBetGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    gap: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  increaseBetText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Sora-Bold',
  },
  increaseBetShine: {
    position: 'absolute',
    top: -12,
    left: -120,
    width: 180,
    height: 90,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
  },
  increaseBetPanel: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
    shadowColor: 'rgba(0, 255, 136, 0.3)',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  increaseBetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  increaseBetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Sora-Bold',
  },
  increaseBetSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
  },
  increaseBetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  additionalBetInputSection: {
    marginBottom: 16,
  },
  additionalBetInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  additionalBetLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
  balanceIndicatorSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 241, 149, 0.15)',
    borderRadius: isTablet ? 16 : 12,
    paddingVertical: isTablet ? SPACING.xs + 2 : SPACING.xs,
    paddingHorizontal: isTablet ? SPACING.md : SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.4)',
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
    gap: 4,
  },
  balanceTextSmall: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    marginLeft: SPACING.xs,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  additionalBetInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
    minHeight: MIN_TOUCH_TARGET + 8,
  },
  additionalBetInput: {
    flex: 1,
    ...TYPOGRAPHY.title,
    color: COLORS.text.primary,
    paddingVertical: isTablet ? SPACING.lg : SPACING.md,
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },
  quickAdditionalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickAdditionalButton: {
    width: 64,
    borderRadius: isTablet ? 14 : 12,
    paddingVertical: isTablet ? SPACING.md : SPACING.sm + 2,
    paddingHorizontal: isTablet ? SPACING.sm : SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
    minHeight: MIN_TOUCH_TARGET,
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 4,
    marginVertical: 4,
  },
  quickAdditionalText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
    zIndex: 2,
  },
  quickAdditionalButtonSelected: {
    borderColor: COLORS.warning,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    shadowColor: COLORS.warning,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  quickAdditionalTextSelected: {
    color: COLORS.warning,
    fontWeight: '800',
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  confirmAdditionalBetButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmAdditionalBetButtonDisabled: {
    opacity: 0.5,
  },
  confirmAdditionalBetGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmBetShine: {
    position: 'absolute',
    top: -16,
    left: -120,
    width: 180,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
  },
  confirmAdditionalBetText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Sora-Bold',
  },
  newTotalPreview: {
    marginTop: 16,
  },
  maxButtonSmall: {
    paddingHorizontal: isTablet ? SPACING.md : SPACING.sm,
    backgroundColor: 'rgba(20, 241, 149, 0.2)',
    borderRadius: isTablet ? 12 : 8,
    marginLeft: isTablet ? SPACING.md : SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: MIN_TOUCH_TARGET + 8,
  },
  maxButtonTextSmall: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    fontWeight: '800',
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 1,
  },
})
