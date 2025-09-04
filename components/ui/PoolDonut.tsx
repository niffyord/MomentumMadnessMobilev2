import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

interface PoolDonutProps {
  totalPoolUsd: number // already in USD
  yourBetUsd: number // planned/entered bet in USD
  title?: string
}

export function PoolDonut({ totalPoolUsd, yourBetUsd, title = 'Pool Dynamics' }: PoolDonutProps) {
  const size = 140
  const strokeBase = 14
  const radius = (size - strokeBase) / 2
  const circumference = 2 * Math.PI * radius

  const target = Math.max(100, totalPoolUsd) // prevent zero target
  const growthFactor = Math.min(1.15, 0.85 + Math.log10(target + 10) / 10) // subtle growth with pool size
  const stroke = strokeBase * growthFactor

  const share = useMemo(() => {
    const total = totalPoolUsd + Math.max(0, yourBetUsd)
    return total > 0 ? Math.max(0, Math.min(1, yourBetUsd / total)) : 0
  }, [totalPoolUsd, yourBetUsd])

  const animShare = useRef(new Animated.Value(share)).current
  const pulse = useRef(new Animated.Value(1)).current
  const prevTotal = useRef(totalPoolUsd)

  useEffect(() => {
    Animated.timing(animShare, {
      toValue: share,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [share])

  useEffect(() => {
    if (totalPoolUsd > prevTotal.current) {
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1.05, useNativeDriver: true, speed: 10, bounciness: 6 }),
        Animated.spring(pulse, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 6 }),
      ]).start()
    }
    prevTotal.current = totalPoolUsd
  }, [totalPoolUsd])

  const dashOffset = animShare.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] })

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#14F195"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset as any}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            fill="none"
          />
        </Svg>
      </Animated.View>
      <View style={styles.centerOverlay} pointerEvents="none">
        <Text style={styles.centerValue}>{(share * 100).toFixed(1)}%</Text>
        <Text style={styles.centerLabel}>Your Share</Text>
        <Text style={styles.centerSub}>Pool {formatUsd(totalPoolUsd)}</Text>
      </View>
    </View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const formatUsd = (usd: number) => {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`
  return `$${usd.toFixed(0)}`
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', marginBottom: 12 },
  title: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
  centerOverlay: {
    position: 'absolute',
    top: 38,
    alignItems: 'center',
  },
  centerValue: { fontSize: 18, color: '#14F195', fontFamily: 'Sora-Bold' },
  centerLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter-SemiBold' },
  centerSub: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontFamily: 'Inter-Regular' },
})
