import React from 'react'

import { LinearGradient } from 'expo-linear-gradient'
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native'

import { MaterialCommunityIcons } from '@expo/vector-icons'

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * Premium call-to-action button with sophisticated neon styling.
 * Features gradient borders, glow effects, and professional animations.
 */
export default function NeonButton({
  title,
  onPress,
  disabled,
  loading,
  style,
}: Props) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;
  const {width: windowWidth} = useWindowDimensions();
  const computedWidth = Math.min(windowWidth * 0.88, 340);
  const loopRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const shimmerRef = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    if (!disabled && !loading) {
      // Pulse animation
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();
      loopRef.current = pulseLoop;

      // Shimmer animation
      const shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.delay(1000),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.delay(3000),
        ]),
      );
      shimmerLoop.start();
      shimmerRef.current = shimmerLoop;
    } else {
      loopRef.current?.stop();
      shimmerRef.current?.stop();
      loopRef.current = null;
      shimmerRef.current = null;
      pulseAnim.setValue(1);
      shimmerAnim.setValue(0);
    }
    return () => {
      loopRef.current?.stop();
      shimmerRef.current?.stop();
      loopRef.current = null;
      shimmerRef.current = null;
    };
  }, [disabled, loading, pulseAnim, shimmerAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          width: computedWidth,
          transform: [{scale: disabled || loading ? 1 : pulseAnim}],
        },
      ]}>
      {/* Multi-layer glow effects */}
      <View style={[styles.glowOuter, {opacity: disabled ? 0.2 : 0.6}]} />
      <View style={[styles.glowInner, {opacity: disabled ? 0.1 : 0.3}]} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={disabled}
        onPress={onPress}
        style={({pressed}) => [
          styles.pressable,
          {opacity: pressed ? 0.95 : disabled ? 0.6 : 1},
        ]}>
        <LinearGradient
          colors={['#FF00FF', '#FF6600', '#00FFFF', '#FF00FF']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.gradientBorder}>
          <LinearGradient
            colors={
              disabled || loading
                ? ['#2a2a3e', '#1a1a2e', '#2a2a3e']
                : ['#FF4500', '#FF6B35', '#FF8C00', '#FF4500']
            }
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.gradientInner}>
            {/* Enhanced highlights */}
            <View style={styles.highlight} />
            <View style={styles.bottomHighlight} />

            {/* Shimmer effect */}
            {!disabled && !loading && (
              <Animated.View
                style={[
                  styles.shimmer,
                  {
                    opacity: shimmerAnim,
                    transform: [
                      {
                        translateX: shimmerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-100, 100],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}

            <View style={styles.content}>
              {loading ? (
                <>
                  <Animated.View
                    style={[
                      styles.spinner,
                      {
                        transform: [
                          {
                            rotate: pulseAnim.interpolate({
                              inputRange: [1, 1.02],
                              outputRange: ['0deg', '360deg'],
                            }),
                          },
                        ],
                      },
                    ]}>
                    <ActivityIndicator size="small" color="#ffffff" />
                  </Animated.View>
                  <Text style={styles.loadingText}>Loading...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.title}>{title.toUpperCase()}</Text>
                  <MaterialCommunityIcons
                    name="flag"
                    size={24}
                    color="#ffffff"
                  />
                </>
              )}
            </View>
          </LinearGradient>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#FF4500',
    shadowOffset: {width: 0, height: 12},
    shadowRadius: 32,
    shadowOpacity: 0.8,
    borderRadius: 32,
    elevation: 20,
    alignSelf: 'center',
    minWidth: 0,
    maxWidth: 340,
  },
  glowOuter: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 40,
    backgroundColor: '#FF4500',
    zIndex: -2,
  },
  glowInner: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 36,
    backgroundColor: '#FF00FF',
    zIndex: -1,
  },
  pressable: {
    borderRadius: 32,
  },
  gradientBorder: {
    borderRadius: 32,
    padding: 3.5,
  },
  gradientInner: {
    borderRadius: 28.5,
    paddingVertical: 20,
    paddingHorizontal: 28,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#ffffff',
    opacity: 0.6,
  },
  bottomHighlight: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#ffffff',
    opacity: 0.2,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 50,
    backgroundColor: '#ffffff',
    opacity: 0.3,
    transform: [{skewX: '-20deg'}],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
  },
  icon: {
    marginRight: 4,
  },
  title: {
    fontFamily: 'Sora-Bold',
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1.2,
    textShadowColor: '#00000080',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  spinner: {
    marginRight: 4,
  },
  loadingText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
    opacity: 0.9,
  },
}); 
