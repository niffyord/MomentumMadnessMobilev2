import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Dimensions, Platform, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const { width: W, height: H } = Dimensions.get('window')
// Using plain LinearGradient to avoid insertion-effect edge cases

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

  // Layers (reduced density and brightness for readability)
  const far = useMemo(() => makeDots(90, [2, 3], [0.25, 0.6], 'rgba(255,255,255,1)'), [])
  const mid = useMemo(() => makeDots(60, [3, 4], [0.3, 0.65], 'rgba(255,255,255,1)'), [])
  const near = useMemo(() => makeDots(40, [4, 5], [0.35, 0.7], 'rgba(255,255,255,1)'), [])
  const accent = useMemo(
    () =>
      [
        ...makeDots(6, [5, 7], [0.5, 0.8], '#FFD700'), // gold
        ...makeDots(5, [5, 7], [0.5, 0.8], '#14F195'), // neon green
        ...makeDots(5, [5, 7], [0.5, 0.8], '#9945FF'), // purple
      ],
    [],
  )

  // Slow drift + ambient effects
  const a1 = useRef(new Animated.Value(0)).current
  const a2 = useRef(new Animated.Value(0)).current
  const a3 = useRef(new Animated.Value(0)).current
  const aurora1 = useRef(new Animated.Value(0)).current
  const aurora2 = useRef(new Animated.Value(0)).current
  const shimmer = useRef(new Animated.Value(0)).current
  const comet = useRef(new Animated.Value(0)).current
  const cometSeedVal = useRef(new Animated.Value(Math.random())).current
  const cometBaseOffset = useRef(new Animated.Value(H * 0.15)).current

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
    const la1 = loop(aurora1, 60000)
    const la2 = loop(aurora2, 90000)
    const ls = loop(shimmer, 22000)
    l1.start(); l2.start(); l3.start(); la1.start(); la2.start(); ls.start()
    return () => {
      l1.stop(); l2.stop(); l3.stop(); la1.stop(); la2.stop(); ls.stop();
      a1.setValue(0); a2.setValue(0); a3.setValue(0); aurora1.setValue(0); aurora2.setValue(0); shimmer.setValue(0)
    }
  }, [reduceMotion, a1, a2, a3, aurora1, aurora2, shimmer])

  // Comet spawner
  useEffect(() => {
    if (reduceMotion) return
    let cancelled = false
    const spawn = () => {
      if (cancelled) return
      cometSeedVal.setValue(Math.random())
      comet.setValue(0)
      Animated.timing(comet, { toValue: 1, duration: 2600, useNativeDriver: true }).start(() => {
        if (!cancelled) setTimeout(spawn, 14000 + Math.random() * 10000)
      })
    }
    const t = setTimeout(spawn, 8000 + Math.random() * 6000)
    return () => { cancelled = true; clearTimeout(t) }
  }, [reduceMotion, comet, cometSeedVal])

  const drift = (val: Animated.Value, distance: number) => val.interpolate({ inputRange: [0, 1], outputRange: [0, distance] })
  const dy1 = drift(a1, H * 0.12)
  const dy2 = drift(a2, H * -0.12)
  const dy3 = drift(a3, H * 0.18)
  const auroraTranslateY1 = aurora1.interpolate({ inputRange: [0, 1], outputRange: [H * 0.05, H * -0.02] })
  const auroraTranslateY2 = aurora2.interpolate({ inputRange: [0, 1], outputRange: [H * -0.04, H * 0.03] })
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.6, W * 0.6] })

  // Comet path
  const cometTranslateX = comet.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.2, W * 1.2] })
  const cometTranslateY = Animated.add(
    Animated.add(Animated.multiply(cometSeedVal, H * 0.5), cometBaseOffset),
    Animated.multiply(comet, -H * 0.15),
  )

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

  const AuroraRibbon = ({ variant }: { variant: 1 | 2 }) => (
    <LinearGradient
      colors={
        variant === 1
          ? ['rgba(153,69,255,0.0)', 'rgba(153,69,255,0.28)', 'rgba(20,241,149,0.0)']
          : ['rgba(20,241,149,0.0)', 'rgba(20,241,149,0.24)', 'rgba(255,215,0,0.0)']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.aurora}
    />
  )

  const ShimmerSweep = () => (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shimmer,
        {
          transform: [{ translateX: shimmerX }, { rotate: '-18deg' }],
          opacity: 0.12,
        },
      ]}
    />
  )

  const Comet = () => (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.comet,
        {
          transform: [
            { translateX: cometTranslateX },
            { translateY: cometTranslateY },
            { rotate: '-22deg' },
          ],
          opacity: comet.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
        },
      ]}
    >
      <LinearGradient
        colors={[`rgba(255,255,255,0.6)`, 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.cometTail}
      />
      <View style={styles.cometHead} />
    </Animated.View>
  )

  return (
    <View style={styles.container}>
      {/* Mesh-like gradient backdrop */}
      <LinearGradient
        colors={["#070913", "#0f0a1e", "#060914"]}
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
          {/* Aurora ribbons under stars for depth */}
          <Animated.View style={[styles.auroraWrap, { transform: [{ translateY: auroraTranslateY1 }] }]}> 
            <AuroraRibbon variant={1} />
          </Animated.View>
          <Animated.View style={[styles.auroraWrap2, { transform: [{ translateY: auroraTranslateY2 }] }]}> 
            <AuroraRibbon variant={2} />
          </Animated.View>
          <DotLayer dots={far} dy={dy1} />
          <DotLayer dots={mid} dy={dy2} />
          <DotLayer dots={near} dy={dy3} />
          <DotLayer dots={accent} dy={dy3} />
          {/* Soft shimmer sweep above stars */}
          <ShimmerSweep />
          {/* Occasional comet (always mounted, opacity animated) */}
          <Comet />
        </>
      )}

      {/* Global scrim to ensure text readability */}
      <View pointerEvents="none" style={styles.scrim} />
      {/* Edge vignettes to gently darken edges */}
      <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.35)", "transparent"]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={styles.vignetteTop} />
      <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.35)"]} start={{x:0.5,y:0}} end={{x:0.5,y:1}} style={styles.vignetteBottom} />
      <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.25)", "transparent"]} start={{x:0,y:0.5}} end={{x:1,y:0.5}} style={styles.vignetteLeft} />
      <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.25)"]} start={{x:0,y:0.5}} end={{x:1,y:0.5}} style={styles.vignetteRight} />

      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050816' },
  gradient: { ...StyleSheet.absoluteFillObject },
  layer: { ...StyleSheet.absoluteFillObject },
  auroraWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  auroraWrap2: {
    ...StyleSheet.absoluteFillObject,
  },
  aurora: {
    position: 'absolute',
    width: W * 1.8,
    height: H * 0.6,
    top: H * 0.1,
    left: -W * 0.4,
    borderRadius: 40,
    transform: [{ rotate: '-18deg' }],
    opacity: 0.16,
  },
  shimmer: {
    position: 'absolute',
    top: H * 0.2,
    left: -W * 0.6,
    width: W * 1.1,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
  },
  comet: {
    position: 'absolute',
    width: 180,
    height: 6,
    overflow: 'visible',
  },
  cometTail: {
    position: 'absolute',
    left: 0,
    top: 2,
    width: 160,
    height: 2,
    borderRadius: 2,
  },
  cometHead: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  vignetteLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 60,
  },
  vignetteRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 60,
  },
})
