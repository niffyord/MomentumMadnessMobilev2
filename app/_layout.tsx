import 'react-native-reanimated'

import { useCallback } from 'react'

import { useFonts } from 'expo-font'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'
import {
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'

import { AppProviders } from '@/components/app-providers'
import { AppSplashController } from '@/components/app-splash-controller'
import { useAuth } from '@/components/auth/auth-provider'
import { useTrackLocations } from '@/hooks/use-track-locations'
import { PortalHost } from '@rn-primitives/portal'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  // Use this hook to track the locations for analytics or debugging.
  // Delete if you don't need it.
  useTrackLocations((pathname, params) => {
    console.log(`Track ${pathname}`, { params })
  })
  const [loaded] = useFonts({
    // Legacy fonts still loaded for screens not migrated yet
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Orbitron-Regular': require('../assets/fonts/Orbitron-Regular.ttf'),
    'Orbitron-Medium': require('../assets/fonts/Orbitron-Medium.ttf'),
    'Orbitron-SemiBold': require('../assets/fonts/Orbitron-SemiBold.ttf'),
    'Orbitron-Bold': require('../assets/fonts/Orbitron-Bold.ttf'),
    'Orbitron-ExtraBold': require('../assets/fonts/Orbitron-ExtraBold.ttf'),
    'Orbitron-Black': require('../assets/fonts/Orbitron-Black.ttf'),

    // New top-tier fonts
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,

    'Sora-SemiBold': Sora_600SemiBold,
    'Sora-Bold': Sora_700Bold,
    'Sora-ExtraBold': Sora_800ExtraBold,
  })

  const onLayoutRootView = useCallback(async () => {
    console.log('onLayoutRootView')
    if (loaded) {
      console.log('loaded')
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      await SplashScreen.hideAsync()
    }
  }, [loaded])

  if (!loaded) {
    // Async font loading only occurs in development.
    return null
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AppProviders>
        <AppSplashController />
        <RootNavigator />
        <StatusBar style="auto" />
      </AppProviders>
      <PortalHost />
    </View>
  )
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth()

  // Avoid flicker to sign-in screen while the cache is still loading
  if (isLoading) {
    return null
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  )
}
