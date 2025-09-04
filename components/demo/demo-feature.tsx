import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { LinearGradient } from 'expo-linear-gradient'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { AppView } from '@/components/app-view'
import { useConnection } from '@/components/solana/solana-provider'
import { useWalletUi } from '@/components/solana/use-wallet-ui'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import {
  getCurrentPhase,
  getTimeRemaining,
  type Phase as RacePhase,
  useRaceStore,
} from '../../store/useRaceStore'
import { EnhancedCommitPhase } from './CommitPhase'
import { EnhancedPerformancePhase } from './PerformancePhase'
import { EnhancedSettledPhase } from './SettledPhase'

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

interface AssetData {
  feedId: string
  symbol: string
  name: string
  color: string
  startPrice: number
  currentPrice: number
  momentum: number
  poolShare: number
}

interface RaceData {
  raceId: number
  state: number
  startTs: number
  lockTs: number
  settleTs: number
  assets: AssetData[]
  totalPool: number
  assetPools: number[]
  participantCount: number
  payoutRatio: number
  winnerAssetIdx: number
  raceNumber: number
  season: number
}

interface UserBetData {
  raceId: number
  player: string
  assetIdx: number
  amount: number
  claimed: boolean
  isWinner: boolean
  potentialPayout: number
  momentum: number
  timestamp: number
}

interface PhaseConfig {
  color: string
  accentColor: string
  label: string
  description: string
  bgGradient: string[]
  particleColor: string
  glowIntensity: number
}

const PHASE_CONFIG: Record<RacePhase, PhaseConfig> = {
  commit: {
    color: '#9945FF',
    accentColor: '#14F195',
    label: 'COMMIT PHASE',
    description: 'Place your bets • Racing starts soon',
    bgGradient: ['#1a0d4d', '#0a0026', '#2d1a80'],
    particleColor: '#9945FF',
    glowIntensity: 0.8,
  },
  performance: {
    color: '#00FF88',
    accentColor: '#FFD700',
    label: 'PERFORMANCE PHASE',
    description: 'Live tracking • Momentum building',
    bgGradient: ['#1a4d0d', '#0a0026', '#2d8000'],
    particleColor: '#00FF88',
    glowIntensity: 1.2,
  },
  settled: {
    color: '#FFD700',
    accentColor: '#FFA500',
    label: 'RACE SETTLED',
    description: 'Results final • Payouts ready',
    bgGradient: ['#4d2a0d', '#0a0026', '#804000'],
    particleColor: '#FFD700',
    glowIntensity: 1.0,
  },
}

export function DemoFeature() {
  const { account, signAndSendTransaction } = useWalletUi()
  const connection = useConnection()

  const race = useRaceStore((s) => s.race)
  const userBets = useRaceStore((s) => s.userBets)
  const assetInfo = useRaceStore((s) => s.assetInfo)
  const isLoading = useRaceStore((s) => s.isLoading)
  const error = useRaceStore((s) => s.error)
  const fetchCommitPhaseData = useRaceStore((s) => s.fetchCommitPhaseData)
  const fetchPerformancePhaseData = useRaceStore((s) => s.fetchPerformancePhaseData)
  const fetchSettledPhaseData = useRaceStore((s) => s.fetchSettledPhaseData)
  const connectWebSocket = useRaceStore((s) => s.connectWebSocket)
  const subscribeToRace = useRaceStore((s) => s.subscribeToRace)
  const isConnected = useRaceStore((s) => s.isConnected)

  const [currentTime, setCurrentTime] = useState(Date.now() / 1000)
  const [selectedAssetIdx, setSelectedAssetIdx] = useState(0)
  const [betAmount, setBetAmount] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const animationRefs = useRef<Animated.CompositeAnimation[]>([])
  const intervalRefs = useRef<number[]>([])
  const [reduceMotion, setReduceMotion] = useState(ANIMATION_REDUCE_MOTION)
  const playerAddress = account?.publicKey?.toBase58 ? account.publicKey.toBase58() : account?.publicKey?.toString?.()
  const lastSubscribedRaceIdRef = useRef<number | null>(null)

  const safeToFixed = useCallback((value: number | undefined | null, decimals: number = 2): string => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00'
    return value.toFixed(decimals)
  }, [])

  const currentPhase = useMemo((): RacePhase => {
    if (!race) return 'commit'
    // Re-evaluate each second so the phase flips exactly at lock/settle timestamps
    return getCurrentPhase(race)
  }, [race, currentTime])

  const userBet = useMemo(() => {
    if (!userBets || !race?.raceId) return undefined
    return userBets.find((bet) => bet.raceId === race.raceId)
  }, [userBets, race?.raceId])

  const [lastRaceId, setLastRaceId] = useState<number | undefined>()
  const [isCheckingForNewRace, setIsCheckingForNewRace] = useState(false)

  useEffect(() => {
    if (race) {
      console.log('🏁 Current Race Debug Info:', {
        raceId: race.raceId,
        state: race.state,
        phase: currentPhase,
        now: Math.floor(Date.now() / 1000),
        startTs: race.startTs,
        lockTs: race.lockTs,
        settleTs: race.settleTs,
        timeUntilLock: race.lockTs - Math.floor(Date.now() / 1000),
        timeUntilSettle: race.settleTs - Math.floor(Date.now() / 1000),
        isSettled: currentPhase === 'settled',
      })

      console.log(`🎯 Rendering ${currentPhase} phase for race ${race.raceId}`)
    }
  }, [race, currentPhase])

  useEffect(() => {
    if (!race) return

    if (lastRaceId !== race.raceId) {
      console.log(`🔄 Race transition detected: ${lastRaceId} → ${race.raceId}`)
      setLastRaceId(race.raceId)
      return
    }

    if (currentPhase === 'settled' && !isCheckingForNewRace) {
      setIsCheckingForNewRace(true)

      const checkInterval = setInterval(async () => {
        try {
          console.log(`🔍 Checking for new race while current race ${race.raceId} is settled...`)

          const { apiService } = useRaceStore.getState()
          const response = await apiService.getCurrentRace()

          if (response.success && response.data) {
            const newRaceId = response.data.raceId

            if (newRaceId && newRaceId !== race.raceId) {
              console.log(`🎉 New race detected: ${race.raceId} → ${newRaceId}`)
              clearInterval(checkInterval)
              setIsCheckingForNewRace(false)

              const newPhase = getCurrentPhase(response.data)
              console.log(`🔄 New race ${newRaceId} is in ${newPhase} phase`)

              if (newPhase === 'commit') {
                await fetchCommitPhaseData(undefined, account?.publicKey?.toString(), false)
              } else if (newPhase === 'performance') {
                await fetchPerformancePhaseData(undefined, account?.publicKey?.toString(), false)
              } else {
                await fetchSettledPhaseData(undefined, account?.publicKey?.toString(), false)
              }

              // Ensure WebSocket is connected to receive live updates for the new race
              if (!isConnected) {
                await connectWebSocket()
              }
              subscribeToRace(newRaceId)
            }
          }
        } catch (error) {
          console.error('❌ Error checking for new race:', error)
        }
      }, 10000)

      intervalRefs.current.push(checkInterval)

      setTimeout(() => {
        clearInterval(checkInterval)
        setIsCheckingForNewRace(false)
        console.log(`⏰ Stopped checking for new races after 5 minutes`)
      }, 300000)
    }
  }, [race?.raceId, currentPhase, lastRaceId, isCheckingForNewRace, account?.publicKey])

  const phaseConfig = PHASE_CONFIG[currentPhase]

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
      intervalRefs.current.forEach((interval) => {
        clearInterval(interval)
      })
      animationRefs.current = []
      intervalRefs.current = []
    }
  }, [])

  useEffect(() => {
    if (currentPhase === 'commit') {
      fetchCommitPhaseData(undefined, playerAddress)
    } else if (currentPhase === 'performance') {
      fetchPerformancePhaseData(undefined, playerAddress)
      if (!isConnected) {
        connectWebSocket().then(() => {
          if (race?.raceId) {
            subscribeToRace(race.raceId)
          }
        })
      }
    } else if (currentPhase === 'settled') {
      fetchSettledPhaseData(undefined, playerAddress)
      // In settled phase, briefly poll to catch backend cron finalization
      const stopAfterMs = 120000
      const start = Date.now()
      const poll = setInterval(() => {
        const elapsed = Date.now() - start
        if (elapsed > stopAfterMs) {
          clearInterval(poll)
          return
        }
        fetchSettledPhaseData(undefined, playerAddress, false)
      }, 2000)
      return () => clearInterval(poll)
    }
  }, [currentPhase, playerAddress])

  useEffect(() => {
    if (!race && !isLoading) {
      fetchCommitPhaseData(undefined, playerAddress)
    }
  }, [race, isLoading, playerAddress])

  // Force-refresh current race at phase boundaries to avoid stale phase transitions
  useEffect(() => {
    if (!race) return
    const now = Math.floor(currentTime)
    const secondsToLock = race.lockTs - now
    const secondsToSettle = race.settleTs - now
    // When approaching a boundary, refetch aggressively
    if ((secondsToLock >= -2 && secondsToLock <= 2) || (secondsToSettle >= -2 && secondsToSettle <= 2)) {
      useRaceStore.getState().fetchCurrentRace(false)
    }
  }, [race?.raceId, currentTime])

  useEffect(() => {
    if (!race?.raceId || !isConnected) return
    if (lastSubscribedRaceIdRef.current !== race.raceId) {
      subscribeToRace(race.raceId)
      lastSubscribedRaceIdRef.current = race.raceId
    }
  }, [race?.raceId, isConnected])

  const timeCalculations = useMemo(() => {
    if (!race) return { progress: 0, secondsLeft: 0, urgency: 'normal' }

    const secondsLeft = getTimeRemaining(race, currentPhase)
    let urgency = 'normal'
    if (secondsLeft <= 30) urgency = 'critical'
    else if (secondsLeft <= 60) urgency = 'warning'

    let totalTime = 0
    let elapsed = 0
    const now = Math.floor(currentTime)

    switch (currentPhase) {
      case 'commit':
        totalTime = race.lockTs - race.startTs
        elapsed = now - race.startTs
        break
      case 'performance':
        totalTime = race.settleTs - race.lockTs
        elapsed = now - race.lockTs
        break
      default:
        return { progress: 1, secondsLeft: 0, urgency: 'normal' }
    }

    const progress = Math.max(0, Math.min(1, 1 - elapsed / totalTime))

    return {
      progress,
      secondsLeft,
      urgency,
    }
  }, [race, currentPhase, currentTime])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatValue = useCallback((value: number) => {
    const displayValue = value / 1_000_000

    if (displayValue >= 1000000) return `$${(displayValue / 1000000).toFixed(2)}M`
    if (displayValue >= 1000) return `$${(displayValue / 1000).toFixed(1)}K`
    return `$${displayValue.toFixed(0)}`
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now() / 1000)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const fadeAnim = useRef(new Animated.Value(0)).current
  const phaseTransitionAnim = useRef(new Animated.Value(0)).current
  const particleAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const speedLinesAnim = useRef(new Animated.Value(0)).current

  const loadingDotsAnim = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current
  const loadingProgressAnim = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current
  const loadingSpinnerAnim = useRef(new Animated.Value(0)).current
  const loadingTrackAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const createParticleEffect = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(particleAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(particleAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ).start()
    }

    createParticleEffect()
  }, [])

  useEffect(() => {
    if (timeCalculations.urgency === 'critical') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start()
    } else {
      pulseAnim.setValue(1)
    }
  }, [timeCalculations.urgency])

  useEffect(() => {
    Animated.loop(
      Animated.timing(speedLinesAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }),
    ).start()
  }, [])

  useEffect(() => {
    Animated.sequence([
      Animated.timing(phaseTransitionAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(phaseTransitionAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start()
  }, [currentPhase])

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start()
  }, [])

  useEffect(() => {
    if (!race && !error) {
      const animateLoadingDots = () => {
        const staggeredAnimations = loadingDotsAnim.map((anim, index) =>
          Animated.loop(
            Animated.sequence([
              Animated.delay(index * 200),
              Animated.timing(anim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(anim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
            ]),
          ),
        )
        Animated.stagger(200, staggeredAnimations).start()
      }

      const animateProgressBars = () => {
        const progressAnimations = loadingProgressAnim.map((anim, index) =>
          Animated.loop(
            Animated.sequence([
              Animated.delay(index * 300),
              Animated.timing(anim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: false,
              }),
              Animated.timing(anim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: false,
              }),
            ]),
          ),
        )
        Animated.stagger(300, progressAnimations).start()
      }

      const animateSpinner = () => {
        Animated.loop(
          Animated.timing(loadingSpinnerAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ).start()
      }

      const animateTrackLines = () => {
        Animated.loop(
          Animated.timing(loadingTrackAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
        ).start()
      }

      animateLoadingDots()
      animateProgressBars()
      animateSpinner()
      animateTrackLines()
    }
  }, [race, isLoading, error])

  if (!race && !error) {
    return (
      <AppView style={styles.container}>
        <LinearGradient colors={['#000814', '#001D3D', '#003566', '#0077B6']} style={StyleSheet.absoluteFill} />

        <View style={styles.loadingParticleLayer}>
          {[...Array(15)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.loadingParticle,
                {
                  left: `${(i * 6.67) % 100}%`,
                  top: `${(i * 8.33) % 100}%`,
                  animationDelay: `${i * 100}ms`,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.enhancedLoadingContainer}>
          <View style={styles.loadingLogoContainer}>
            <LinearGradient colors={['#9945FF', '#14F195', '#FFD700']} style={styles.loadingLogoGradient}>
              <MaterialCommunityIcons name="rocket-launch" size={40} color="#000" />
            </LinearGradient>
            <View style={styles.loadingLogoGlow} />
          </View>

          <View style={styles.loadingAnimationContainer}>
            <Animated.View
              style={[
                styles.loadingSpinnerContainer,
                {
                  transform: [
                    {
                      rotate: loadingSpinnerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              <LinearGradient colors={['#9945FF', '#14F195']} style={styles.loadingSpinnerRing}>
                <ActivityIndicator size="large" color="transparent" />
              </LinearGradient>
              <View style={styles.loadingSpinnerCenter}>
                <MaterialCommunityIcons name="flash" size={24} color="#FFD700" />
              </View>
            </Animated.View>

            <View style={styles.loadingProgressContainer}>
              {loadingProgressAnim.map((anim, index) => (
                <View key={index} style={styles.loadingProgressBar}>
                  <Animated.View
                    style={[
                      styles.loadingProgressFill,
                      index === 0
                        ? styles.loadingProgress1
                        : index === 1
                          ? styles.loadingProgress2
                          : styles.loadingProgress3,
                      {
                        height: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['20%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.loadingTextContainer}>
            <LinearGradient colors={['#9945FF', '#14F195']} style={styles.loadingTextGradient}>
              <Text style={styles.enhancedLoadingTitle}>MOMENTUM MADNESS</Text>
            </LinearGradient>
            <Text style={styles.enhancedLoadingSubtitle}>Connecting to Race Server...</Text>

            <View style={styles.loadingDotsContainer}>
              {loadingDotsAnim.map((anim, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.loadingDot,
                    {
                      opacity: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                      transform: [
                        {
                          scale: anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1.2],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.enhancedRetryButton}
            onPress={() => {
              const playerAddress = account?.publicKey?.toString()
              fetchCommitPhaseData(undefined, playerAddress)
            }}
            accessibilityLabel="Retry connection to race server"
            accessibilityRole="button"
          >
            <LinearGradient colors={['#9945FF', '#14F195']} style={styles.enhancedRetryGradient}>
              <MaterialCommunityIcons name="refresh" size={20} color="#000" />
              <Text style={styles.enhancedRetryText}>Retry Connection</Text>
              <MaterialCommunityIcons name="rocket-launch" size={16} color="#000" />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.connectionStatusContainer}>
            <Animated.View
              style={[
                styles.connectionStatusDot,
                {
                  opacity: loadingDotsAnim[0].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                  transform: [
                    {
                      scale: loadingDotsAnim[0].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.1],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Text style={styles.connectionStatusText}>Establishing secure connection...</Text>
          </View>
        </View>

        <View style={styles.racingTrackContainer}>
          {[...Array(5)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.racingTrackLine,
                {
                  top: `${20 + i * 15}%`,
                  transform: [
                    {
                      translateX: loadingTrackAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-120, screenWidth + 120],
                      }),
                    },
                  ],
                  opacity: loadingTrackAnim.interpolate({
                    inputRange: [0, 0.2, 0.8, 1],
                    outputRange: [0, 1, 1, 0],
                  }),
                },
              ]}
            />
          ))}
        </View>
      </AppView>
    )
  }

  if (false) {
    return (
      <AppView style={styles.container}>
        <LinearGradient colors={['#000814', '#001D3D', '#003566', '#0077B6']} style={StyleSheet.absoluteFill} />
        <View style={styles.enhancedLoadingContainer}>
          <View style={styles.loadingLogoContainer}>
            <LinearGradient colors={['#9945FF', '#14F195', '#FFD700']} style={styles.loadingLogoGradient}>
              <MaterialCommunityIcons name="rocket-launch" size={40} color="#000" />
            </LinearGradient>
            <View style={styles.loadingLogoGlow} />
          </View>

          <ActivityIndicator size="large" color="#14F195" />
          <Text style={styles.enhancedLoadingSubtitle}>Loading Race Data...</Text>

          <View style={styles.connectionStatusContainer}>
            <View style={styles.connectionStatusDot} />
            <Text style={styles.connectionStatusText}>Fetching latest race information...</Text>
          </View>
        </View>
      </AppView>
    )
  }

  if (error && !race) {
    return (
      <AppView style={styles.container}>
        <LinearGradient colors={['#000814', '#001D3D', '#003566', '#0077B6']} style={StyleSheet.absoluteFill} />
        <View style={styles.enhancedLoadingContainer}>
          <View style={styles.loadingLogoContainer}>
            <LinearGradient colors={['#FF4444', '#FF6B6B', '#FFD700']} style={styles.loadingLogoGradient}>
              <MaterialCommunityIcons name="alert-circle" size={40} color="#000" />
            </LinearGradient>
            <View style={styles.loadingLogoGlow} />
          </View>

          <Text style={[styles.enhancedLoadingTitle, { color: '#FF4444' }]}>CONNECTION ERROR</Text>
          <Text style={styles.enhancedLoadingSubtitle}>Unable to connect to race server</Text>
          <Text style={[styles.connectionStatusText, { textAlign: 'center', marginTop: 8 }]}>{error}</Text>

          <TouchableOpacity
            style={styles.enhancedRetryButton}
            onPress={() => {
              const playerAddress = account?.publicKey?.toString()
              fetchCommitPhaseData(undefined, playerAddress)
            }}
            accessibilityLabel="Retry connection"
            accessibilityRole="button"
          >
            <LinearGradient colors={['#FF4444', '#FF6B6B']} style={styles.enhancedRetryGradient}>
              <MaterialCommunityIcons name="refresh" size={20} color="#000" />
              <Text style={styles.enhancedRetryText}>Try Again</Text>
              <MaterialCommunityIcons name="rocket-launch" size={16} color="#000" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AppView>
    )
  }

  return (
    <AppView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <LinearGradient colors={phaseConfig.bgGradient as any} style={StyleSheet.absoluteFill} />

      <View style={styles.particleLayer}>
        {[...Array(20)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left: `${(i * 5.26) % 100}%`,
                top: `${(i * 7.89) % 100}%`,
                backgroundColor: phaseConfig.particleColor,
                opacity: particleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.1, 0.6],
                }),
                transform: [
                  {
                    translateY: particleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -50],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.speedLinesContainer}>
        {[...Array(8)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.speedLine,
              {
                top: `${i * 12.5 + 10}%`,
                opacity: speedLinesAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.8],
                }),
                transform: [
                  {
                    translateX: speedLinesAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-100, screenWidth + 100],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              {
                scale: phaseTransitionAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.02],
                }),
              },
              {
                scale: pulseAnim,
              },
            ],
          },
        ]}
      >
        <View style={styles.headerSection}>
          <View style={styles.controlButtonsRow}></View>

          {race && (
            <View style={styles.statsContainer}>
              <LinearGradient colors={['rgba(153, 69, 255, 0.2)', 'rgba(153, 69, 255, 0.05)']} style={styles.statCard}>
                <MaterialCommunityIcons name="trophy" size={20} color="#9945FF" />
                <Text style={styles.statLabel}>RACE STATUS</Text>
                <Text style={[styles.statValue, { color: phaseConfig.color }]}>{phaseConfig.label}</Text>
              </LinearGradient>

              <LinearGradient colors={['rgba(20, 241, 149, 0.2)', 'rgba(20, 241, 149, 0.05)']} style={styles.statCard}>
                <MaterialCommunityIcons name="wallet" size={20} color="#14F195" />
                <Text style={styles.statLabel}>TOTAL POOL</Text>
                <Text style={styles.statValue}>{formatValue(race.totalPool)}</Text>
              </LinearGradient>

              <LinearGradient colors={['rgba(255, 215, 0, 0.2)', 'rgba(255, 215, 0, 0.05)']} style={styles.statCard}>
                <MaterialCommunityIcons name="account-group" size={20} color="#FFD700" />
                <Text style={styles.statLabel}>RACERS</Text>
                <Text style={styles.statValue}>{race.participantCount || 0}</Text>
              </LinearGradient>
            </View>
          )}

          {race && (
            <LinearGradient colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.3)']} style={styles.raceInfoBanner}>
              <View style={styles.raceInfoLeft}>
                <Text style={styles.raceNumber}>RACE #{race.raceId}</Text>
                <Text style={styles.raceDescription}>Momentum Madness</Text>
              </View>
              <View style={styles.raceInfoRight}>
                <MaterialCommunityIcons name="lightning-bolt" size={24} color={phaseConfig.accentColor} />
              </View>
            </LinearGradient>
          )}
        </View>

        {currentPhase !== 'settled' && race && (
          <View style={styles.countdownSection}>
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.8)']}
              style={[styles.countdownContainer, timeCalculations.urgency === 'critical' && styles.criticalCountdown]}
            >
              <View style={styles.countdownHeader}>
                <View style={styles.countdownInfo}>
                  <Text
                    style={[styles.countdownLabel, timeCalculations.urgency === 'critical' && { color: '#FF4444' }]}
                  >
                    {timeCalculations.secondsLeft > 0 ? formatTime(timeCalculations.secondsLeft) : '00:00'}
                  </Text>
                  <Text style={styles.countdownSubLabel}>
                    {timeCalculations.urgency === 'critical' ? 'CLOSING SOON!' : 'remaining'}
                  </Text>
                </View>
                <View style={styles.phaseIndicator}>
                  <View style={[styles.phaseIcon, { backgroundColor: phaseConfig.color }]} />
                  <View>
                    <Text style={[styles.phaseLabel, { color: phaseConfig.accentColor }]}>{phaseConfig.label}</Text>
                    <Text style={styles.phaseDescription}>{phaseConfig.description}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: `${timeCalculations.progress * 100}%`,
                        backgroundColor: timeCalculations.urgency === 'critical' ? '#FF4444' : phaseConfig.color,
                      },
                    ]}
                  />
                  <View style={styles.progressGlow} />
                </View>
                <Text style={styles.progressText}>{Math.round(timeCalculations.progress * 100)}%</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
          {currentPhase === 'commit' && (
            <EnhancedCommitPhase
              selectedAssetIdx={selectedAssetIdx}
              setSelectedAssetIdx={setSelectedAssetIdx}
              betAmount={betAmount}
              setBetAmount={setBetAmount}
              account={account}
            />
          )}

          {currentPhase === 'performance' && race && (
            <EnhancedPerformancePhase
              race={race}
              userBet={userBet}
              phaseConfig={phaseConfig}
              formatValue={formatValue}
              account={account}
            />
          )}

          {currentPhase === 'settled' && race && (
            <EnhancedSettledPhase race={race} userBet={userBet} formatValue={formatValue} account={account} />
          )}
        </ScrollView>
      </Animated.View>
    </AppView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  particleLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
  speedLinesContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    pointerEvents: 'none',
  },
  speedLine: {
    position: 'absolute',
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.3,
  },
  content: {
    flex: 1,
    zIndex: 3,
  },
  headerSection: {
    paddingHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
    marginBottom: SPACING.xl,
  },
  controlButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: 'rgba(153, 69, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(153, 69, 255, 0.3)',
  },
  refreshButtonText: {
    fontSize: 12,
    color: '#9945FF',
    marginLeft: SPACING.xs,
    fontFamily: 'Orbitron-SemiBold',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  statusText: {
    fontSize: 11,
    color: '#FFD700',
    marginLeft: SPACING.xs,
    fontFamily: 'Orbitron-Regular',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 255, 231, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 231, 0.3)',
  },
  helpButtonText: {
    fontSize: 12,
    color: '#00ffe7',
    fontWeight: '500',
    marginLeft: 4,
    fontFamily: 'Orbitron-Regular',
  },
  statsContainer: {
    flexDirection: isLandscape && isTablet ? 'row' : 'row',
    gap: isTablet ? SPACING.lg : SPACING.md,
    marginBottom: SPACING.lg,
    flexWrap: isTablet ? 'nowrap' : 'wrap',
  },
  statCard: {
    flex: 1,
    borderRadius: isTablet ? 20 : 16,
    padding: isTablet ? SPACING.lg : SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: isTablet ? 100 : 80,
  },
  statLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.text.tertiary,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
    fontFamily: 'Orbitron-Regular',
  },
  statValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
  },
  raceInfoBanner: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  raceInfoLeft: {
    flex: 1,
  },
  raceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  raceDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    fontFamily: 'Orbitron-Regular',
  },
  raceInfoRight: {
    marginLeft: 16,
  },
  countdownSection: {
    marginHorizontal: isTablet ? SPACING.xxl : SPACING.xl,
    marginBottom: SPACING.xl,
  },
  countdownContainer: {
    borderRadius: isTablet ? 20 : 16,
    padding: isTablet ? SPACING.xl : SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  countdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  countdownInfo: {
    alignItems: 'flex-start',
  },
  countdownLabel: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Orbitron-Bold',
  },
  countdownSubLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Orbitron-Regular',
  },
  phaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  phaseLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 1,
  },
  phaseDescription: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    flex: 1,
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
  },
  progressText: {
    position: 'absolute',
    right: 8,
    top: -16,
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Bold',
  },
  scrollContent: {
    flex: 1,
  },
  criticalCountdown: {
    borderColor: 'rgba(255, 68, 68, 0.5)',
    borderWidth: 2,
  },
  loadingParticleLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    pointerEvents: 'none',
  },
  loadingParticle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    opacity: 0.6,
  },
  enhancedLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    zIndex: 2,
  },
  loadingLogoContainer: {
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  loadingLogoGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  loadingLogoGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  loadingAnimationContainer: {
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  loadingSpinnerContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  loadingSpinnerRing: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  loadingSpinnerCenter: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loadingProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md,
    width: 80,
    alignItems: 'center',
  },
  loadingProgressBar: {
    width: 8,
    height: 40,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  loadingProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  loadingProgress1: {
    backgroundColor: '#9945FF',
  },
  loadingProgress2: {
    backgroundColor: '#14F195',
  },
  loadingProgress3: {
    backgroundColor: '#FFD700',
  },
  loadingTextContainer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  loadingTextGradient: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: 12,
  },
  enhancedLoadingTitle: {
    fontSize: isTablet ? 32 : 24,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    fontFamily: 'Orbitron-Bold',
    letterSpacing: 2,
  },
  enhancedLoadingSubtitle: {
    fontSize: isTablet ? 18 : 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontFamily: 'Orbitron-Regular',
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#14F195',
    marginHorizontal: 4,
  },
  enhancedRetryButton: {
    marginTop: SPACING.xl,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#9945FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  enhancedRetryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  enhancedRetryText: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Orbitron-Bold',
  },
  connectionStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  connectionStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#14F195',
    marginRight: SPACING.sm,
  },
  connectionStatusText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Orbitron-Regular',
  },
  racingTrackContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
    pointerEvents: 'none',
  },
  racingTrackLine: {
    position: 'absolute',
    width: 120,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    opacity: 0.3,
  },
})
