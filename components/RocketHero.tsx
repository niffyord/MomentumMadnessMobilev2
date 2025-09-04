import React, {
  useEffect,
  useRef,
} from 'react'

import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Animated,
  Easing,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'

/**
 * Racing-themed rocket hero with momentum trails, speed effects, and dynamic animations.
 * Features rocket with exhaust trails, speed lines, and momentum-based particle effects.
 */
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function RocketHero() {
  const {width, height} = useWindowDimensions();
  const size = Math.min(width * 0.6, height * 0.28, 320);

  // Animation refs
  const entrance = useRef(new Animated.Value(0)).current;
  const rocketHover = useRef(new Animated.Value(0)).current;
  const rocketTilt = useRef(new Animated.Value(0)).current;
  const exhaustGlow = useRef(new Animated.Value(0)).current;
  const rocketBoost = useRef(new Animated.Value(0)).current;
  const thrusterPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Dramatic entrance animation
    Animated.spring(entrance, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
      delay: 300,
    }).start();

    // Rocket hover animation (floating effect)
    Animated.loop(
      Animated.sequence([
        Animated.timing(rocketHover, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(rocketHover, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Rocket tilt animation (dynamic racing feel)
    Animated.loop(
      Animated.sequence([
        Animated.timing(rocketTilt, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rocketTilt, {
          toValue: -1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rocketTilt, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Exhaust glow pulsing
    Animated.loop(
      Animated.sequence([
        Animated.timing(exhaustGlow, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(exhaustGlow, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Rocket boost effect (intermittent)
    const createBoostAnimation = () => {
      Animated.sequence([
        Animated.timing(rocketBoost, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rocketBoost, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(createBoostAnimation, Math.random() * 3000 + 2000);
      });
    };
    createBoostAnimation();

    // Thruster pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(thrusterPulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(thrusterPulse, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // Interpolations
  const translateY = Animated.add(
    entrance.interpolate({inputRange: [0, 1], outputRange: [40, 0]}),
    rocketHover.interpolate({inputRange: [0, 1], outputRange: [-6, 6]}),
  );

  const opacity = entrance;

  const rotate = rocketTilt.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-4deg', '0deg', '4deg'],
  });

  const boostScale = rocketBoost.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const exhaustOpacity = exhaustGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const thrusterScale = thrusterPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  // Handle rocket touch with haptic feedback
  const handleRocketPress = async () => {
    try {
      // Try multiple haptic feedback options for better device compatibility
      
      // First, try the strongest haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Add a second pulse for emphasis
      setTimeout(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 100);
      
      // Try notification feedback as well (different type of vibration)
      setTimeout(async () => {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 200);
      
    } catch (error) {
      // Fallback: Try selection feedback (lighter but should work on more devices)
      try {
        await Haptics.selectionAsync();
      } catch (fallbackError) {
        // Silent fail - haptics not critical to app function
      }
    }
    
    // Create a quick boost animation on touch
    Animated.sequence([
      Animated.timing(rocketBoost, {
        toValue: 1.2,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(rocketBoost, {
        toValue: 1,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      {/* Rocket Exhaust Glow (Flames) */}
      <AnimatedLinearGradient
        colors={[
          'rgba(255,69,0,0.8)',
          'rgba(255,140,0,0.6)',
          'rgba(255,255,0,0.4)',
        ]}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={[
          styles.exhaustGlow,
          {
            width: size * 0.6,
            height: size * 0.8,
            opacity: exhaustOpacity,
            transform: [
              {translateY: translateY},
              {translateY: size * 0.3},
              {scale: thrusterScale},
            ],
          },
        ]}
      />

      {/* Main Rocket - Touchable with Haptic Feedback */}
      <TouchableOpacity
        onPress={handleRocketPress}
        activeOpacity={0.8}
        style={styles.rocketTouchArea}
        accessibilityLabel="Racing rocket - tap for boost effect"
        accessibilityRole="button"
        accessibilityHint="Triggers a rocket boost animation with haptic feedback"
      >
        <Animated.Image
          source={require('../assets/images/rocket1.png')}
          style={[
            styles.rocketImg,
            {
              width: size,
              height: size,
              opacity,
              transform: [{translateY}, {rotate}, {scale: boostScale}],
            },
          ]}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 12,
    position: 'relative',
    minHeight: 200,
  },

  rocketTouchArea: {
    zIndex: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rocketImg: {
    zIndex: 5,
    shadowColor: '#00FFFF',
    shadowOffset: {width: 0, height: 8},
    shadowRadius: 20,
    shadowOpacity: 0.6,
  },

  exhaustGlow: {
    position: 'absolute',
    borderRadius: 100,
    zIndex: 2,
    shadowColor: '#FF4500',
    shadowOffset: {width: 0, height: 0},
    shadowRadius: 30,
    shadowOpacity: 0.8,
    elevation: 8,
  },
}); 
