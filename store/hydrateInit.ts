import { hydrateKey } from './hydration'
import { useRaceStore } from './useRaceStore'

hydrateKey('lastRace', (race)=>{
  // Hydrate without touching cache to render instantly
  useRaceStore.setState({ race })
})
