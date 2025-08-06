import { useEffect, useState } from 'react'
import { SplashScreen } from 'expo-router'

import { useAuth } from '@/components/auth/auth-provider'

// Ensures the splash screen never blocks the UI for more than a few seconds.
export function AppSplashController() {
  const { isLoading } = useAuth()
  const [hasHidden, setHasHidden] = useState(false)

  // Hide as soon as auth loading completes
  useEffect(() => {
    if (!isLoading && !hasHidden) {
      SplashScreen.hideAsync()
      setHasHidden(true)
    }
  }, [isLoading, hasHidden])

  // Fallback – hide after 8 s even if auth is still loading (slow devices)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasHidden) {
        SplashScreen.hideAsync()
        setHasHidden(true)
      }
    }, 8000)

    return () => clearTimeout(timer)
  }, [hasHidden])

  return null
}
