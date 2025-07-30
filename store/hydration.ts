import { storage } from './storage'

export const hydrateKey = <T>(key: string, setter: (data: T) => void) => {
  try {
    const raw = storage.getString(key)
    if (raw) {
      const data = JSON.parse(raw)
      setter(data)
    }
  } catch (_) {
    // ignore
  }
}

export const persistKey = (key: string, data: unknown) => {
  try {
    storage.set(key, JSON.stringify(data))
  } catch (_) {
    // ignore
  }
}
