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
  View,
} from 'react-native'

import { MaterialCommunityIcons } from '@expo/vector-icons'
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
): { totalPayout: number; profit: number } => {
  if (!betAmount || isNaN(parseFloat(betAmount))) {
    return { totalPayout: 0, profit: 0 }
  }

  const betAmountNum = parseFloat(betAmount)

  if (race?.payoutRatio && race.payoutRatio > 0) {
    const totalPayout = (betAmountNum * race.payoutRatio) / 1_000_000_000_000
    const profit = Math.max(0, totalPayout - betAmountNum)
    return { totalPayout, profit }
  }

  if (race?.totalPool && race?.assetPools && selectedAssetIdx >= 0 && selectedAssetIdx < race.assetPools.length) {
    const totalPoolUSD = race.totalPool / 1_000_000
    const selectedPoolUSD = (race.assetPools[selectedAssetIdx] || 0) / 1_000_000
    const feeRate = (race.feeBps || 250) / 10000
    const netPool = totalPoolUSD * (1 - feeRate)

    if (selectedPoolUSD > 0) {
      const projectedSelectedPool = selectedPoolUSD + betAmountNum
      const projectedTotalPool = totalPoolUSD + betAmountNum
      const projectedNetPool = projectedTotalPool * (1 - feeRate)

      const estimatedPayout = (betAmountNum / projectedSelectedPool) * projectedNetPool
      const profit = Math.max(0, estimatedPayout - betAmountNum)
      return { totalPayout: estimatedPayout, profit }
    }
  }

  const estimatedMultiplier = 1.5
  const totalPayout = betAmountNum * estimatedMultiplier
  const profit = totalPayout - betAmountNum
  return { totalPayout, profit }
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

  const {
    race,
    userBets,
    isLoading,
    error,
    fetchCommitPhaseData,
    fetchUserBets,
    priceUpdates,
    liveRaceData,
    connectWebSocket,
    subscribeToRace,
    isConnected,
    forceReconnectWebSocket,
    fetchCurrentRace,
  } = useRaceStore()

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

  const commitAnimationRefs = useRef<Animated.CompositeAnimation[]>([])

  const appState = useRef(AppState.currentState)
  const [isAppActive, setIsAppActive] = useState(true)

  const userBet = useMemo(() => {
    if (!userBets || !race?.raceId) return undefined
    return userBets.find((bet) => bet.raceId === race.raceId)
  }, [userBets, race?.raceId])

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
    if (account?.publicKey) {
      fetchCommitPhaseData(undefined, account.publicKey.toBase58(), false)
    } else {
      fetchCommitPhaseData(undefined, undefined, false)
    }
  }, [account?.publicKey, fetchCommitPhaseData])

  useEffect(() => {
    if (!isConnected && race?.raceId && isAppActive) {
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
    } else if (isConnected && race?.raceId && isAppActive) {
      subscribeToRace(race.raceId)

      const { wsService } = useRaceStore.getState()
      wsService.subscribeToPrice()
    }
  }, [race?.raceId, isConnected, connectWebSocket, subscribeToRace, isAppActive])

  useEffect(() => {
    if (account?.publicKey && !userBalance && !isLoadingBalance) {
      setIsLoadingBalance(true)

      const { apiService } = useRaceStore.getState()
      apiService
        .getUserBalance(account.publicKey.toBase58())
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
  }, [account?.publicKey, userBalance, isLoadingBalance])

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

    priceUpdates.forEach((priceData, symbol) => {
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
      const backendLeaderboard = liveRaceData?.leaderboard
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

          if (Math.abs(performance) > 50) {
            performance = Math.sign(performance) * Math.min(Math.abs(performance), 50)
          }
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

      setBetAmount(amount.toString())
    },
    [triggerHaptic],
  )

  const handleMaxBetAmount = useCallback(() => {
    const maxAmount = userBalance !== null ? Math.min(userBalance, 1000).toString() : '100'
    triggerHaptic('selection', 'max bet amount')

    setBetAmount(maxAmount)
  }, [userBalance, triggerHaptic])

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

  const formatValue = (value: number) => {
    const solValue = value / 1_000_000_000
    const usdcValue = solValue * 1000

    if (usdcValue >= 1000000) return `$${(usdcValue / 1000000).toFixed(2)}M`
    if (usdcValue >= 1000) return `$${(usdcValue / 1000).toFixed(1)}K`
    return `$${usdcValue.toFixed(0)}`
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
    if (placeBetMutation.isSuccess && account?.publicKey) {
      fetchUserBets(account.publicKey.toBase58(), false)
      console.log('✅ Refreshing user bets after successful bet placement')
    }
  }, [placeBetMutation.isSuccess, account?.publicKey, fetchUserBets])

  useEffect(() => {
    if (account?.publicKey && !userBalance && !isLoadingBalance) {
      setIsLoadingBalance(true)

      const { apiService } = useRaceStore.getState()
      apiService
        .getUserBalance(account.publicKey.toBase58())
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
  }, [account?.publicKey, userBalance, isLoadingBalance])

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
            colors={['rgba(0, 255, 136, 0.3)', 'rgba(255, 215, 0, 0.2)', 'rgba(0, 255, 136, 0.1)']}
            style={styles.successCard}
          >
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
              <LinearGradient colors={['#00FF88', '#FFD700']} style={styles.successIconGradient}>
                <MaterialCommunityIcons name="check-bold" size={24} color="#000" />
              </LinearGradient>
            </Animated.View>

            <View style={styles.successTitleContainer}>
              <MaterialCommunityIcons name="target" size={20} color="#00FF88" />
              <Text style={styles.successTitle}>You're In The Race!</Text>
            </View>
            <Text style={styles.successSubtitle}>
              ${(userBet.amount / 1_000_000).toFixed(2)} bet placed on {race.assets[userBet.assetIdx]?.symbol}
            </Text>

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
                <Text style={styles.raceInfoLabel}>Potential Win</Text>
                <Text style={styles.raceInfoValue}>
                  ${userBet.potentialPayout ? (userBet.potentialPayout / 1_000_000).toFixed(2) : 'TBD'}
                </Text>
              </View>
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
                  colors={['rgba(153, 69, 255, 0.3)', 'rgba(20, 241, 149, 0.2)']}
                  style={styles.increaseBetGradient}
                >
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
                      onChangeText={setAdditionalBetAmount}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.text.tertiary}
                      keyboardType="numeric"
                      selectTextOnFocus={true}
                      accessibilityLabel="Additional bet amount input"
                      accessibilityHint="Enter additional USDC amount to add to your existing bet"
                    />
                    <TouchableOpacity
                      style={styles.maxButtonSmall}
                      onPress={() => {
                        setAdditionalBetAmount(userBalance !== null ? Math.min(userBalance, 1000).toString() : '100')
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
                    const isSelected = additionalBetAmount === amount.toString()
                    return (
                      <Animated.View
                        key={amount}
                        style={{
                          transform: [{ scale: isSelected ? quickAmountScaleAnim : 1 }],
                        }}
                      >
                        <TouchableOpacity
                          style={[styles.quickAdditionalButton, isSelected && styles.quickAdditionalButtonSelected]}
                          onPress={() => {
                            setAdditionalBetAmount(amount.toString())
                            triggerHaptic('light', `additional ${amount}`)
                          }}
                          accessibilityLabel={`Add ${amount} dollars to bet`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <Text style={[styles.quickAdditionalText, isSelected && styles.quickAdditionalTextSelected]}>
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
                      isPlacingBet) &&
                      styles.confirmAdditionalBetButtonDisabled,
                  ]}
                  onPress={() => {
                    if (
                      additionalBetAmount &&
                      !isNaN(parseFloat(additionalBetAmount)) &&
                      parseFloat(additionalBetAmount) > 0
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
                      !isPlacingBet
                        ? ['#9945FF', '#14F195']
                        : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                    }
                    style={styles.confirmAdditionalBetGradient}
                  >
                    {isPlacingBet ? (
                      <View style={styles.loadingContainerEnhanced}>
                        <ActivityIndicator size="small" color="#000" />
                        <Text style={styles.confirmAdditionalBetText}>ADDING...</Text>
                      </View>
                    ) : (
                      <View style={styles.betButtonContentEnhanced}>
                        <MaterialCommunityIcons name="plus-circle" size={18} color="#000" />
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

      {account && !userBet && (
        <View style={styles.raceStatsSection}>
          <LinearGradient colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.3)']} style={styles.raceStatsCard}>
            <View style={styles.raceStatsHeader}>
              <View style={styles.raceStatsTitle}>
                <MaterialCommunityIcons name="flash" size={20} color="#FFD700" />
                <Text style={styles.raceStatsTitleText}>Live Race Stats</Text>
              </View>
              <Text style={styles.raceNumber}>#{race.raceId}</Text>
            </View>

            <View style={styles.raceStatsGrid}>
              <View style={styles.raceStatItem}>
                <Text style={styles.raceStatValue}>{formatValue(race.totalPool)}</Text>
                <Text style={styles.raceStatLabel}>Prize Pool</Text>
              </View>
              <View style={styles.raceStatItem}>
                <Text style={styles.raceStatValue}>{race.participantCount || 0}</Text>
                <Text style={styles.raceStatLabel}>Racers</Text>
              </View>
              <View style={styles.raceStatItem}>
                <Text style={styles.raceStatValue}>
                  {race.payoutRatio ? `${race.payoutRatio.toFixed(1)}x` : '2.5x'}
                </Text>
                <Text style={styles.raceStatLabel}>Avg Payout</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {account && !derivedUserBet && enhancedAssets.length > 0 && (
        <View style={styles.assetSelectionSection}>
          <View style={styles.sectionHeaderEnhanced}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionTitleWithIcon}>
                <MaterialCommunityIcons name="rocket-launch" size={18} color="#9945FF" />
                <Text style={styles.sectionTitleMain}>Choose Your Racer</Text>
              </View>
              <Text style={styles.sectionSubtitleEnhanced}>
                Pick the crypto you think will have the highest momentum
              </Text>
            </View>
            <TouchableOpacity style={styles.helpIconButton} onPress={() => setShowTips(true)}>
              <MaterialCommunityIcons name="help-circle" size={20} color="#9945FF" />
            </TouchableOpacity>
          </View>

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
                        <View style={[styles.assetIconEnhanced, { backgroundColor: asset.color }]}>
                          <Text style={styles.assetSymbolIconEnhanced}>{asset.symbol[0]}</Text>
                        </View>
                        <View style={styles.assetInfoEnhanced}>
                          <Text style={styles.assetSymbolEnhanced}>{asset.symbol}</Text>
                          <Text style={styles.assetNameEnhanced}>{asset.name}</Text>
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

          {selectedAssetIdx >= 0 && enhancedAssets[selectedAssetIdx] && (
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
          <View style={styles.sectionHeaderEnhanced}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionTitleWithIcon}>
                <MaterialCommunityIcons name="currency-usd" size={18} color="#9945FF" />
                <Text style={styles.sectionTitleMain}>Place Your Bet</Text>
              </View>
              <Text style={styles.sectionSubtitleEnhanced}>
                How much do you want to risk on {enhancedAssets[selectedAssetIdx]?.symbol}?
              </Text>
            </View>
          </View>

          <LinearGradient
            colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.8)']}
            style={styles.bettingPanel}
          >
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
                  <Text style={styles.currencySymbolEnhanced}>$</Text>
                  <Text style={styles.currencyLabel}>USDC</Text>
                </View>
                <TextInput
                  style={styles.betInputEnhanced}
                  value={betAmount}
                  onChangeText={setBetAmount}
                  onFocus={handleBetInputFocus}
                  onBlur={handleBetInputBlur}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.text.tertiary}
                  keyboardType="numeric"
                  selectTextOnFocus={true}
                  accessibilityLabel="Bet amount input"
                  accessibilityHint="Enter the amount in USDC you want to bet on the selected asset"
                  accessibilityValue={{ text: betAmount ? `${betAmount} dollars` : 'No amount entered' }}
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
            </View>

            <View style={styles.quickBetSectionEnhanced}>
              <View style={styles.quickBetLabelContainer}>
                <MaterialCommunityIcons name="cash-multiple" size={16} color="#9945FF" />
                <Text style={styles.quickBetLabelEnhanced}>Quick Amounts</Text>
              </View>
              <View style={styles.quickBetGrid}>
                {[5, 10, 25, 50].map((amount) => {
                  const isSelected = betAmount === amount.toString()
                  return (
                    <Animated.View
                      key={amount}
                      style={{
                        transform: [{ scale: isSelected ? quickAmountScaleAnim : 1 }],
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.quickBetButtonEnhanced,
                          isSelected && styles.quickBetButtonSelectedEnhanced,
                          { minHeight: MIN_TOUCH_TARGET },
                        ]}
                        onPress={() => handleQuickAmountSelection(amount)}
                        accessibilityLabel={`Quick bet ${amount} dollars`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityHint={`Sets your bet amount to ${amount} dollars${isSelected ? '. Currently selected' : ''}`}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={
                            isSelected
                              ? ['rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 0.1)']
                              : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']
                          }
                          style={styles.quickBetGradientBackground}
                        >
                          <Text
                            style={[styles.quickBetTextEnhanced, isSelected && styles.quickBetTextSelectedEnhanced]}
                          >
                            ${amount}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  )
                })}
              </View>
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
                        +${calculatePotentialPayout(betAmount, race, selectedAssetIdx).profit.toFixed(2)} profit
                      </Text>
                    </View>
                    <View style={styles.previewDivider} />
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabelTotal}>Total Payout</Text>
                      <Text style={styles.previewValueTotal}>
                        ${calculatePotentialPayout(betAmount, race, selectedAssetIdx).totalPayout.toFixed(2)}
                      </Text>
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
                        <Text style={styles.confirmationLabel}>Potential Win</Text>
                        <Text style={[styles.confirmationValue, styles.confirmationWin]}>
                          ${calculatePotentialPayout(betAmount, race, selectedAssetIdx).totalPayout.toFixed(2)}
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
                        <MaterialCommunityIcons name="close" size={24} color="#fff" />
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
                          ? ['#9945FF', '#14F195']
                          : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                      }
                      style={styles.placeBetGradientEnhanced}
                    >
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
    fontFamily: 'Orbitron-Bold',
  },
  welcomeDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Bold',
  },
  stepText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-SemiBold',
  },

  successSection: {
    marginBottom: 20,
  },
  successCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
    shadowColor: 'rgba(0, 255, 136, 0.3)',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  successIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  successIconGradient: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 32,
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
    fontFamily: 'Orbitron-Bold',
  },
  successSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Regular',
  },
  raceInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
  },
  raceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
  },
  raceStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    fontFamily: 'Orbitron-Regular',
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
  assetInfoEnhanced: {
    flex: 1,
    justifyContent: 'center',
  },
  assetSymbolEnhanced: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
    color: COLORS.text.primary,
    fontFamily: 'Orbitron-Bold',
    marginBottom: SPACING.xs / 2,
  },
  assetNameEnhanced: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontFamily: 'Orbitron-Regular',
    lineHeight: isTablet ? 16 : 14,
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
    fontFamily: 'Orbitron-Regular',
  },
  performanceValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  performanceValueEnhanced: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Regular',
    textAlign: 'center',
  },
  metricValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.text.primary,
    fontFamily: 'Orbitron-Bold',
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
  selectionHintText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    marginLeft: SPACING.sm,
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-SemiBold',
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
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: isTablet ? SPACING.md : SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  currencySymbolEnhanced: {
    ...TYPOGRAPHY.title,
    color: COLORS.secondary,
    fontFamily: 'Orbitron-Bold',
    fontWeight: '800',
  },
  currencyLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.text.tertiary,
    fontFamily: 'Orbitron-Regular',
    marginTop: -2,
  },
  betInputEnhanced: {
    flex: 1,
    ...TYPOGRAPHY.title,
    color: COLORS.text.primary,
    paddingVertical: isTablet ? SPACING.lg : SPACING.md,
    fontFamily: 'Orbitron-SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },
  quickBetSectionEnhanced: {
    marginBottom: SPACING.lg,
  },
  quickBetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickBetButtonEnhanced: {
    flex: 1,
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
  quickBetTextEnhanced: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
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
  quickBetTextSelectedEnhanced: {
    color: COLORS.warning,
    fontWeight: '800',
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  quickBetGradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: isTablet ? 12 : 10,
    paddingVertical: isTablet ? SPACING.sm : SPACING.xs,
    paddingHorizontal: SPACING.xs,
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Regular',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  previewWin: {
    color: '#14F195',
  },
  previewDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 10,
  },
  previewLabelTotal: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  previewValueTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-SemiBold',
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
    fontFamily: 'Orbitron-Bold',
  },
  confirmationSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Regular',
  },
  confirmationValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  confirmationWin: {
    color: '#14F195',
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
    flex: 0.8,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmationCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  confirmationConfirmButton: {
    flex: 0.8,
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
  },
  sectionSubtitleEnhanced: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Bold',
  },
  assetSymbolIconEnhanced: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
  },
  errorMessageCommit: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-SemiBold',
  },
  loadingProgressContainer: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  loadingProgressText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
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
  },
  increaseBetText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
  },
  increaseBetSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-SemiBold',
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
    fontFamily: 'Orbitron-SemiBold',
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
    fontFamily: 'Orbitron-Bold',
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
  },
  confirmAdditionalBetText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 1,
  },
})
