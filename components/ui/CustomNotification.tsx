import React, {
  useEffect,
  useRef,
} from 'react'

import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MaterialCommunityIcons } from '@expo/vector-icons'

const { width: screenWidth } = Dimensions.get('window')

interface NotificationProps {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  title?: string
  visible: boolean
  onDismiss: () => void
  duration?: number
}

const NOTIFICATION_CONFIG = {
  success: {
    icon: 'check-circle' as const,
    colors: ['rgba(0, 255, 136, 0.95)', 'rgba(20, 241, 149, 0.85)'],
    borderColor: 'rgba(0, 255, 136, 0.6)',
    textColor: '#000000',
    shadowColor: 'rgba(0, 255, 136, 0.8)',
  },
  error: {
    icon: 'alert-circle' as const,
    colors: ['rgba(255, 68, 68, 0.95)', 'rgba(255, 107, 107, 0.85)'],
    borderColor: 'rgba(255, 68, 68, 0.6)',
    textColor: '#FFFFFF',
    shadowColor: 'rgba(255, 68, 68, 0.8)',
  },
  warning: {
    icon: 'alert' as const,
    colors: ['rgba(255, 215, 0, 0.95)', 'rgba(255, 193, 7, 0.85)'],
    borderColor: 'rgba(255, 215, 0, 0.6)',
    textColor: '#000000',
    shadowColor: 'rgba(255, 215, 0, 0.8)',
  },
  info: {
    icon: 'information' as const,
    colors: ['rgba(153, 69, 255, 0.95)', 'rgba(20, 241, 149, 0.85)'],
    borderColor: 'rgba(153, 69, 255, 0.6)',
    textColor: '#FFFFFF',
    shadowColor: 'rgba(153, 69, 255, 0.8)',
  },
}

export const CustomNotification: React.FC<NotificationProps> = ({
  type,
  message,
  title,
  visible,
  onDismiss,
  duration = 3000,
}) => {
  const insets = useSafeAreaInsets()
  const slideAnim = useRef(new Animated.Value(-100)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current
  const timeoutRef = useRef<NodeJS.Timeout>()

  const config = NOTIFICATION_CONFIG[type]

  useEffect(() => {
    if (visible) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Show animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start()

      // Auto dismiss
      timeoutRef.current = setTimeout(() => {
        handleDismiss()
      }, duration)
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start()
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [visible, duration])

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDismiss()
  }

  if (!visible && slideAnim._value <= -50) {
    return null
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + (Platform.OS === 'android' ? 10 : 5),
          opacity: opacityAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={handleDismiss}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={config.colors}
          style={[
            styles.notification,
            {
              borderColor: config.borderColor,
              shadowColor: config.shadowColor,
            },
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {/* Ultra-thin glass effect overlay */}
          <View style={styles.glassOverlay} />
          
          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name={config.icon}
                size={18}
                color={config.textColor}
              />
            </View>
            
            <View style={styles.textContainer}>
              {title && (
                <Text style={[styles.title, { color: config.textColor }]}>
                  {title}
                </Text>
              )}
              <Text style={[styles.message, { color: config.textColor }]}>
                {message}
              </Text>
            </View>
            
            {/* Dismiss button */}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={14}
                color={config.textColor}
                style={{ opacity: 0.7 }}
              />
            </TouchableOpacity>
          </View>
          
          {/* Ultra-thin progress bar */}
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: config.textColor,
                transform: [{
                  scaleX: opacityAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                }],
              },
            ]}
          />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
  },
  touchable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  notification: {
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
    overflow: 'hidden',
    minHeight: 56, // Ultra-thin height
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)', // For iOS
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 2,
  },
  iconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Orbitron-Bold',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Orbitron-Regular',
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  dismissButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
    transformOrigin: 'left center',
  },
}) 