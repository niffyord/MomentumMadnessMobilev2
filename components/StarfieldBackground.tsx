import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Dimensions, Platform, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

type Star = { x: number; y: number; r: number; opacity: number }

function generateStars(count: number, sizeRange: [number, number]): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * screenWidth,
    y: Math.random() * screenHeight,
    r: Math.random() * (sizeRange[1] - sizeRange[0]) + sizeRange[0],
    opacity: Math.random() * 0.25 + 0.75, // brighter overall
  }))
}

export default function StarfieldBackground({ children }: { children: React.ReactNode }) {
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

  // Generate tiny stars for three parallax layers
  const layer1 = useMemo(() => generateStars(200, [2.0, 3.0]), []) // far, small
  const layer2 = useMemo(() => generateStars(140, [2.8, 4.2]), []) // mid
  const layer3 = useMemo(() => generateStars(100, [3.4, 5.2]), []) // near, largest
  const bright = useMemo(() => generateStars(28, [5.2, 7.0]), []) // a few bright stars

  // Animations: very slow vertical drift and gentle twinkle
  const a1 = useRef(new Animated.Value(0)).current
  const a2 = useRef(new Animated.Value(0)).current
  const a3 = useRef(new Animated.Value(0)).current
  const twinkle = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduceMotion) return

    const loop = (val: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.timing(val, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      )

    const l1 = loop(a1, 120000) // 120s
    const l2 = loop(a2, 90000) // 90s
    const l3 = loop(a3, 60000) // 60s

    const tw = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ]),
    )

    l1.start()
    l2.start()
    l3.start()
    tw.start()

    return () => {
      l1.stop()
      l2.stop()
      l3.stop()
      tw.stop()
      a1.setValue(0)
      a2.setValue(0)
      a3.setValue(0)
      twinkle.setValue(0)
    }
  }, [reduceMotion, a1, a2, a3, twinkle])

  const translateRange = screenHeight // loop over one screen height
  const t1 = a1.interpolate({ inputRange: [0, 1], outputRange: [0, translateRange] })
  const t2 = a2.interpolate({ inputRange: [0, 1], outputRange: [0, translateRange] })
  const t3 = a3.interpolate({ inputRange: [0, 1], outputRange: [0, translateRange] })

  const opacityFar = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.0] })
  const opacityMid = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.0] })
  const opacityNear = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.99, 1.0] })

  // Render a layer twice (shifted) to create a seamless loop
  const StarLayer = ({ stars, translate }: { stars: Star[]; translate: Animated.AnimatedInterpolation<number> }) => (
    <Animated.View style={[styles.layer, { transform: [{ translateY: translate }] }]}
                   pointerEvents="none"
                   accessibilityElementsHidden
                   importantForAccessibility="no-hide-descendants">
      <Svg width={screenWidth} height={screenHeight * 2}>
        {stars.map((s, i) => (
          <Circle key={`a-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.opacity} />
        ))}
        {stars.map((s, i) => (
          <Circle key={`b-${i}`} cx={s.x} cy={s.y + screenHeight} r={s.r} fill="#FFFFFF" opacity={s.opacity} />
        ))}
      </Svg>
    </Animated.View>
  )

  return (
    <View style={styles.container}>
      {/* Deep space gradient background */}
      <LinearGradient
        colors={["#050816", "#0b132b", "#000000"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.space}
      />

      {/* Star layers with subtle parallax drift */}
      {!reduceMotion && (
        <>
          <StarLayer stars={layer1} translate={t1} />
          <StarLayer stars={layer2} translate={t2} />
          <StarLayer stars={layer3} translate={t3} />
          <StarLayer stars={bright} translate={t3} />
        </>
      )}
      {reduceMotion && (
        <View style={styles.layer} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width={screenWidth} height={screenHeight}>
            {layer1.concat(layer2, layer3, bright).map((s, i) => (
              <Circle key={`rm-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.opacity} />
            ))}
          </Svg>
        </View>
      )}

      {/* Radial vignette to focus center and hide edges */}
      <View style={styles.vignette} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={screenWidth} height={screenHeight}>
          <Defs>
            <RadialGradient id="vignette" cx="50%" cy="45%" r="75%">
              <Stop offset="0%" stopColor="rgba(0,0,0,0)" />
              <Stop offset="70%" stopColor="rgba(0,0,0,0.08)" />
              <Stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={screenWidth} height={screenHeight} fill="url(#vignette)" />
        </Svg>
      </View>

      {/* Foreground content */}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  space: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
})
