import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'

type Phase = 'commit' | 'performance' | 'settled'

interface PhaseTrackerProps {
  currentPhase: Phase
}

const STEPS = ['Commit', 'Lock', 'Reveal'] as const

export function PhaseTracker({ currentPhase }: PhaseTrackerProps) {
  const stepIndex = useMemo(() => (currentPhase === 'commit' ? 0 : currentPhase === 'performance' ? 1 : 2), [
    currentPhase,
  ])

  const progress = useRef(new Animated.Value(stepIndex)).current
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: stepIndex,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()

    Animated.sequence([
      Animated.spring(pulse, { toValue: 1.12, useNativeDriver: true, speed: 12, bounciness: 8 }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 6 }),
    ]).start()
  }, [stepIndex])

  const connector1Scale = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 1] })
  const connector2Scale = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0, 1] })
  const [trackW1, setTrackW1] = useState(60)
  const [trackW2, setTrackW2] = useState(60)

  return (
    <View style={styles.container}>
      {STEPS.map((label, i) => {
        const active = i === stepIndex
        return (
          <React.Fragment key={label}>
            <Animated.View style={[styles.dotContainer, active && { transform: [{ scale: pulse }] }]}>
              <View style={[styles.dot, active && styles.dotActive]} />
              <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
            </Animated.View>
            {i < STEPS.length - 1 && (
              <View
                style={styles.connectorTrack}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width
                  if (i === 0) setTrackW1(w)
                  else setTrackW2(w)
                }}
              >
                <Animated.View
                  style={[
                    styles.connectorFill,
                    i === 0
                      ? { width: connector1Scale.interpolate({ inputRange: [0, 1], outputRange: [0, trackW1] }) }
                      : { width: connector2Scale.interpolate({ inputRange: [0, 1], outputRange: [0, trackW2] }) },
                  ]}
                />
              </View>
            )}
          </React.Fragment>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dotContainer: {
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
  },
  dotActive: {
    backgroundColor: '#14F195',
    shadowColor: '#14F195',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Regular',
  },
  labelActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  connectorTrack: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  connectorFill: {
    height: '100%',
    backgroundColor: '#14F195',
    width: 0,
  },
})
