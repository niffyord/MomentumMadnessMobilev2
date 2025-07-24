import React from 'react'

import * as Haptics from 'expo-haptics'
import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MaterialCommunityIcons } from '@expo/vector-icons'

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  
  const handleTabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
  
  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000814',
          borderTopWidth: 1,
          borderTopColor: 'rgba(153, 69, 255, 0.3)',
          height: 90 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : 16,
          paddingTop: 12,
          paddingHorizontal: 16,
          shadowColor: '#9945FF',
          shadowOffset: {
            width: 0,
            height: -4,
          },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 12,
        },
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
        tabBarLabelStyle: {
          fontFamily: 'Orbitron-SemiBold',
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          borderRadius: 12,
          marginHorizontal: 2,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
      }}
    >
      {/* The index redirects to the demo screen */}
      <Tabs.Screen name="index" options={{ tabBarItemStyle: { display: 'none' } }} />
      
      <Tabs.Screen
        name="demo"
        options={{
          title: 'Racing',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "lightning-bolt" : "lightning-bolt-outline"} 
              size={28} 
              color={focused ? '#FFD700' : color}
              style={{
                textShadowColor: focused ? '#FFD700' : 'transparent',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: focused ? 8 : 0,
              }}
            />
          ),
        }}
        listeners={{
          tabPress: handleTabPress,
        }}
      />
      
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "briefcase" : "briefcase-outline"} 
              size={28} 
              color={focused ? '#FFD700' : color}
              style={{
                textShadowColor: focused ? '#FFD700' : 'transparent',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: focused ? 8 : 0,
              }}
            />
          ),
        }}
        listeners={{
          tabPress: handleTabPress,
        }}
      />
    </Tabs>
  )
}
