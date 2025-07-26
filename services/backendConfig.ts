import { Platform } from 'react-native'

export const getBackendBaseUrl = (): string => {
  // Use the hosted backend for all platforms
  return 'https://mmadness.fly.dev';
}; 