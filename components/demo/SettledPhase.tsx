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
import ConfettiCannon from 'react-native-confetti-cannon'
import * as Sharing from 'expo-sharing'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Dimensions,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  captureRef,
  captureScreen,
} from 'react-native-view-shot'

import { useNotification } from '@/components/ui/NotificationProvider'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { useRaceStore } from '../../store/useRaceStore'
import { useClaimPayout } from './use-claim-payout'
import SolanaLogo from '@/components/ui/SolanaLogo'

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

const WinnerAnnouncement = React.memo(
  ({ winnerAsset, raceResults, race, formatValue, handleShare }: {
    winnerAsset: any
    raceResults: any
    race: any
    formatValue: (value: number) => string
    handleShare: () => void
  }) => {
    const shine = useRef(new Animated.Value(0)).current
    const pulse = useRef(new Animated.Value(1)).current
    const [confetti, setConfetti] = useState(true)

    useEffect(() => {
      Animated.loop(
        Animated.timing(shine, { toValue: 1, duration: 2600, useNativeDriver: true }),
      ).start()
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.05, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      ).start()

      const timer = setTimeout(() => setConfetti(false), 2500)
      return () => clearTimeout(timer)
    }, [])

    return (
      <View style={styles.winnerSection}>
        <LinearGradient
          colors={
            raceResults?.raceIntensity === 'extreme'
              ? ['rgba(255, 68, 68, 0.45)', 'rgba(255, 215, 0, 0.35)', 'rgba(0, 0, 0, 0.85)']
              : ['rgba(255, 215, 0, 0.45)', 'rgba(20, 241, 149, 0.25)', 'rgba(0, 0, 0, 0.85)']
          }
          style={styles.winnerCard}
        >
          {/* Shimmer sweep */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.winnerCardShine,
              { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-180, 260] }) }, { rotate: '-18deg' }] },
            ]}
          />

          {/* Share pill */}
          <TouchableOpacity
            style={[styles.winnerShareButton, { minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }]}
            onPress={handleShare}
            accessibilityLabel={`Share race results. ${winnerAsset?.symbol} won with ${typeof winnerAsset?.performance === 'number' && !isNaN(winnerAsset.performance) ? winnerAsset.performance.toFixed(1) : '0.0'}% performance`}
            accessibilityRole="button"
          >
            <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.winnerShareGradient}>
              <MaterialCommunityIcons name="share-variant" size={18} color="#000" />
              <Text style={styles.winnerShareButtonText}>Share</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.winnerContent}>
            {/* Race pill */}
            <View style={styles.racePill}>
              <MaterialCommunityIcons name="flag-checkered" size={12} color="#0B0B0B" />
              <Text style={styles.racePillText}>RACE #{race?.raceId}</Text>
            </View>

            {/* Trophy + halo */}
            <View style={styles.trophyWrap}>
              <View style={styles.trophyHalo} />
              <Animated.View style={{ transform: [{ scale: pulse }] }}>
                <MaterialCommunityIcons
                  name="trophy"
                  size={56}
                  color={raceResults?.raceIntensity === 'extreme' ? '#FF4444' : '#FFD700'}
                />
              </Animated.View>
            </View>

            <View style={styles.winnerTitleContainer}>
              <MaterialCommunityIcons name="star-four-points" size={20} color={COLORS.warning} />
              <Text style={styles.winnerTitle}>Race Complete!</Text>
            </View>
            <Text style={styles.winnerAssetName}>{winnerAsset?.symbol} WINS!</Text>
            <Text style={styles.winnerPerformance}>
              Final Performance: {winnerAsset?.performance >= 0 ? '+' : ''}
              {typeof winnerAsset?.performance === 'number' && !isNaN(winnerAsset.performance)
                ? winnerAsset.performance.toFixed(2)
                : '0.00'}
              %
            </Text>

            <View style={styles.winnerStatsGrid}>
              <View style={styles.winnerStatItem}>
                <Text style={styles.winnerStatValue}>{race?.participantCount || 0}</Text>
                <Text style={styles.winnerStatLabel}>Total Racers</Text>
              </View>
              <View style={styles.winnerStatItem}>
                <Text style={styles.winnerStatValue}>{formatValue(race?.totalPool || 0)}</Text>
                <Text style={styles.winnerStatLabel}>Prize Pool</Text>
              </View>
              <View style={styles.winnerStatItem}>
                <Text style={styles.winnerStatValue}>
                  {Math.floor((raceResults?.raceDuration || 0) / 60)}:{String(Math.floor((raceResults?.raceDuration || 0) % 60)).padStart(2, '0')}
                </Text>
                <Text style={styles.winnerStatLabel}>Race Time</Text>
              </View>
              <View style={styles.winnerStatItem}>
                <Text style={[styles.winnerStatValue, { color: raceResults?.raceIntensity === 'extreme' ? '#FF4444' : '#00FF88' }]}>
                  {typeof raceResults?.performanceSpread === 'number' && !isNaN(raceResults.performanceSpread)
                    ? raceResults.performanceSpread.toFixed(1)
                    : '0.0'}%
                </Text>
                <Text style={styles.winnerStatLabel}>Spread</Text>
              </View>
            </View>
          </View>

          {confetti && (
            <ConfettiCannon
              count={60}
              origin={{ x: screenWidth / 2, y: -10 }}
              fadeOut
              fallSpeed={2800}
              explosionSpeed={350}
            />
          )}
        </LinearGradient>
      </View>
    )
  },
)

interface SettledPhaseProps {
  race: any
  userBet: any
  formatValue: (value: number) => string
  account: any
  isLoading?: boolean
  error?: string | null
}

export const EnhancedSettledPhase = memo(_EnhancedSettledPhase)

function _EnhancedSettledPhase({
  race,
  userBet,
  formatValue,
  account,
  isLoading = false,
  error = null,
}: SettledPhaseProps) {
  const claimPayoutMutation = useClaimPayout()
  const { showSuccess, showError } = useNotification()
  // Use granular selectors to avoid snapshot churn
  const userBets = useRaceStore((s) => s.userBets)
  const fetchRaceDetails = useRaceStore((s) => s.fetchRaceDetails)
  const fetchUserBets = useRaceStore((s) => s.fetchUserBets)
  const connectWebSocket = useRaceStore((s) => s.connectWebSocket)
  const subscribeToRace = useRaceStore((s) => s.subscribeToRace)
  const isConnected = useRaceStore((s) => s.isConnected)
  const playerAddress = account?.publicKey?.toBase58 ? account.publicKey.toBase58() : account?.publicKey?.toString?.()

  // One-time fetch on mount/when race changes: get final race state, then bets if needed
  React.useEffect(() => {
    if (!race?.raceId) return
    fetchRaceDetails(race.raceId, false)
    if (playerAddress) {
      // Fetch bets once for display; claim flow will force refresh later
      fetchUserBets(playerAddress, true)
    }
  }, [race?.raceId, playerAddress, fetchRaceDetails, fetchUserBets])

  // Connect to websocket for real-time settled phase updates
  React.useEffect(() => {
    if (!race?.raceId) return
    if (!isConnected) {
      connectWebSocket().then(() => {
        if (race.raceId) {
          subscribeToRace(race.raceId)
          console.log(`🔌 Connected to websocket for settled phase updates on race ${race.raceId}`)
        }
      })
    } else {
      subscribeToRace(race.raceId)
    }
  }, [race?.raceId, isConnected, connectWebSocket, subscribeToRace])

  const derivedUserBet = React.useMemo(() => {
    if (userBet) return userBet
    if (userBets && race?.raceId) {
      return userBets.find((bet: any) => bet.raceId === race.raceId)
    }
    return undefined
  }, [userBet, userBets, race?.raceId])

  // Removed duplicate data fetching - the claim mutation success handler already refreshes data

  const celebrationAnim = useRef(new Animated.Value(0)).current
  const winnerGlowAnim = useRef(new Animated.Value(0)).current

  const claimButtonScaleAnim = useRef(new Animated.Value(1)).current
  const shareButtonPulseAnim = useRef(new Animated.Value(1)).current
  // Ref to capture only the winner announcement card
  const shareCaptureRef = useRef<View>(null)
  const confettiAnim = useRef(new Animated.Value(0)).current
  const sparkleAnim = useRef(new Animated.Value(0)).current
  // Congrats card animations
  const congratsShimmer = useRef(new Animated.Value(0)).current
  const payoutPulse = useRef(new Animated.Value(1)).current

  const animationRefs = useRef<Animated.CompositeAnimation[]>([])

  // Analytics section removed
  const [reduceMotion, setReduceMotion] = useState(ANIMATION_REDUCE_MOTION)

  const lastHapticTime = useRef(0)
  const hasTriggeredEntryHaptic = useRef(false)

  const [localClaimUpdate, setLocalClaimUpdate] = useState(false)

  const isClaimingPayout = claimPayoutMutation.isPending

  const triggerHaptic = useCallback(async (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection') => {
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
    } catch (error) {}
  }, [])

  // Poll for final settlement while backend finalizes results, then stop automatically
  const settlePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!race?.raceId) return

    const hasFinalizedPrices = Array.isArray(race?.assets)
      ? race.assets.every((a: any) => typeof a?.endPrice === 'number')
      : false
    const fullySettled = race?.state === 'Settled' && hasFinalizedPrices

    if (fullySettled) {
      if (settlePollRef.current) {
        clearInterval(settlePollRef.current as any)
        settlePollRef.current = null
      }
      return
    }

    if (settlePollRef.current) return

    const fetchLatest = async () => {
      try {
        await useRaceStore.getState().fetchRaceDetails(race.raceId, false)
      } catch (_) {}
    }

    fetchLatest()
    settlePollRef.current = setInterval(fetchLatest, 2000)

    const stopTimer = setTimeout(() => {
      if (settlePollRef.current) {
        clearInterval(settlePollRef.current as any)
        settlePollRef.current = null
      }
    }, 120000) // hard stop after 2 minutes

    return () => {
      if (settlePollRef.current) {
        clearInterval(settlePollRef.current as any)
        settlePollRef.current = null
      }
      clearTimeout(stopTimer as any)
    }
  }, [race?.raceId, race?.state, Array.isArray(race?.assets) ? race.assets.length : 0, playerAddress])

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
    return () => {
      animationRefs.current.forEach((animation) => {
        animation.stop()
      })
      animationRefs.current = []
    }
  }, [])

  // Loop shimmer and payout pulse for the shareable congrats card
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(congratsShimmer, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(payoutPulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(payoutPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    )
    shimmer.start()
    pulse.start()
    return () => {
      shimmer.stop()
      pulse.stop()
      congratsShimmer.setValue(0)
      payoutPulse.setValue(1)
    }
  }, [])

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle" size={48} color={COLORS.error} accessibilityLabel="Error icon" />
        <Text style={styles.errorTitle}>Unable to Load Race Results</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons
          name="loading"
          size={48}
          color={COLORS.primary}
          accessibilityLabel="Loading race results"
        />
        <Text style={styles.loadingText}>Calculating Results...</Text>
      </View>
    )
  }

  if (!race) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="trophy-outline"
          size={48}
          color={COLORS.text.tertiary}
          accessibilityLabel="No race data"
        />
        <Text style={styles.emptyTitle}>No Race Data</Text>
        <Text style={styles.emptyMessage}>Race results are not available yet.</Text>
      </View>
    )
  }

  // Optimized asset performance calculations with granular memoization
  const rawAssetData = useMemo(() => {
    if (!race?.assets) return []
    return race.assets.map((asset: any, index: number) => ({ asset, index }))
  }, [race?.assets])

  const poolData = useMemo(() => ({
    totalPool: race?.totalPool || 0,
    assetPools: race?.assetPools || [],
    participantCount: race?.participantCount || 0,
  }), [race?.totalPool, race?.assetPools, race?.participantCount])

  const assetPerformances = useMemo(() => {
    if (!rawAssetData.length) return []

    return rawAssetData
      .map(({ asset, index }: { asset: any; index: number }) => {
        const startPrice = asset.startPrice || 100
        // Prefer endPrice when present; otherwise fallback to leaderboard/current
        const endPrice =
          typeof asset.endPrice === 'number'
            ? asset.endPrice
            : typeof asset.currentPrice === 'number'
              ? asset.currentPrice
              : startPrice

        // Optimized performance calculation
        const performance = (startPrice > 0 && typeof startPrice === 'number' && typeof endPrice === 'number')
          ? ((endPrice - startPrice) / startPrice) * 100
          : 0

        const assetPool = poolData.assetPools[index] || 0
        const poolShare = poolData.totalPool > 0 ? (assetPool / poolData.totalPool) * 100 : 0

        return {
          ...asset,
          index,
          performance,
          startPrice,
          endPrice,
          poolShare,
          participantCount: Math.floor((poolShare * poolData.participantCount) / 100),
        }
      })
      .sort((a: any, b: any) => b.performance - a.performance)
  }, [rawAssetData, poolData])

  const raceResults = useMemo(() => {
    if (!assetPerformances.length) return null

    const maxPerformance = Math.max(...assetPerformances.map((a: any) => a.performance))
    const winnerAssets = assetPerformances.filter((a: any) => Math.abs(a.performance - maxPerformance) < 0.001)
    const winnerAsset = winnerAssets[0]

    const performanceSpread =
      Math.max(...assetPerformances.map((a: any) => a.performance)) -
      Math.min(...assetPerformances.map((a: any) => a.performance))
    const avgPerformance =
      assetPerformances.reduce((sum: number, a: any) => sum + a.performance, 0) / assetPerformances.length

    const raceIntensity =
      performanceSpread > 5 ? 'extreme' : performanceSpread > 2 ? 'high' : performanceSpread > 1 ? 'medium' : 'low'

    return {
      winnerAsset,
      winnerAssets,
      maxPerformance,
      performanceSpread,
      avgPerformance,
      raceIntensity,
      raceDuration: race?.settleTs - race?.lockTs || 0,
    }
  }, [assetPerformances, race?.settleTs, race?.lockTs])

  const claimed = useMemo(() => {
    const claimedStatus = derivedUserBet?.claimed || localClaimUpdate
    console.log(`🔍 Claimed status check:`, {
      userBetClaimed: derivedUserBet?.claimed,
      localClaimUpdate,
      finalClaimedStatus: claimedStatus,
      userBetAmount: derivedUserBet?.amount,
      raceId: race?.raceId,
    })
    return claimedStatus
  }, [derivedUserBet?.claimed, localClaimUpdate, race?.raceId])

  const userPosition = useMemo(() => {
    if (!derivedUserBet || !assetPerformances.length || !raceResults) return null

    const userAsset = assetPerformances.find((a: any) => a.index === derivedUserBet.assetIdx)
    if (!userAsset) return null

    const originalAmount = derivedUserBet.amount / 1_000_000
    const isActualWinner = raceResults.winnerAssets.some((w: any) => w.index === derivedUserBet.assetIdx)

    let actualPayout = 0
    let claimableAmount = 0

    if (isActualWinner) {
      const totalPool = race?.totalPool || 0
      const winningPool = race?.assetPools?.[derivedUserBet.assetIdx] || 0
      const feeRate = 0.05
      const netPool = totalPool * (1 - feeRate)

      if (winningPool > 0 && totalPool > 0) {
        const userShareOfWinningPool = derivedUserBet.amount / 1_000_000 / (winningPool / 1_000_000)
        claimableAmount = userShareOfWinningPool * (netPool / 1_000_000)
        actualPayout = claimableAmount - originalAmount
      }
    }

    return {
      asset: userAsset,
      originalAmount,
      actualPayout,
      claimableAmount,
      isWinner: isActualWinner,
      totalParticipants: race?.participantCount || 0,
      finalPerformance: userAsset.performance,
      performanceVsWinner: userAsset.performance - raceResults.maxPerformance,
    }
  }, [derivedUserBet, assetPerformances, raceResults, race?.totalPool, race?.assetPools, race?.participantCount])

  const isWinner = userPosition?.isWinner || false
  const winnerAsset = raceResults?.winnerAsset

  useEffect(() => {
    if (userPosition && !hasTriggeredEntryHaptic.current) {
      hasTriggeredEntryHaptic.current = true

      if (isWinner) {
        setTimeout(() => triggerHaptic('success'), 100)
        setTimeout(() => triggerHaptic('medium'), 300)
        setTimeout(() => triggerHaptic('light'), 500)
      } else if (userPosition && !isWinner) {
        setTimeout(() => triggerHaptic('light'), 200)
      }
    }
  }, [userPosition, isWinner, triggerHaptic])

  useEffect(() => {
    if (userPosition) {
      const resultAnimation = Animated.spring(celebrationAnim, {
        toValue: 1,
        tension: isWinner ? 80 : 100,
        friction: isWinner ? 6 : 8,
        useNativeDriver: true,
      })

      animationRefs.current.push(resultAnimation)
      resultAnimation.start()

      if (isWinner && !reduceMotion) {
        const confettiAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(confettiAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(confettiAnim, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 3 },
        )
        animationRefs.current.push(confettiAnimation)
        confettiAnimation.start()

        const sparkleAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(sparkleAnim, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(sparkleAnim, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 5 },
        )
        animationRefs.current.push(sparkleAnimation)
        sparkleAnimation.start()

        const glowAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(winnerGlowAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(winnerGlowAnim, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
        )
        animationRefs.current.push(glowAnimation)
        glowAnimation.start()
      }
    }
  }, [userPosition, isWinner, reduceMotion])

  // Removed: full results animations

  useEffect(() => {
    setLocalClaimUpdate(false)
  }, [race?.raceId])

  useEffect(() => {
    if (isWinner && !claimed && !reduceMotion) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(claimButtonScaleAnim, {
            toValue: 1.02,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(claimButtonScaleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      )
      animationRefs.current.push(pulseAnimation)
      pulseAnimation.start()

      return () => pulseAnimation.stop()
    }
  }, [isWinner, claimed, reduceMotion])

  useEffect(() => {
    if (!reduceMotion) {
      const shareAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(shareButtonPulseAnim, {
            toValue: 1.01,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(shareButtonPulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      )
      animationRefs.current.push(shareAnimation)
      shareAnimation.start()

      return () => shareAnimation.stop()
    }
  }, [reduceMotion])

  const handleClaimPayout = useCallback(async () => {
    if (!userPosition?.isWinner || claimPayoutMutation.isPending || !account?.publicKey || !race || claimed) return

    triggerHaptic('medium')

    // Start press animation
    Animated.sequence([
      Animated.timing(claimButtonScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(claimButtonScaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start()

    try {
      console.log(`💰 Claiming ${userPosition.claimableAmount.toFixed(2)} USDC for race ${race.raceId}`)

      await claimPayoutMutation.mutateAsync({
        raceId: race.raceId,
        playerAddress: account.publicKey,
      })

      // Mark as claimed only after successful tx
      setLocalClaimUpdate(true)
      // UX toast
      showSuccess(`Payout claimed: $${userPosition.claimableAmount.toFixed(2)}`, 'Reward Claimed')

      setTimeout(() => triggerHaptic('success'), 200)
      setTimeout(() => triggerHaptic('light'), 400)

      console.log(`✅ Payout claim submitted successfully`)
    } catch (error) {
      // Revert optimistic update on error
      setLocalClaimUpdate(false)
      triggerHaptic('error')
      showError('Failed to claim payout. You can try again.', 'Claim Failed')
      console.error('Failed to claim payout:', error)
    }
  }, [userPosition, claimPayoutMutation, account, race, claimed, triggerHaptic, showSuccess, showError])

  const handleShare = useCallback(async () => {
    triggerHaptic('light')

    Animated.sequence([
      Animated.timing(shareButtonPulseAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(shareButtonPulseAnim, {
        toValue: 1,
        tension: 150,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start()

    try {
      // Attempt to capture only the winner section
      let uri: string | undefined
      if (shareCaptureRef.current) {
        uri = await captureRef(shareCaptureRef.current, {
          format: 'png',
          quality: 0.9,
          result: 'tmpfile',
          backgroundColor: '#000000',
        })
      }
      // Fallback to full screen if specific capture fails
      if (!uri) {
        uri = await captureScreen({ format: 'png', quality: 0.9, backgroundColor: '#000000' as any })
      }
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: '🏆 I WON on Momentum Madness!',
        })
        return
      }

      // Fallback to plain text share if image capture or sharing fails
      const returnPercentage = userPosition && userPosition.originalAmount > 0
        ? (userPosition.actualPayout / userPosition.originalAmount) * 100
        : 0
      await Share.share({
        message:
          `I just won $${userPosition?.claimableAmount.toFixed(2)} with a +${returnPercentage.toFixed(0)}% return! 🚀\n\n` +
          `🥇 My winning ${userPosition?.asset.symbol} pick: +${userPosition?.finalPerformance.toFixed(2)}%\n` +
          `👥 Beat ${userPosition?.totalParticipants - 1} other racers\n` +
          `🎯 Race Intensity: ${raceResults?.raceIntensity.toUpperCase()}\n\n` +
          `Think you can beat me? Join the race! 🏁`,
        title: '🏆 I WON on Momentum Madness!',
        url: undefined,
      })

      triggerHaptic('selection')
    } catch (error) {
      console.error('Error sharing:', error)
      triggerHaptic('error')
    }
  }, [userPosition, raceResults, winnerAsset, race, formatValue, triggerHaptic])

  // Removed: show results toggle

  // Removed: analytics toggle

  return (
    <View style={styles.settledContainer}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <WinnerAnnouncement
          winnerAsset={winnerAsset}
          raceResults={raceResults}
          race={race}
          formatValue={formatValue}
          handleShare={handleShare}
        />

        {derivedUserBet && account ? (
          <Animated.View
            style={[
              styles.userResultSection,
              {
                opacity: celebrationAnim,
                transform: [
                  {
                    translateY: celebrationAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={
                isWinner
                  ? ['rgba(0, 255, 136, 0.4)', 'rgba(255, 215, 0, 0.2)', 'rgba(0, 0, 0, 0.8)']
                  : ['rgba(255, 68, 68, 0.3)', 'rgba(255, 68, 68, 0.1)', 'rgba(0, 0, 0, 0.8)']
              }
              style={styles.userResultCard}
            >
              {/* Shimmer overlay for share appeal */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.userCardShine,
                  {
                    transform: [
                      { translateX: congratsShimmer.interpolate({ inputRange: [0, 1], outputRange: [-220, 320] }) },
                      { rotate: '-18deg' },
                    ],
                  },
                ]}
              />

              {/* Congrats/Settled ribbon */}
              <View style={[styles.congratsRibbon, isWinner ? styles.congratsRibbonWin : styles.congratsRibbonLose]}>
                <MaterialCommunityIcons name={isWinner ? 'party-popper' : 'flag-checkered'} size={12} color="#0B0B0B" />
                <Text style={styles.congratsRibbonText}>{isWinner ? 'CONGRATS' : 'SETTLED'}</Text>
              </View>
              {/* Share-capture-only area starts */}
              <View ref={shareCaptureRef} collapsable={false} style={styles.shareCapture}>
                <LinearGradient
                  colors={
                    isWinner
                      ? ['#0A3322', '#0A0A0A', '#000000']
                      : ['#331414', '#0A0A0A', '#000000']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.shareCaptureBg}
                />
                <View style={styles.shareCaptureScrim} />
              
              <View style={styles.userResultHeader}>
                <Animated.View
                  style={[
                    styles.userResultIcon,
                    isWinner && {
                      shadowColor: '#00FF88',
                      shadowOpacity: winnerGlowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 0.8],
                      }),
                      shadowRadius: 20,
                      elevation: 10,
                    },
                    isWinner &&
                      !reduceMotion && {
                        transform: [
                          {
                            rotate: sparkleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '360deg'],
                            }),
                          },
                        ],
                      },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isWinner ? 'trophy-award' : 'close-circle'}
                    size={40}
                    color={isWinner ? '#00FF88' : '#FF4444'}
                  />
                  {isWinner && (
                    <View style={[styles.confettiOverlay, { opacity: 0.9 }]}>
                      <MaterialCommunityIcons name="star-four-points" size={16} color="#FFD700" />
                      <MaterialCommunityIcons name="star-four-points" size={12} color="#00FF88" />
                      <MaterialCommunityIcons name="star-four-points" size={14} color="#9945FF" />
                    </View>
                  )}
                </Animated.View>

                <View style={styles.userResultInfo}>
                  <View style={styles.userResultTitleContainer}>
                    <MaterialCommunityIcons
                      name={isWinner ? 'party-popper' : 'emoticon-sad'}
                      size={18}
                      color={isWinner ? '#00FF88' : '#FF4444'}
                    />
                    <Text style={[styles.userResultTitle, { color: isWinner ? '#00FF88' : '#FF4444' }]}>
                      {isWinner ? 'Congratulations!' : 'Almost There!'}
                    </Text>
                  </View>
                  <Text style={styles.userResultSubtitle}>
                    {isWinner ? 'You picked the winner!' : 'Better luck next race!'}
                  </Text>
                </View>
                {/* Asset badge for sharing */}
                <View style={styles.assetBadgeLarge}>
                  <View style={styles.assetRingLarge} />
                  {userPosition?.asset?.symbol === 'BTC' ? (
                    <View style={styles.assetIconCircleBtc}>
                      <MaterialCommunityIcons name="currency-btc" size={18} color="#000" />
                    </View>
                  ) : userPosition?.asset?.symbol === 'ETH' ? (
                    <View style={styles.assetIconCircleEth}>
                      <MaterialCommunityIcons name="ethereum" size={18} color="#fff" />
                    </View>
                  ) : userPosition?.asset?.symbol === 'SOL' ? (
                    <View style={styles.assetIconCircleSol}>
                      <SolanaLogo size={18} />
                    </View>
                  ) : (
                    <View style={[styles.assetDotLarge, { backgroundColor: userPosition?.asset.color }]} />
                  )}
                  <Text style={styles.assetBadgeText}>{userPosition?.asset.symbol}</Text>
                </View>
              </View>
              {/* Payout hero row */}
              <View style={styles.payoutHero}>
                <Animated.Text style={[styles.payoutAmount, { transform: [{ scale: payoutPulse }] }]}>
                  {isWinner ? `$${userPosition?.claimableAmount.toFixed(2)}` : '$0.00'}
                </Animated.Text>
                <Text style={styles.payoutLabel}>{isWinner ? 'Claimable' : 'No Payout'}</Text>
                {isWinner && (
                  <View style={styles.roiPill}>
                    <MaterialCommunityIcons name="trending-up" size={12} color="#0B0B0B" />
                    <Text style={styles.roiText}>
                      {(() => {
                        const orig = userPosition?.originalAmount || 0
                        const claim = userPosition?.claimableAmount || 0
                        const mult = orig > 0 ? claim / orig : 0
                        return `${mult.toFixed(2)}x`
                      })()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.betSummarySection}>
                <View style={styles.betSummaryRow}>
                  <Text style={styles.betSummaryLabel}>Your Pick</Text>
                  <View style={styles.betSummaryValue}>
                    <View style={[styles.assetDotSmall, { backgroundColor: userPosition?.asset?.color }]} />
                    <Text style={styles.betSummaryText}>{userPosition?.asset?.symbol}</Text>
                    {userPosition?.isWinner && (
                      <View style={styles.winnerBadge}>
                        <MaterialCommunityIcons name="trophy" size={12} color="#000" />
                        <Text style={styles.winnerBadgeText}>WINNER</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.betSummaryRow}>
                  <Text style={styles.betSummaryLabel}>Amount Bet</Text>
                  <Text style={styles.betSummaryText}>${userPosition?.originalAmount.toFixed(2)}</Text>
                </View>

                <View style={styles.betSummaryRow}>
                  <Text style={styles.betSummaryLabel}>Final Performance</Text>
                  <Text
                    style={[
                      styles.betSummaryText,
                      { color: userPosition?.finalPerformance >= 0 ? '#00FF88' : '#FF4444' },
                    ]}
                  >
                    {userPosition?.finalPerformance >= 0 ? '+' : ''}
                    {typeof userPosition?.finalPerformance === 'number' && !isNaN(userPosition.finalPerformance)
                      ? userPosition.finalPerformance.toFixed(2)
                      : '0.00'}
                    %
                  </Text>
                </View>

                <View style={styles.betSummaryRow}>
                  <Text style={styles.betSummaryLabel}>vs Winner</Text>
                  <Text
                    style={[
                      styles.betSummaryText,
                      { color: (userPosition?.performanceVsWinner || 0) >= 0 ? '#00FF88' : '#FF4444' },
                    ]}
                  >
                    {(userPosition?.performanceVsWinner || 0) >= 0 ? '+' : ''}
                    {(userPosition?.performanceVsWinner || 0).toFixed(2)}%
                  </Text>
                </View>

                {isWinner ? (
                  <>
                    <View style={styles.betSummaryDivider} />
                    <View style={styles.betSummaryRow}>
                      <View style={styles.betSummaryLabelWithIcon}>
                        <MaterialCommunityIcons name="trophy" size={14} color="#FFD700" />
                        <Text style={[styles.betSummaryLabel, { color: '#FFD700' }]}>Net Profit</Text>
                      </View>
                      <Text style={[styles.betSummaryText, { color: '#FFD700', fontSize: 18, fontWeight: '800' }]}>
                        +${userPosition?.actualPayout.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.betSummaryRow}>
                      <View style={styles.betSummaryLabelWithIcon}>
                        <MaterialCommunityIcons name="wallet-plus" size={14} color="#00FF88" />
                        <Text style={[styles.betSummaryLabel, { color: '#00FF88' }]}>Total Claimable</Text>
                      </View>
                      <Text style={[styles.betSummaryText, { color: '#00FF88', fontSize: 16, fontWeight: '700' }]}>
                        ${userPosition?.claimableAmount.toFixed(2)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.betSummaryDivider} />
                    {/* Winner recap pill */}
                    <View style={styles.loserInsights}>
                      <View style={styles.winnerPill}>
                        <MaterialCommunityIcons name="trophy" size={12} color="#0B0B0B" />
                        <Text style={styles.winnerPillText}>
                          Winner: {raceResults?.winnerAsset?.symbol} ({raceResults?.winnerAsset?.performance >= 0 ? '+' : ''}{typeof raceResults?.winnerAsset?.performance === 'number' && !isNaN(raceResults.winnerAsset.performance) ? raceResults?.winnerAsset?.performance?.toFixed(2) : '0.00'}%)
                        </Text>
                      </View>
                      {/* Behind bar */}
                      <View style={styles.gapBarContainer}>
                        <Text style={styles.gapBarLabel}>Behind by {(Math.abs(userPosition?.performanceVsWinner || 0)).toFixed(2)}%</Text>
                        <View style={styles.gapTrack}>
                          <View
                            style={[
                              styles.gapFill,
                              {
                                width: `${Math.min(100, Math.max(0, (Math.abs(userPosition?.performanceVsWinner || 0) / 5) * 100))}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                    <View style={styles.betSummaryRow}>
                      <View style={styles.betSummaryLabelWithIcon}>
                        <MaterialCommunityIcons name="chart-line-variant" size={14} color="#FF4444" />
                        <Text style={[styles.betSummaryLabel, { color: '#FF4444' }]}>Result</Text>
                      </View>
                      <Text style={[styles.betSummaryText, { color: '#FF4444', fontSize: 16, fontWeight: '700' }]}>
                        -${userPosition?.originalAmount.toFixed(2)} (Total Loss)
                      </Text>
                    </View>
                  </>
                )}

                <View style={styles.positionSummary}>
                  <Text style={styles.positionSummaryText}>
                    {userPosition?.isWinner ? 'Winner! ' : 'Participated in race with '}
                    {userPosition?.totalParticipants} total racers
                  </Text>
                </View>
              </View>
              {/* Share-capture-only area ends */}
              </View>

              <View style={styles.actionButtonsSection}>
                {isWinner && claimed
                  ? (() => {
                      console.log(`🎉 Rendering CLAIMED status for race ${race?.raceId}`)
                      return (
                        <View style={styles.claimedContainer}>
                          <LinearGradient
                            colors={['rgba(0, 255, 136, 0.3)', 'rgba(255, 215, 0, 0.2)', 'rgba(0, 0, 0, 0.8)']}
                            style={styles.claimedButton}
                          >
                            <View style={styles.claimedIconContainer}>
                              <MaterialCommunityIcons name="check-decagram" size={24} color="#FFD700" />
                              <View style={styles.claimedGlow} />
                            </View>
                            <View style={styles.claimedTextContainer}>
                              <View style={styles.claimedTitleRow}>
                                <MaterialCommunityIcons name="check-circle" size={18} color="#00FF88" />
                                <Text style={styles.claimedTitle}>Reward Claimed!</Text>
                              </View>
                              <Text style={styles.claimedSubtitle}>
                                ${userPosition?.claimableAmount.toFixed(2)} secured in your wallet
                              </Text>
                            </View>
                            <View style={styles.claimedBadge}>
                              <MaterialCommunityIcons name="wallet-plus" size={16} color="#000" />
                              <Text style={styles.claimedBadgeText}>PAID</Text>
                            </View>
                          </LinearGradient>
                        </View>
                      )
                    })()
                  : isWinner && !claimed
                    ? (() => {
                        console.log(`💰 Rendering CLAIM BUTTON for race ${race?.raceId}`)
                        return (
                          <Animated.View
                            style={{
                              transform: [{ scale: claimButtonScaleAnim }],
                            }}
                          >
                            <TouchableOpacity
                              style={[styles.claimButton, { minHeight: MIN_TOUCH_TARGET }]}
                              onPress={handleClaimPayout}
                              disabled={isClaimingPayout}
                              activeOpacity={0.9}
                              accessibilityLabel={`Claim payout of ${userPosition?.claimableAmount.toFixed(2)} dollars`}
                              accessibilityRole="button"
                              accessibilityState={{ disabled: isClaimingPayout }}
                              accessibilityHint="Initiates the payout claim process for your winning bet"
                            >
                              <LinearGradient
                                colors={
                                  isClaimingPayout
                                    ? ['rgba(0, 255, 136, 0.5)', 'rgba(255, 215, 0, 0.5)']
                                    : ['#00FF88', '#FFD700']
                                }
                                style={styles.claimButtonGradient}
                              >
                                {isClaimingPayout ? (
                                  <MaterialCommunityIcons name="loading" size={20} color="#000" />
                                ) : (
                                  <MaterialCommunityIcons name="wallet-plus" size={20} color="#000" />
                                )}
                                <Text style={styles.claimButtonText}>
                                  {isClaimingPayout
                                    ? 'Claiming...'
                                    : `Claim $${userPosition?.claimableAmount.toFixed(2)}`}
                                </Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          </Animated.View>
                        )
                      })()
                  : (() => {
                        console.log(`❌ No action button rendered - isWinner: ${isWinner}, claimed: ${claimed}`)
                        return null
                      })()}

                <Animated.View
                  style={{
                    transform: [{ scale: shareButtonPulseAnim }],
                  }}
                >
                  <TouchableOpacity
                    style={[styles.shareResultsButton, { minHeight: MIN_TOUCH_TARGET }]}
                    onPress={handleShare}
                    activeOpacity={0.9}
                    accessibilityLabel={
                      isWinner
                        ? `Share your victory. You won ${userPosition?.claimableAmount.toFixed(2)} dollars`
                        : `Share your race results. Your ${userPosition?.asset?.symbol} pick performed ${userPosition?.finalPerformance >= 0 ? '+' : ''}${userPosition?.finalPerformance.toFixed(1)}%`
                    }
                    accessibilityRole="button"
                    accessibilityHint="Opens sharing options to tell others about your race performance"
                  >
                    <MaterialCommunityIcons name="share-variant" size={18} color={isWinner ? '#FFD700' : '#9945FF'} />
                    <MaterialCommunityIcons
                      name={isWinner ? 'trophy' : 'flag-checkered'}
                      size={14}
                      color={isWinner ? '#FFD700' : '#9945FF'}
                    />
                    <Text style={[styles.shareResultsButtonText, { color: isWinner ? '#FFD700' : '#9945FF' }]}>
                      {isWinner ? 'Share Victory' : 'Share Results'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                {/* Removed show results toggle per request */}
              </View>
            </LinearGradient>
          </Animated.View>
        ) : (
          <View style={styles.spectatorCard}>
            <LinearGradient
              colors={['rgba(153,69,255,0.25)', 'rgba(20,241,149,0.15)', 'rgba(0,0,0,0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.spectatorGradient}
            >
              {/* Spectator ribbon */}
              <View style={styles.spectatorRibbon}>
                <MaterialCommunityIcons name="eye-outline" size={12} color="#0B0B0B" />
                <Text style={styles.spectatorRibbonText}>SPECTATOR</Text>
              </View>

              <View style={styles.spectatorContent}>
                <View style={styles.spectatorHeroIcon}>
                  <MaterialCommunityIcons name="podium-gold" size={32} color="#FFD700" />
                  <View style={styles.spectatorHalo} />
                </View>
                <Text style={styles.spectatorTitle}>Race Spectator</Text>
                <Text style={styles.spectatorDescription}>
                  You watched this {raceResults?.raceIntensity} race. Next race starts soon — jump in!
                </Text>
                <View style={styles.spectatorStats}>
                  <View style={styles.spectatorStatRow}>
                    <MaterialCommunityIcons name="trophy" size={14} color="#FFD700" />
                    <Text style={styles.spectatorStatsText}>
                      Winner: {winnerAsset?.symbol} (+{winnerAsset?.performance.toFixed(2)}%)
                    </Text>
                  </View>
                  <View style={styles.spectatorStatRow}>
                    <MaterialCommunityIcons name="wallet" size={14} color="#00FF88" />
                    <Text style={styles.spectatorStatsText}>Total Pool: {formatValue(race?.totalPool || 0)}</Text>
                  </View>
                  <View style={styles.spectatorStatRow}>
                    <MaterialCommunityIcons name="chart-line" size={14} color="#9945FF" />
                    <Text style={styles.spectatorStatsText}>
                      Spread: {raceResults?.performanceSpread.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                

                
              </View>
            </LinearGradient>
          </View>
        )}

        

        

        <View style={styles.nextRaceSection}>
          <LinearGradient
            colors={['rgba(153, 69, 255, 0.2)', 'rgba(20, 241, 149, 0.1)', 'rgba(0, 0, 0, 0.8)']}
            style={styles.nextRaceCard}
          >
            <View style={styles.nextRaceHeader}>
              <MaterialCommunityIcons name="flag-checkered" size={24} color="#9945FF" />
              <View>
                <Text style={styles.nextRaceTitle}>Next Race Starting Soon!</Text>
                <Text style={styles.nextRaceSubtitle}>Race #{(race?.raceId || 0) + 1}</Text>
              </View>
            </View>

            <View style={styles.nextRaceStats}>
              <Text style={[styles.nextRaceCountdown, { color: '#9945FF' }]}>Next race will begin soon</Text>
              <Text style={styles.nextRacePool}>Stay tuned for exciting new opportunities!</Text>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  settledContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingBottom: 20,
  },

  winnerSection: {
    marginBottom: SPACING.xl,
    marginHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
    zIndex: 2,
  },
  winnerCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    overflow: 'hidden',
    position: 'relative',
  },
  winnerCardShine: {
    position: 'absolute',
    top: -80,
    left: -180,
    width: 200,
    height: 280,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
  },
  trophyWrap: { marginTop: 8, marginBottom: 6, alignItems: 'center', justifyContent: 'center' },
  trophyHalo: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,215,0,0.12)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.6,
    shadowRadius: 18,
  },
  winnerContent: {
    alignItems: 'center',
  },
  winnerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  winnerTitle: {
    ...TYPOGRAPHY.title,
    fontWeight: '800',
    color: COLORS.warning,
    fontFamily: 'Sora-Bold',
  },
  winnerAssetName: {
    ...TYPOGRAPHY.display,
    fontWeight: '900',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    fontFamily: 'Sora-ExtraBold',
    letterSpacing: isTablet ? 1.2 : 0.8,
  },
  winnerPerformance: {
    fontSize: 16,
    color: '#00FF88',
    marginBottom: 20,
    fontFamily: 'Inter-SemiBold',
  },
  racePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  racePillText: { fontSize: 10, color: '#0B0B0B', fontFamily: 'Inter-SemiBold' },
  winnerStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  winnerStatItem: {
    alignItems: 'center',
  },
  winnerStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  winnerStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },

  userResultSection: {
    marginBottom: SPACING.xl,
    marginHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
  },
  userResultCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
  },
  shareCapture: {
    paddingTop: 0,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  shareCaptureBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  shareCaptureScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
  },
  userCardShine: {
    position: 'absolute',
    top: -120,
    left: -240,
    width: 260,
    height: 360,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    zIndex: 1,
  },
  userResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userResultIcon: {
    marginRight: 16,
  },
  userResultInfo: {
    flex: 1,
  },
  userResultTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  userResultTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
    fontFamily: 'Sora-Bold',
  },
  userResultSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    fontFamily: 'Inter-Regular',
  },

  betSummarySection: {
    marginBottom: 16,
    gap: 8,
  },
  loserInsights: { gap: 8 },
  winnerPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  winnerPillText: {
    fontSize: 10,
    color: '#0B0B0B',
    fontFamily: 'Inter-SemiBold',
  },
  gapBarContainer: {
    marginTop: 4,
  },
  gapBarLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    fontFamily: 'Inter-Regular',
  },
  gapTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  gapFill: {
    height: '100%',
    backgroundColor: '#FF4444',
    borderRadius: 3,
  },
  congratsRibbon: {
    position: 'absolute',
    top: 12,
    left: 8,
    transform: [{ rotate: '-10deg' }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 20,
  },
  congratsRibbonWin: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderColor: 'rgba(0, 255, 136, 0.5)',
  },
  congratsRibbonLose: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: 'rgba(255, 215, 0, 0.45)',
  },
  congratsRibbonText: {
    fontSize: 10,
    color: '#0B0B0B',
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.5,
  },
  assetBadgeLarge: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: 54,
    borderRadius: 27,
    marginLeft: 8,
  },
  assetRingLarge: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  assetDotLarge: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  assetIconCircleBtc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F7931A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  assetIconCircleEth: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#627EEA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  assetIconCircleSol: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  assetBadgeText: {
    position: 'absolute',
    bottom: -14,
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Inter-SemiBold',
  },
  payoutHero: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  payoutAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFD700',
    fontFamily: 'Sora-ExtraBold',
    letterSpacing: 0.4,
  },
  payoutLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  roiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD700',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginTop: 8,
  },
  roiText: {
    fontSize: 12,
    color: '#0B0B0B',
    fontFamily: 'Inter-SemiBold',
  },
  betSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  betSummaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
  },
  betSummaryLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  betSummaryValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  betSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  assetDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  betSummaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 8,
  },

  actionButtonsSection: {
    gap: 12,
  },
  claimButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  claimButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  claimButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Sora-Bold',
  },

  claimedContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  claimedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    position: 'relative',
  },
  claimedIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimedGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    top: -8,
    left: -8,
  },
  claimedTextContainer: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'flex-start',
  },
  claimedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  claimedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFD700',
    fontFamily: 'Sora-ExtraBold',
    letterSpacing: 0.5,
  },
  claimedSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Inter-SemiBold',
    marginTop: 2,
    lineHeight: 16,
  },
  claimedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  claimedBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
    fontFamily: 'Sora-Bold',
    marginLeft: 4,
    letterSpacing: 0.4,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
    backgroundColor: 'rgba(153, 69, 255, 0.1)',
  },
  detailsButtonText: {
    fontSize: 14,
    color: '#9945FF',
    marginRight: 8,
    fontFamily: 'Inter-SemiBold',
  },
  

  

  nextRaceSection: {
    marginBottom: 20,
    marginHorizontal: 20,
  },
  nextRaceCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
  },
  nextRaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nextRaceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 12,
    fontFamily: 'Sora-Bold',
  },
  nextRaceSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 12,
    fontFamily: 'Inter-Regular',
  },
  nextRaceStats: {
    marginBottom: 16,
  },
  nextRaceCountdown: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9945FF',
    textAlign: 'center',
    fontFamily: 'Sora-Bold',
  },
  nextRacePool: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },

  intensityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  intensityText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
    fontFamily: 'Sora-Bold',
  },

  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
    backgroundColor: '#FFD700',
    gap: 2,
  },
  winnerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Sora-ExtraBold',
    color: '#000',
  },
  positionSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  positionSummaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter-SemiBold',
  },

  

  shareResultsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
    backgroundColor: 'rgba(153, 69, 255, 0.1)',
  },
  shareResultsButtonText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
    fontFamily: 'Inter-SemiBold',
  },

  spectatorCard: {
    marginBottom: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  spectatorGradient: {
    padding: 20,
  },
  spectatorRibbon: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)'
  },
  spectatorRibbonText: {
    fontSize: 10,
    color: '#0B0B0B',
    fontFamily: 'Inter-SemiBold'
  },
  spectatorContent: {
    alignItems: 'center',
  },
  spectatorHeroIcon: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  spectatorHalo: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,215,0,0.12)'
  },
  spectatorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
    fontFamily: 'Sora-Bold',
  },
  spectatorDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  spectatorStats: {
    alignItems: 'center',
    gap: 8,
  },
  spectatorStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spectatorStatsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter-SemiBold',
  },

  assetTextInfo: {
    marginLeft: 8,
  },

  

  winnerShareButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  winnerShareGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  winnerShareButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    marginLeft: 8,
    fontFamily: 'Inter-SemiBold',
  },

  spectatorShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
    backgroundColor: 'rgba(153, 69, 255, 0.1)',
    marginTop: 16,
  },
  spectatorShareButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9945FF',
    marginLeft: 8,
    fontFamily: 'Inter-SemiBold',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD700',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Sora-Bold',
  },
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  loadingText: {
    fontSize: 16,
    color: '#9945FF',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFD700',
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Sora-Bold',
  },
  emptyMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },

  confettiOverlay: {
    position: 'absolute',
    top: -10,
    right: -10,
    flexDirection: 'row',
    gap: 4,
  },
})
