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
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  View,
} from 'react-native'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

interface StarConfig {
  x: number
  y: number
  size: number
  speed: number
  twinkleSpeed: number
  color: string
}

interface FixedStarConfig {
  x: number
  y: number
  size: number
  twinklePhase: number
  candleType: 'bullish' | 'bearish'
  bodyHeight: number
  upperWick: number
  lowerWick: number
}

interface StaticDotConfig {
  x: number
  y: number
  size: number
}

interface ShootingStarConfig {
  startX: number
  startY: number
  endX: number
  endY: number
  duration: number
}

interface ConstellationConfig {
  dots: { x: number; y: number }[]
}

interface AnimatedSpaceBackgroundProps {
  children: React.ReactNode
}

/*
 * PERFORMANCE OPTIMIZATIONS IMPLEMENTED:
 * 
 * 1. ✅ MEMOIZED STAR GENERATION - All expensive star/candle/dot generation
 *    functions are memoized with useCallback to prevent recreation on every render
 * 
 * 2. ✅ MEMOIZED ARRAYS - All star arrays (210 stars + 25 candles + 60 dots)
 *    are generated once with useMemo instead of every render
 * 
 * 3. ✅ MEMOIZED RENDER FUNCTIONS - renderStarLayer, renderFixedStars, 
 *    renderStaticDots, renderConstellations are all memoized
 * 
 * 4. ✅ MEMORY LEAK PREVENTION - Proper cleanup of animations, intervals,
 *    and prevention of state updates after component unmount
 * 
 * 5. ✅ ANIMATION CLEANUP - All animation refs are reset on unmount
 * 
 * 6. ✅ SAFE STATE UPDATES - Mount tracking prevents state updates after unmount
 * 
 * 7. ✅ ACCESSIBILITY - Respects reduced motion preferences
 * 
 * Total elements rendered: ~295 (210 moving stars + 25 candles + 60 dots)
 * All optimized for 60fps performance
 */

export default function AnimatedSpaceBackground({ children }: AnimatedSpaceBackgroundProps) {
  // Create multiple animation values for different star layers
  const starLayer1 = useRef(new Animated.Value(0)).current
  const starLayer2 = useRef(new Animated.Value(0)).current
  const starLayer3 = useRef(new Animated.Value(0)).current
  const twinkleAnim = useRef(new Animated.Value(0)).current
  const nebulaAnim = useRef(new Animated.Value(0)).current
  const fixedStarsTwinkle = useRef(new Animated.Value(0)).current
  const shootingStarAnim = useRef(new Animated.Value(0)).current
  const [currentShootingStar, setCurrentShootingStar] = useState<ShootingStarConfig | null>(null)
  
  // Add ref to track if component is mounted
  const isMountedRef = useRef(true)
  
  // Accessibility state for reduced motion
  const [reduceMotion, setReduceMotion] = useState(false)
  
  // Check accessibility settings
  useEffect(() => {
    const checkReduceMotion = async () => {
      if (Platform.OS === 'ios') {
        try {
          const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled()
          setReduceMotion(isReduceMotionEnabled)
        } catch (error) {
          console.warn('Failed to check reduce motion preference:', error)
          setReduceMotion(false)
        }
      }
    }
    checkReduceMotion()
  }, [])

  // Generate star configurations - MEMOIZED to prevent recreation on every render
  const generateStars = useCallback((count: number, sizeRange: [number, number], speedRange: [number, number]) => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * screenWidth,
      y: Math.random() * screenHeight,
      size: Math.random() * (sizeRange[1] - sizeRange[0]) + sizeRange[0],
      speed: Math.random() * (speedRange[1] - speedRange[0]) + speedRange[0],
      twinkleSpeed: Math.random() * 2 + 1,
      color: '#FFFFFF', // All stars are white
    }))
  }, [])

  // Generate fixed background trading candles - MEMOIZED
  const generateFixedStars = useCallback((count: number): FixedStarConfig[] => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * screenWidth,
      y: Math.random() * screenHeight,
      size: Math.random() * 4 + 3, // 3-7 width for thinner candles
      twinklePhase: Math.random() * 2 * Math.PI, // Random starting phase
      candleType: (Math.random() > 0.5 ? 'bullish' : 'bearish') as 'bullish' | 'bearish', // Random red/green
      bodyHeight: Math.random() * 8 + 6, // 6-14 height for smaller candle body
      upperWick: Math.random() * 4 + 1, // 1-5 upper wick length
      lowerWick: Math.random() * 4 + 1, // 1-5 lower wick length
    }))
  }, [])

  // Generate static white dot stars - MEMOIZED
  const generateStaticDots = useCallback((count: number): StaticDotConfig[] => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * screenWidth,
      y: Math.random() * screenHeight,
      size: Math.random() * 2 + 1, // 1-3 size for small dots
    }))
  }, [])

  // Generate constellation patterns from static dots - MEMOIZED
  const generateConstellations = useCallback((dots: StaticDotConfig[]): ConstellationConfig[] => {
    const constellations: ConstellationConfig[] = []
    
    // Create 3-4 small constellations
    for (let i = 0; i < 4; i++) {
      const availableDots = dots.slice(i * 15, (i + 1) * 15) // Take 15 dots per constellation
      if (availableDots.length >= 3) {
        // Sort by proximity to create natural groupings
        const centerDot = availableDots[Math.floor(availableDots.length / 2)]
        const nearbyDots = availableDots
          .sort((a, b) => {
            const distA = Math.sqrt((a.x - centerDot.x) ** 2 + (a.y - centerDot.y) ** 2)
            const distB = Math.sqrt((b.x - centerDot.x) ** 2 + (b.y - centerDot.y) ** 2)
            return distA - distB
          })
          .slice(0, Math.min(5, availableDots.length)) // Max 5 dots per constellation
        
        if (nearbyDots.length >= 3) {
          constellations.push({
            dots: nearbyDots.map(dot => ({ x: dot.x, y: dot.y }))
          })
        }
      }
    }
    
    return constellations
  }, [])

  // Generate shooting star path - MEMOIZED
  const generateShootingStar = useCallback((): ShootingStarConfig => {
    const side = Math.floor(Math.random() * 4) // 0: top, 1: right, 2: bottom, 3: left
    let startX, startY, endX, endY
    
    switch (side) {
      case 0: // top to bottom-right
        startX = Math.random() * screenWidth * 0.3
        startY = -50
        endX = startX + screenWidth * 0.7 + Math.random() * screenWidth * 0.3
        endY = screenHeight + 50
        break
      case 1: // right to bottom-left
        startX = screenWidth + 50
        startY = Math.random() * screenHeight * 0.3
        endX = -50
        endY = startY + screenHeight * 0.7 + Math.random() * screenHeight * 0.3
        break
      case 2: // bottom to top-left
        startX = screenWidth - Math.random() * screenWidth * 0.3
        startY = screenHeight + 50
        endX = startX - screenWidth * 0.7 - Math.random() * screenWidth * 0.3
        endY = -50
        break
      default: // left to top-right
        startX = -50
        startY = screenHeight - Math.random() * screenHeight * 0.3
        endX = screenWidth + 50
        endY = startY - screenHeight * 0.7 - Math.random() * screenHeight * 0.3
        break
    }
    
    return {
      startX,
      startY,
      endX,
      endY,
      duration: Math.random() * 1000 + 1500 // 1.5-2.5 seconds
    }
  }, [])

  // MEMOIZE expensive star generations - only create once!
  const backgroundStars = useMemo(() => generateStars(120, [1, 2], [0.3, 0.8]), [generateStars])
  const midgroundStars = useMemo(() => generateStars(60, [2, 3], [0.8, 1.5]), [generateStars])
  const foregroundStars = useMemo(() => generateStars(30, [3, 4], [1.5, 2.5]), [generateStars])
  const fixedStars = useMemo(() => generateFixedStars(25), [generateFixedStars])
  const staticDots = useMemo(() => generateStaticDots(60), [generateStaticDots])
  const constellations = useMemo(() => generateConstellations(staticDots), [generateConstellations, staticDots])

  useEffect(() => {
    isMountedRef.current = true // Mark component as mounted
    
    // Skip complex animations if user has reduced motion preference
    if (reduceMotion) {
      // Simple, minimal animations for accessibility
      const simpleAnimation = Animated.loop(
        Animated.timing(twinkleAnim, {
          toValue: 1,
          duration: 4000, // Slower for reduced motion
          useNativeDriver: true,
        })
      )
      simpleAnimation.start()
      
      return () => {
        isMountedRef.current = false
        simpleAnimation.stop()
        twinkleAnim.setValue(0)
      }
    }
    
    // Full animation suite for normal motion preferences
    const layer1Animation = Animated.loop(
      Animated.timing(starLayer1, {
        toValue: 1,
        duration: 60000, // 60 seconds for slow movement
        useNativeDriver: true,
      })
    )

    const layer2Animation = Animated.loop(
      Animated.timing(starLayer2, {
        toValue: 1,
        duration: 40000, // Faster movement
        useNativeDriver: true,
      })
    )

    const layer3Animation = Animated.loop(
      Animated.timing(starLayer3, {
        toValue: 1,
        duration: 25000, // Fastest movement
        useNativeDriver: true,
      })
    )

    // Twinkle effect for moving stars
    const twinkleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(twinkleAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    )

    // Separate twinkle animation for fixed stars
    const fixedStarsTwinkleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(fixedStarsTwinkle, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(fixedStarsTwinkle, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    )

    // Nebula movement
    const nebulaAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(nebulaAnim, {
          toValue: 1,
          duration: 15000,
          useNativeDriver: true,
        }),
        Animated.timing(nebulaAnim, {
          toValue: 0,
          duration: 15000,
          useNativeDriver: true,
        }),
      ])
    )

    layer1Animation.start()
    layer2Animation.start()
    layer3Animation.start()
    twinkleAnimation.start()
    fixedStarsTwinkleAnimation.start()
    nebulaAnimation.start()

    // Shooting star interval - every 12-18 seconds (only if not reduced motion)
    const shootingStarInterval = setInterval(() => {
      // Only update state if component is still mounted
      if (!isMountedRef.current) return
      
      const newShootingStar = generateShootingStar()
      setCurrentShootingStar(newShootingStar)
      
      shootingStarAnim.setValue(0)
      Animated.timing(shootingStarAnim, {
        toValue: 1,
        duration: newShootingStar.duration,
        useNativeDriver: true,
      }).start(() => {
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setCurrentShootingStar(null)
        }
      })
    }, Math.random() * 6000 + 12000) // 12-18 seconds

    return () => {
      isMountedRef.current = false // Mark component as unmounted
      
      // Stop all animations
      layer1Animation.stop()
      layer2Animation.stop()
      layer3Animation.stop()
      twinkleAnimation.stop()
      fixedStarsTwinkleAnimation.stop()
      nebulaAnimation.stop()
      
      // Clear interval
      clearInterval(shootingStarInterval)
      
      // Reset animation values to prevent memory leaks
      starLayer1.setValue(0)
      starLayer2.setValue(0)
      starLayer3.setValue(0)
      twinkleAnim.setValue(0)
      fixedStarsTwinkle.setValue(0)
      nebulaAnim.setValue(0)
      shootingStarAnim.setValue(0)
    }
  }, [reduceMotion, generateShootingStar]) // Re-run if reduceMotion changes

  const renderStarLayer = useCallback((stars: StarConfig[], animationValue: Animated.Value, layerIndex: number) => {
    return stars.map((star, index) => {
      const translateY = animationValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, screenHeight + 50],
      })

      const opacity = twinkleAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 1, 0.3],
      })

      const scale = twinkleAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.8, 1.2, 0.8],
      })

      return (
        <Animated.View
          key={`${layerIndex}-${index}`}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              backgroundColor: star.color,
              opacity: opacity,
              transform: [
                { translateY },
                { scale },
              ],
            },
          ]}
        />
      )
    })
  }, [twinkleAnim])

  const renderFixedStars = useCallback((stars: FixedStarConfig[]) => {
    return stars.map((star, index) => {
      const opacity = fixedStarsTwinkle.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.2, 0.4, 0.2], // Much more subtle opacity
      })

      const scale = fixedStarsTwinkle.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.95, 1.05, 0.95], // Very subtle scale animation
      })

      const candleColor = star.candleType === 'bullish' ? '#14F195' : '#FF4444'

      return (
        <Animated.View
          key={`candle-${index}`}
          style={[
            {
              position: 'absolute',
              left: star.x,
              top: star.y,
              alignItems: 'center',
              opacity: opacity,
              transform: [{ scale }],
            },
          ]}
        >
          {/* Upper Wick */}
          <View
            style={{
              width: 1,
              height: star.upperWick,
              backgroundColor: candleColor,
              opacity: 0.6, // More subtle wick
            }}
          />
          
          {/* Candle Body */}
          <View
            style={{
              width: star.size,
              height: star.bodyHeight,
              backgroundColor: candleColor,
              borderRadius: 1,
              opacity: 0.8, // Slightly transparent body
            }}
          />
          
          {/* Lower Wick */}
          <View
            style={{
              width: 1,
              height: star.lowerWick,
              backgroundColor: candleColor,
              opacity: 0.6, // More subtle wick
            }}
          />
        </Animated.View>
      )
    })
  }, [fixedStarsTwinkle])

  // Memoize static dots rendering for performance
  const renderStaticDots = useMemo(() => {
    return staticDots.map((dot, index) => (
      <Animated.View
        key={`static-dot-${index}`}
        style={[
          styles.staticDot,
          {
            left: dot.x,
            top: dot.y,
            width: dot.size,
            height: dot.size,
            backgroundColor: '#FFFFFF', // White dots
          },
        ]}
      />
    ))
  }, [staticDots])

  // Memoize constellation rendering for performance
  const renderConstellations = useMemo(() => {
    return constellations.map((constellation, constellationIndex) => (
      <View key={`constellation-${constellationIndex}`}>
        {constellation.dots.map((dot, dotIndex) => {
          if (dotIndex === constellation.dots.length - 1) return null
          
          const nextDot = constellation.dots[dotIndex + 1]
          const distance = Math.sqrt(
            (nextDot.x - dot.x) ** 2 + (nextDot.y - dot.y) ** 2
          )
          
          // Only draw lines between nearby dots (< 100px apart)
          if (distance > 100) return null
          
          const angle = Math.atan2(nextDot.y - dot.y, nextDot.x - dot.x)
          
          return (
            <View
              key={`line-${dotIndex}`}
              style={[
                styles.constellationLine,
                {
                  left: dot.x,
                  top: dot.y,
                  width: distance,
                  transform: [{ rotate: `${angle}rad` }],
                },
              ]}
            />
          )
        })}
      </View>
    ))
  }, [constellations])

  return (
    <View style={styles.container}>
      {/* Pure black space background */}
      <View style={styles.spaceBackground} />

      {/* Space Depth Gradients for dimensional feel */}
      <LinearGradient
        colors={[
          'rgba(0, 0, 40, 0.15)',
          'transparent',
          'rgba(0, 20, 60, 0.1)',
          'transparent',
          'rgba(0, 10, 30, 0.08)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.spaceDepthGradient}
      />

      {/* Color Temperature Variations */}
      <View style={styles.colorTemperatureZones}>
        {/* Blue zone */}
        <LinearGradient
          colors={[
            'rgba(100, 150, 255, 0.03)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.7 }}
          style={[styles.temperatureZone, { top: '10%', left: '20%', width: '40%', height: '30%' }]}
        />
        
        {/* Purple zone */}
        <LinearGradient
          colors={[
            'rgba(180, 100, 255, 0.04)',
            'transparent',
          ]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.3, y: 0.8 }}
          style={[styles.temperatureZone, { bottom: '20%', right: '15%', width: '35%', height: '25%' }]}
        />
        
        {/* Cyan zone */}
        <LinearGradient
          colors={[
            'rgba(100, 255, 220, 0.025)',
            'transparent',
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.temperatureZone, { top: '60%', left: '10%', width: '30%', height: '20%' }]}
        />
      </View>

      {/* Market Grid Hints - extremely subtle */}
      <View style={styles.marketGrid}>
        {/* Vertical lines */}
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={`grid-v-${i}`}
            style={[
              styles.gridLine,
              {
                left: `${15 + i * 14}%`,
                width: 1,
                height: '100%',
              },
            ]}
          />
        ))}
        {/* Horizontal lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={`grid-h-${i}`}
            style={[
              styles.gridLine,
              {
                top: `${10 + i * 11}%`,
                height: 1,
                width: '100%',
              },
            ]}
          />
        ))}
      </View>

      {/* Subtle nebula clouds for depth */}
      <Animated.View
        style={[
          styles.nebulaContainer,
          {
            opacity: nebulaAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.05, 0.15], // Much more subtle for space effect
            }),
            transform: [{
              translateX: nebulaAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 50],
              }),
            }],
          },
        ]}
      >
        <LinearGradient
          colors={[
            'transparent',
            'rgba(153, 69, 255, 0.1)',
            'rgba(255, 215, 0, 0.05)',
            'rgba(20, 241, 149, 0.08)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nebula}
        />
      </Animated.View>

      {/* Constellation Lines */}
      <View style={styles.constellationLayer}>
        {renderConstellations}
      </View>

      {/* Shooting Star */}
      {currentShootingStar && (
        <Animated.View
          style={[
            styles.shootingStar,
            {
              opacity: shootingStarAnim.interpolate({
                inputRange: [0, 0.1, 0.9, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateX: shootingStarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [currentShootingStar.startX, currentShootingStar.endX],
                  }),
                },
                {
                  translateY: shootingStarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [currentShootingStar.startY, currentShootingStar.endY],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0.8)',
              'rgba(200, 230, 255, 0.6)',
              'rgba(150, 200, 255, 0.3)',
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shootingStarTrail}
          />
        </Animated.View>
      )}

      {/* Multiple star layers for parallax effect */}
      <View style={styles.starField} pointerEvents="none">
        {/* Background stars (slowest) */}
        <View style={styles.starLayer}>
          {renderStarLayer(backgroundStars, starLayer1, 1)}
        </View>

        {/* Midground stars (medium speed) */}
        <View style={styles.starLayer}>
          {renderStarLayer(midgroundStars, starLayer2, 2)}
        </View>

        {/* Foreground stars (fastest) */}
        <View style={styles.starLayer}>
          {renderStarLayer(foregroundStars, starLayer3, 3)}
        </View>
      </View>

      {/* Fixed background trading candles */}
      <View style={styles.fixedStarsLayer}>
        {renderFixedStars(fixedStars)}
      </View>

      {/* Static white dot stars */}
      <View style={styles.staticDotsLayer}>
        {renderStaticDots}
      </View>

      {/* Content overlay */}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  spaceBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000', // Pure black space
  },
  nebulaContainer: {
    position: 'absolute',
    top: screenHeight * 0.2,
    left: screenWidth * 0.1,
    right: screenWidth * 0.1,
    height: screenHeight * 0.6,
  },
  nebula: {
    flex: 1,
    borderRadius: screenWidth * 0.3,
  },
  
  // Star field styles
  starField: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  starLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    borderRadius: 2,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 2,
  },
  fixedStarsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1, // Ensure it's behind moving stars
  },
  staticDotsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1, // Ensure it's behind moving stars
  },
  staticDot: {
    position: 'absolute',
    borderRadius: 1,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 1,
    elevation: 2,
  },
  spaceDepthGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1, // Ensure it's behind other content
  },
  colorTemperatureZones: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1, // Ensure it's behind other content
  },
  temperatureZone: {
    position: 'absolute',
    borderRadius: 100, // Large enough to cover the screen
    opacity: 0.5,
  },
  marketGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1, // Ensure it's behind other content
  },
  gridLine: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Very subtle grid lines
    opacity: 0.8,
  },
  constellationLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1, // Ensure it's behind other content
  },
  constellationLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Very subtle constellation lines
    borderRadius: 1,
    opacity: 0.7,
  },
  shootingStar: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
    zIndex: 1, // Above other content
  },
  shootingStarTrail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 5,
    opacity: 0.5,
  },
}) 