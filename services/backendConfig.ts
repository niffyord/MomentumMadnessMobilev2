import { Platform } from 'react-native'

export const getBackendBaseUrl = (): string => {
  let url = 'http://localhost:3000';
  if (Platform.OS === 'android') {
    // For Android emulator, use 10.0.2.2
    // For physical device, use your computer's actual IP
    url = 'http://192.168.123.135:3000'; // Physical device
    // url = 'http://10.0.2.2:3000'; // Emulator only
  }
  // For physical device, set your LAN IP if needed
  // url = 'http://192.168.x.x:3000';
  return url;
}; 