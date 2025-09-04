import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Dimensions, Platform, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const { width: W, height: H } = Dimensions.get('window')

type Dot = { x: number; y: number; size: number; opacity: number; color: string }

function makeDots(count: number, sizeRange: [number, number], opacityRange: [number, number], color: string): Dot[] {
  const [minS, maxS] = sizeRange
  const [minO, maxO] = opacityRange
  return Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    size: Math.max(1, Math.random() * (maxS - minS) + minS),
    opacity: Math.random() * (maxO - minO) + minO,
    color,
  }))
}

export default function CosmicBackground({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const check = async () => {
      if (Platform.OS === 'ios') {
        try {
          const rm = await AccessibilityInfo.isReduceMotionEnabled()
          setReduceMotion(rm)
        } catch {}
      }
    }
    check()
  }, [])

  // Layers
  const far = useMemo(() => makeDots(120, [2, 3], [0.6, 0.85], 'rgba(255,255,255,1)'), [])
  const mid = useMemo(() => makeDots(90, [3, 4], [0.75, 0.95], 'rgba(255,255,255,1)'), [])
  const near = useMemo(() => makeDots(60, [4, 5], [0.85, 1], 'rgba(255,255,255,1)'), [])
  const accent = useMemo(
    () =>
      [
        ...makeDots(12, [5, 7], [0.85, 1], '#FFD700'), // gold
        ...makeDots(8, [5, 7], [0.85, 1], '#14F195'), // neon green
        ...makeDots(8, [5, 7], [0.85, 1], '#9945FF'), // purple
      ],
    [],
  )

  // Slow drift
  const a1 = useRef(new Animated.Value(0)).current
  const a2 = useRef(new Animated.Value(0)).current
  const a3 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduceMotion) return
    const loop = (val: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration, useNativeDriver: true }),
        ]),
      )
    const l1 = loop(a1, 100000)
    const l2 = loop(a2, 75000)
    const l3 = loop(a3, 50000)
    l1.start(); l2.start(); l3.start()
    return () => { l1.stop(); l2.stop(); l3.stop(); a1.setValue(0); a2.setValue(0); a3.setValue(0) }
  }, [reduceMotion, a1, a2, a3])

  const drift = (val: Animated.Value, distance: number) => val.interpolate({ inputRange: [0, 1], outputRange: [0, distance] })
  const dy1 = drift(a1, H * 0.12)
  const dy2 = drift(a2, H * -0.12)
  const dy3 = drift(a3, H * 0.18)

  const DotLayer = ({ dots, dy }: { dots: Dot[]; dy: Animated.AnimatedInterpolation<number> }) => (
    <Animated.View
      style={[styles.layer, { transform: [{ translateY: dy }] }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {dots.map((d, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: d.x,
            top: d.y,
            width: d.size,
            height: d.size,
            borderRadius: d.size / 2,
            backgroundColor: d.color,
            opacity: d.opacity,
          }}
        />
      ))}
    </Animated.View>
  )

  return (
    <View style={styles.container}>
      {/* Mesh-like gradient backdrop */}
      <LinearGradient
        colors={["#0b0f1a", "#150e2c", "#050816"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      {/* Star layers */}
      {reduceMotion ? (
        <>
          <DotLayer dots={[...far, ...mid, ...near, ...accent]} dy={new Animated.Value(0) as any} />
        </>
      ) : (
        <>
          <DotLayer dots={far} dy={dy1} />
          <DotLayer dots={mid} dy={dy2} />
          <DotLayer dots={near} dy={dy3} />
          <DotLayer dots={accent} dy={dy3} />
        </>
      )}

      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050816' },
  gradient: { ...StyleSheet.absoluteFillObject },
  layer: { ...StyleSheet.absoluteFillObject },
})

