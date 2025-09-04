import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg'

interface CircularCountdownProps {
  totalSeconds: number
  secondsLeft: number
  label?: string
}

export function CircularCountdown({ totalSeconds, secondsLeft, label }: CircularCountdownProps) {
  const size = 96
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  const clampedLeft = Math.max(0, Math.min(secondsLeft, totalSeconds))
  const progress = totalSeconds > 0 ? clampedLeft / totalSeconds : 0

  const anim = useRef(new Animated.Value(progress)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [progress])

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, circumference],
  })

  const color = useMemo(() => {
    if (progress > 0.4) return '#00FF88' // green
    if (progress > 0.15) return '#FFD700' // amber
    return '#FF4444' // red
  }, [progress])

  const format = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = Math.floor(s % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.3} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={Animated.subtract(circumference, strokeDashoffset) as any}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.centerContent}>
        <Text style={[styles.time, { color }]}>{format(clampedLeft)}</Text>
        {label ? <Text style={styles.sub}>{label}</Text> : null}
      </View>
    </View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const styles = StyleSheet.create({
  container: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
  },
  time: {
    fontSize: 18,
    fontFamily: 'Sora-Bold',
  },
  sub: {
    marginTop: 2,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Regular',
  },
})
