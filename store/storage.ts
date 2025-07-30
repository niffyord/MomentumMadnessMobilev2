import { Platform } from 'react-native'
import { MMKV } from 'react-native-mmkv'

// MMKV cannot be used when JS runs in a remote debugger (global.nativeCallSyncHook is undefined)
const isJSIRuntimeAvailable = typeof global.nativeCallSyncHook === 'function' && Platform.OS !== 'web'

export const storage: {
  getString: (key: string) => string | null
  set: (key: string, value: string) => void
} = isJSIRuntimeAvailable
  ? new MMKV()
  : {
      // No-op in-memory fallback to keep the app running in remote-debug sessions
      _mem: {} as Record<string, string>,
      getString(key: string) {
        return this._mem[key] ?? null
      },
      set(key: string, value: string) {
        this._mem[key] = value
      },
    } as any
