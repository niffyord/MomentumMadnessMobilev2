import React, {
  useEffect,
  useRef,
} from 'react'

import { LinearGradient } from 'expo-linear-gradient'
import {
  Animated,
  Dimensions,
  StyleSheet,
  View,
} from 'react-native'

const {width, height} = Dimensions.get('window');

/**
 * Clean road-style background with three lanes: left shoulder, center line, and right shoulder.
 * Features subtle pulsing and flowing animations to suggest movement and momentum.
 */
export default function NeonTrackBackground() {
  // Simple animation values for road effects
  const roadPulse = useRef(new Animated.Value(0)).current;
  const centerLineDash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle road pulsing animation - very gentle
    Animated.loop(
      Animated.sequence([
        Animated.timing(roadPulse, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(roadPulse, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Center line dashed animation - flowing downward
    Animated.loop(
      Animated.timing(centerLineDash, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  // Interpolations for subtle effects
  const roadOpacity = roadPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.3],
  });

  const dashOffset = centerLineDash.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60], // Dash length for flowing effect
  });

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Left Shoulder Line */}
      <Animated.View
        style={[styles.shoulderLine, styles.leftShoulder, {opacity: roadOpacity}]}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.8)']}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}
          style={styles.lineGradient}
        />
      </Animated.View>

      {/* Center Dashed Line */}
      <View style={styles.centerLaneContainer}>
        {/* Create dashed line effect with multiple segments */}
        {Array.from({ length: Math.ceil(height / 40) }).map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.centerDash,
              {
                top: index * 40,
                opacity: roadOpacity,
                transform: [{
                  translateY: dashOffset.interpolate({
                    inputRange: [0, 60],
                    outputRange: [0, 60],
                  }),
                }],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.9)', 'rgba(255, 215, 0, 0.6)', 'rgba(255, 215, 0, 0.9)']}
              start={{x: 0, y: 0}}
              end={{x: 0, y: 1}}
              style={styles.dashGradient}
            />
          </Animated.View>
        ))}
      </View>

      {/* Right Shoulder Line */}
      <Animated.View
        style={[styles.shoulderLine, styles.rightShoulder, {opacity: roadOpacity}]}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.8)']}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}
          style={styles.lineGradient}
        />
      </Animated.View>

      {/* Subtle road surface glow */}
      <Animated.View 
        style={[
          styles.roadSurface,
          {
            opacity: roadPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.02, 0.08],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={[
            'transparent',
            'rgba(255, 255, 255, 0.1)',
            'transparent',
          ]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  // Road Shoulder Lines (left and right edges)
  shoulderLine: {
    position: 'absolute',
    width: 2,
    height: '100%',
    shadowColor: '#FFFFFF',
    shadowOffset: {width: 0, height: 0},
    shadowRadius: 4,
    shadowOpacity: 0.3,
    elevation: 2,
  },
  lineGradient: {
    flex: 1,
    borderRadius: 1,
  },
  leftShoulder: {
    left: width * 0.08, // Far left side
  },
  rightShoulder: {
    right: width * 0.08, // Far right side
  },

  // Center Dashed Line
  centerLaneContainer: {
    position: 'absolute',
    left: width * 0.5 - 1, // Perfect center
    width: 2,
    height: '100%',
  },
  centerDash: {
    position: 'absolute',
    width: 2,
    height: 20, // Dash length
    shadowColor: '#FFD700',
    shadowOffset: {width: 0, height: 0},
    shadowRadius: 3,
    shadowOpacity: 0.4,
    elevation: 2,
  },
  dashGradient: {
    flex: 1,
    borderRadius: 1,
  },

  // Subtle road surface effect
  roadSurface: {
    position: 'absolute',
    left: width * 0.1,
    right: width * 0.1,
    top: 0,
    bottom: 0,
    borderRadius: 0,
  },
}); 