import React, {
  useEffect,
  useRef,
} from 'react'

import { LinearGradient } from 'expo-linear-gradient'
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native'

import { MaterialCommunityIcons } from '@expo/vector-icons'

const { width: screenWidth } = Dimensions.get('window')

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface PremiumNotificationConfig {
  type: NotificationType
  title: string
  message: string
  actionText?: string
  onAction?: () => void
  duration?: number
  hapticPattern?: number[]
  icon?: string
  showConfetti?: boolean
}

interface NotificationProps extends PremiumNotificationConfig {
  visible: boolean
  onDismiss: () => void
}

const NOTIFICATION_CONFIGS = {
  success: {
    colors: ['#00FF88', '#FFD700'],
    iconColor: '#000',
    textColor: '#000',
    haptic: [100, 50, 100] as number[],
    icon: 'trophy',
  },
  error: {
    colors: ['#FF4444', '#FF6B6B'],
    iconColor: '#FFF',
    textColor: '#FFF',
    haptic: [50] as number[],
    icon: 'alert-circle',
  },
  warning: {
    colors: ['#FFD700', '#FFA000'],
    iconColor: '#000',
    textColor: '#000',
    haptic: [100] as number[],
    icon: 'alert',
  },
  info: {
    colors: ['#9945FF', '#6A1B9A'],
    iconColor: '#FFF',
    textColor: '#FFF',
    haptic: [50] as number[],
    icon: 'information',
  },
}

export function PremiumNotification({
  visible,
  type,
  title,
  message,
  actionText = 'OK',
  onAction,
  onDismiss,
  duration = 4000,
  hapticPattern,
  showConfetti = false,
}: NotificationProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const confettiAnim = useRef(new Animated.Value(0)).current

  const config = NOTIFICATION_CONFIGS[type]

  useEffect(() => {
    if (visible) {
      // Haptic feedback
      const pattern = hapticPattern || config.haptic
      if (Platform.OS === 'ios') {
        Vibration.vibrate(pattern)
      }

      // Entry animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()

      // Confetti animation for success
      if (type === 'success' && showConfetti) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(confettiAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(confettiAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 3 }
        ).start()
      }

      // Auto dismiss
      if (duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss()
        }, duration)

        return () => clearTimeout(timer)
      }
    } else {
      // Reset animations
      slideAnim.setValue(-100)
      scaleAnim.setValue(0.8)
      opacityAnim.setValue(0)
      confettiAnim.setValue(0)
    }
  }, [visible, type, duration])

  const handleDismiss = () => {
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
    ]).start(onDismiss)
  }

  const handleAction = () => {
    onAction?.()
    handleDismiss()
  }

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.notification}
      >
        {/* Confetti overlay for success */}
        {type === 'success' && showConfetti && (
          <Animated.View
            style={[
              styles.confettiOverlay,
              {
                opacity: confettiAnim,
                transform: [{
                  rotate: confettiAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                }],
              },
            ]}
          >
            <MaterialCommunityIcons name="party-popper" size={20} color={config.iconColor} />
            <MaterialCommunityIcons name="star" size={16} color={config.iconColor} />
            <MaterialCommunityIcons name="diamond" size={14} color={config.iconColor} />
          </Animated.View>
        )}

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={config.icon as any}
              size={24}
              color={config.iconColor}
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: config.textColor }]}>
              {title}
            </Text>
            <Text style={[styles.message, { color: config.textColor }]}>
              {message}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { borderColor: config.textColor }
            ]}
            onPress={handleAction}
          >
            <Text style={[styles.actionText, { color: config.textColor }]}>
              {actionText}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
        >
          <MaterialCommunityIcons
            name="close"
            size={18}
            color={config.iconColor}
          />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 20,
  },
  notification: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  confettiOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Orbitron-ExtraBold',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Orbitron-SemiBold',
    lineHeight: 18,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'Orbitron-ExtraBold',
  },
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// Notification Manager Hook
let notificationRef: ((config: PremiumNotificationConfig) => void) | null = null

export const setNotificationRef = (ref: (config: PremiumNotificationConfig) => void) => {
  notificationRef = ref
}

export const showPremiumNotification = (config: PremiumNotificationConfig) => {
  if (notificationRef) {
    notificationRef(config)
  } else {
    console.warn('Premium notification system not initialized')
  }
}

// Helper functions for common notifications
export const showSuccessNotification = (title: string, message: string) => {
  showPremiumNotification({
    type: 'success',
    title,
    message,
    showConfetti: true,
    hapticPattern: [100, 50, 100, 50, 100],
  })
}

export const showErrorNotification = (title: string, message: string, actionText?: string, onAction?: () => void) => {
  showPremiumNotification({
    type: 'error',
    title,
    message,
    actionText,
    onAction,
    duration: 6000, // Longer for errors
  })
} 