import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import * as Sharing from 'expo-sharing'
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { captureRef, captureScreen } from 'react-native-view-shot'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { useRaceStore } from '../../store/useRaceStore'
import { useClaimPayout } from './use-claim-payout'

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
  ({
    winnerAsset,
    raceResults,
    race,
    formatValue,
    handleShare,
  }: {
    winnerAsset: any
    raceResults: any
    race: any
    formatValue: (value: number) => string
    handleShare: () => void
  }) => (
    <View style={styles.winnerSection}>
      <LinearGradient
        colors={
          raceResults?.raceIntensity === 'extreme'
            ? ['rgba(255, 68, 68, 0.4)', 'rgba(255, 215, 0, 0.3)', 'rgba(0, 0, 0, 0.8)']
            : ['rgba(255, 215, 0, 0.4)', 'rgba(255, 165, 0, 0.2)', 'rgba(0, 0, 0, 0.8)']
        }
        style={styles.winnerCard}
      >
        <TouchableOpacity
          style={[styles.winnerShareButton, { minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }]}
          onPress={handleShare}
          accessibilityLabel={`Share race results. ${winnerAsset?.symbol} won with ${typeof winnerAsset?.performance === 'number' && !isNaN(winnerAsset.performance) ? winnerAsset.performance.toFixed(1) : '0.0'}% performance`}
          accessibilityRole="button"
          accessibilityHint="Opens sharing options to tell others about this race result"
        >
          <MaterialCommunityIcons name="share-variant" size={18} color="#FFD700" />
          <Text style={styles.winnerShareButtonText}>Share</Text>
        </TouchableOpacity>

        <View style={styles.winnerContent}>
          <MaterialCommunityIcons
            name="trophy"
            size={48}
            color={raceResults?.raceIntensity === 'extreme' ? '#FF4444' : '#FFD700'}
          />
          <View style={styles.winnerTitleContainer}>
            <MaterialCommunityIcons name="flag-checkered" size={20} color={COLORS.warning} />
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
                {Math.floor((raceResults?.raceDuration || 0) / 60)}:
                {String(Math.floor((raceResults?.raceDuration || 0) % 60)).padStart(2, '0')}
              </Text>
              <Text style={styles.winnerStatLabel}>Race Time</Text>
            </View>
            <View style={styles.winnerStatItem}>
              <Text
                style={[
                  styles.winnerStatValue,
                  { color: raceResults?.raceIntensity === 'extreme' ? '#FF4444' : '#00FF88' },
                ]}
              >
                {typeof raceResults?.performanceSpread === 'number' && !isNaN(raceResults.performanceSpread)
                  ? raceResults.performanceSpread.toFixed(1)
                  : '0.0'}
                %
              </Text>
              <Text style={styles.winnerStatLabel}>Spread</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  ),
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
  const { userBets, fetchSettledPhaseData, connectWebSocket, subscribeToRace, isConnected } = useRaceStore()

  React.useEffect(() => {
    if (account?.publicKey) {
      // Bypass cache when entering the settled phase to ensure results are fresh
      fetchSettledPhaseData(race?.raceId, account.publicKey.toBase58(), false)
    }
  }, [race?.raceId, account?.publicKey])

  // Connect to websocket for real-time settled phase updates
  React.useEffect(() => {
    if (race?.raceId && !isConnected) {
      connectWebSocket().then(() => {
        if (race.raceId) {
          subscribeToRace(race.raceId)
          console.log(`🔌 Connected to websocket for settled phase updates on race ${race.raceId}`)
        }
      })
    } else if (race?.raceId && isConnected) {
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
  const leaderboardAnim = useRef(new Animated.Value(0)).current

  const claimButtonScaleAnim = useRef(new Animated.Value(1)).current
  const shareButtonPulseAnim = useRef(new Animated.Value(1)).current
  // Ref to capture only the winner announcement card
  const shareCaptureRef = useRef<View>(null)
  const resultRowStaggerAnim = useRef(new Animated.Value(0)).current
  const confettiAnim = useRef(new Animated.Value(0)).current
  const sparkleAnim = useRef(new Animated.Value(0)).current

  const animationRefs = useRef<Animated.CompositeAnimation[]>([])

  const [showFullResults, setShowFullResults] = useState(false)
  const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false)
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

  const poolData = useMemo(
    () => ({
      totalPool: race?.totalPool || 0,
      assetPools: race?.assetPools || [],
      participantCount: race?.participantCount || 0,
    }),
    [race?.totalPool, race?.assetPools, race?.participantCount],
  )

  const assetPerformances = useMemo(() => {
    if (!rawAssetData.length) return []

    return rawAssetData
      .map(({ asset, index }: { asset: any; index: number }) => {
        const startPrice = asset.startPrice || 100
        const endPrice = asset.endPrice || asset.currentPrice || startPrice

        // Optimized performance calculation
        const performance =
          startPrice > 0 && typeof startPrice === 'number' && typeof endPrice === 'number'
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

  useEffect(() => {
    if (showFullResults) {
      const leaderboardAnimation = Animated.spring(leaderboardAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })

      const staggerAnimation = Animated.stagger(
        100,
        assetPerformances.map((_: any, index: number) =>
          Animated.timing(resultRowStaggerAnim, {
            toValue: 1,
            duration: 400,
            delay: index * 50,
            useNativeDriver: true,
          }),
        ),
      )

      animationRefs.current.push(leaderboardAnimation, staggerAnimation)
      Animated.parallel([leaderboardAnimation, staggerAnimation]).start()
    } else {
      leaderboardAnim.setValue(0)
      resultRowStaggerAnim.setValue(0)
    }
  }, [showFullResults, assetPerformances])

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

    // Optimistic update - immediately show claimed status for instant UX
    setLocalClaimUpdate(true)

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

      setTimeout(() => triggerHaptic('success'), 200)
      setTimeout(() => triggerHaptic('light'), 400)

      console.log(`✅ Payout claim submitted successfully`)
    } catch (error) {
      // Revert optimistic update on error
      setLocalClaimUpdate(false)
      triggerHaptic('error')
      console.error('Failed to claim payout:', error)
    }
  }, [userPosition, claimPayoutMutation, account, race, claimed, triggerHaptic])

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
        uri = await captureRef(shareCaptureRef.current, { format: 'png', quality: 0.9 })
      }
      // Fallback to full screen if specific capture fails
      if (!uri) {
        uri = await captureScreen({ format: 'png', quality: 0.9 })
      }
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: '🏆 I WON on Momentum Madness!',
        })
        return
      }

      // Fallback to plain text share if image capture or sharing fails
      const returnPercentage =
        userPosition && userPosition.originalAmount > 0
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

  const handleToggleResults = useCallback(() => {
    triggerHaptic('selection')
    setShowFullResults(!showFullResults)
  }, [showFullResults, triggerHaptic])

  const handleToggleAnalytics = useCallback(() => {
    triggerHaptic('selection')
    setShowDetailedAnalytics(!showDetailedAnalytics)
  }, [showDetailedAnalytics, triggerHaptic])

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
            ref={shareCaptureRef}
            collapsable={false}
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
                  {isWinner && !reduceMotion && (
                    <Animated.View
                      style={[
                        styles.confettiOverlay,
                        {
                          opacity: confettiAnim,
                          transform: [
                            {
                              scale: confettiAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.5, 1.2],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <MaterialCommunityIcons name="star-four-points" size={16} color="#FFD700" />
                      <MaterialCommunityIcons name="star-four-points" size={12} color="#00FF88" />
                      <MaterialCommunityIcons name="star-four-points" size={14} color="#9945FF" />
                    </Animated.View>
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

                <View style={styles.toggleButtonsRow}>
                  <TouchableOpacity
                    style={[styles.detailsButton, { minHeight: MIN_TOUCH_TARGET }]}
                    onPress={handleToggleResults}
                    activeOpacity={0.8}
                    accessibilityLabel={`${showFullResults ? 'Hide' : 'Show'} detailed race results and leaderboard`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showFullResults }}
                    accessibilityHint={`${showFullResults ? 'Collapses' : 'Expands'} the complete race results view`}
                  >
                    <Text style={styles.detailsButtonText}>{showFullResults ? 'Hide' : 'Show'} Results</Text>
                    <MaterialCommunityIcons
                      name={showFullResults ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#9945FF"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.detailsButton} onPress={handleToggleAnalytics} activeOpacity={0.8}>
                    <Text style={styles.detailsButtonText}>{showDetailedAnalytics ? 'Hide' : 'Show'} Analytics</Text>
                    <MaterialCommunityIcons
                      name={showDetailedAnalytics ? 'chart-line-variant' : 'chart-line'}
                      size={16}
                      color="#9945FF"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        ) : (
          <View style={styles.spectatorCard}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.8)']}
              style={styles.spectatorGradient}
            >
              <View style={styles.spectatorContent}>
                <MaterialCommunityIcons name="podium-gold" size={32} color="rgba(255,255,255,0.7)" />
                <Text style={styles.spectatorTitle}>Race Spectator</Text>
                <Text style={styles.spectatorDescription}>
                  You watched this exciting {raceResults?.raceIntensity} race! Join the next one to compete for prizes.
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
                      Performance Spread: {raceResults?.performanceSpread.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <Animated.View
                  style={{
                    transform: [{ scale: shareButtonPulseAnim }],
                  }}
                >
                  <TouchableOpacity
                    style={styles.spectatorShareButton}
                    onPress={handleShare}
                    activeOpacity={0.8}
                    accessibilityLabel="Share this exciting race"
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons name="share-variant" size={16} color="#9945FF" />
                    <Text style={styles.spectatorShareButtonText}>Share This Epic Race</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </LinearGradient>
          </View>
        )}

        {showFullResults && (
          <Animated.View
            style={[
              styles.fullResultsSection,
              {
                opacity: leaderboardAnim,
                transform: [
                  {
                    translateY: leaderboardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.8)']}
              style={styles.fullResultsCard}
            >
              <Text style={styles.fullResultsTitle}>Complete Race Results</Text>

              {assetPerformances.map((asset: any, position: number) => {
                const rank = position + 1
                const isWinnerAsset = raceResults?.winnerAssets.some((w: any) => w.index === asset.index)

                return (
                  <Animated.View
                    key={asset.index}
                    style={[
                      styles.resultRow,
                      {
                        opacity: resultRowStaggerAnim,
                        transform: [
                          {
                            translateX: resultRowStaggerAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [50, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.resultRank,
                        {
                          backgroundColor:
                            rank === 1
                              ? '#FFD700'
                              : rank === 2
                                ? '#C0C0C0'
                                : rank === 3
                                  ? '#CD7F32'
                                  : 'rgba(255,255,255,0.2)',
                        },
                      ]}
                    >
                      <Text style={[styles.resultRankText, { color: rank <= 3 ? '#000' : '#fff' }]}>#{rank}</Text>
                    </View>

                    <View style={styles.resultAssetInfo}>
                      <View style={[styles.assetDotSmall, { backgroundColor: asset.color }]} />
                      <View style={styles.assetTextInfo}>
                        <Text style={styles.resultAssetSymbol}>{asset.symbol}</Text>
                        <Text style={styles.resultAssetName}>{asset.name}</Text>
                      </View>
                      {isWinnerAsset && <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />}
                    </View>

                    <View style={styles.resultStats}>
                      <Text
                        style={[styles.resultPerformance, { color: asset.performance >= 0 ? '#00FF88' : '#FF4444' }]}
                      >
                        {asset.performance >= 0 ? '+' : ''}
                        {typeof asset.performance === 'number' && !isNaN(asset.performance)
                          ? asset.performance.toFixed(2)
                          : '0.00'}
                        %
                      </Text>
                      <Text style={styles.resultPoolShare}>{asset.poolShare.toFixed(1)}% pool</Text>
                    </View>
                  </Animated.View>
                )
              })}
            </LinearGradient>
          </Animated.View>
        )}

        {showDetailedAnalytics && (
          <View style={styles.analyticsSection}>
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.9)']}
              style={styles.analyticsCard}
            >
              <Text style={styles.analyticsTitle}>Race Analytics</Text>

              <View style={styles.analyticsGrid}>
                <View style={styles.analyticsItem}>
                  <MaterialCommunityIcons name="chart-line" size={20} color="#14F195" />
                  <Text style={styles.analyticsValue}>{raceResults?.performanceSpread.toFixed(1)}%</Text>
                  <Text style={styles.analyticsLabel}>Performance Spread</Text>
                </View>

                <View style={styles.analyticsItem}>
                  <MaterialCommunityIcons name="trending-up" size={20} color="#FFD700" />
                  <Text style={styles.analyticsValue}>{raceResults?.avgPerformance.toFixed(2)}%</Text>
                  <Text style={styles.analyticsLabel}>Average Performance</Text>
                </View>

                <View style={styles.analyticsItem}>
                  <MaterialCommunityIcons name="fire" size={20} color="#FF6B6B" />
                  <Text
                    style={[
                      styles.analyticsValue,
                      { color: raceResults?.raceIntensity === 'extreme' ? '#FF4444' : '#00FF88' },
                    ]}
                  >
                    {raceResults?.raceIntensity.toUpperCase()}
                  </Text>
                  <Text style={styles.analyticsLabel}>Race Intensity</Text>
                </View>

                <View style={styles.analyticsItem}>
                  <MaterialCommunityIcons name="account-group" size={20} color="#9945FF" />
                  <Text style={styles.analyticsValue}>{race?.participantCount || 0}</Text>
                  <Text style={styles.analyticsLabel}>Total Racers</Text>
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
    fontFamily: 'Orbitron-ExtraBold',
  },
  winnerAssetName: {
    ...TYPOGRAPHY.display,
    fontWeight: '900',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    fontFamily: 'Orbitron-Black',
    letterSpacing: isTablet ? 3 : 2,
  },
  winnerPerformance: {
    fontSize: 16,
    color: '#00FF88',
    marginBottom: 20,
    fontFamily: 'Orbitron-SemiBold',
  },
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
    fontFamily: 'Orbitron-Bold',
  },
  winnerStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Bold',
  },
  userResultSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    fontFamily: 'Orbitron-Regular',
  },

  betSummarySection: {
    marginBottom: 16,
    gap: 8,
  },
  betSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  betSummaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-SemiBold',
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-ExtraBold',
    letterSpacing: 0.5,
  },
  claimedSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Orbitron-SemiBold',
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
    fontFamily: 'Orbitron-Black',
    marginLeft: 4,
    letterSpacing: 1,
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
    fontFamily: 'Orbitron-SemiBold',
  },

  fullResultsSection: {
    marginBottom: 20,
    marginHorizontal: 20,
  },
  fullResultsCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fullResultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  resultRank: {
    width: 40,
  },
  resultRankText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
  },
  resultAssetInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultAssetSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Orbitron-SemiBold',
  },
  resultPerformance: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
  },
  nextRaceSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 12,
    fontFamily: 'Orbitron-Regular',
  },
  nextRaceStats: {
    marginBottom: 16,
  },
  nextRaceCountdown: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9945FF',
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
  },
  nextRacePool: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-ExtraBold',
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
    fontFamily: 'Orbitron-SemiBold',
  },

  toggleButtonsRow: {
    flexDirection: 'row',
    gap: 8,
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
    fontFamily: 'Orbitron-Bold',
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
  spectatorContent: {
    alignItems: 'center',
  },
  spectatorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
    fontFamily: 'Orbitron-Bold',
  },
  spectatorDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-SemiBold',
  },

  assetTextInfo: {
    marginLeft: 8,
  },
  resultAssetName: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Orbitron-Regular',
  },
  resultStats: {
    alignItems: 'flex-end',
  },
  resultPoolShare: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontFamily: 'Orbitron-Regular',
  },

  analyticsSection: {
    marginBottom: 20,
    marginHorizontal: 20,
  },
  analyticsCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 16,
  },
  analyticsItem: {
    alignItems: 'center',
    minWidth: '40%',
  },
  analyticsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'Orbitron-Bold',
  },
  analyticsLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
  },

  winnerShareButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  winnerShareButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
    marginLeft: 8,
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
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
    fontFamily: 'Orbitron-Bold',
  },
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
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
    fontFamily: 'Orbitron-SemiBold',
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
    fontFamily: 'Orbitron-Bold',
  },
  emptyMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 5,
    textAlign: 'center',
    fontFamily: 'Orbitron-Regular',
  },

  confettiOverlay: {
    position: 'absolute',
    top: -10,
    right: -10,
    flexDirection: 'row',
    gap: 4,
  },
})
