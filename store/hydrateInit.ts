import { hydrateKey } from './hydration'
import { useRaceStore } from './useRaceStore'

hydrateKey('lastRace', (race)=>{
  // Hydrate without touching cache to render instantly
  useRaceStore.setState({ race })
})

// Hydrate cached asset info for faster first paint
hydrateKey('assetInfo', (assetInfo)=>{
  useRaceStore.setState({ assetInfo })
})
